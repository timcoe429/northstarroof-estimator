import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { Estimate } from '@/types';

// Helper function to extract notable items from estimate
function extractNotableItems(estimate: Estimate): string[] {
  const items: string[] = [];
  
  // Find roofing system (materials category)
  const materials = [...estimate.byCategory.materials, ...estimate.byCategory.accessories];
  for (const item of materials) {
    const name = item.name.toLowerCase();
    if (name.includes('davinci') || name.includes('brava') || name.includes('field tile') || name.includes('shake')) {
      items.push(item.name);
      break; // Only need one roofing system
    }
  }
  
  // Find notable materials (copper, snowguards, etc.)
  for (const item of materials) {
    const name = item.name.toLowerCase();
    if (name.includes('copper') || name.includes('snowguard') || name.includes('snow guard')) {
      items.push(item.name);
    }
  }
  
  return items;
}

// Generate introduction letter using AI
async function generateIntroductionLetter(customerName: string, projectItems: string[]): Promise<string> {
  const prompt = `You are Omiah Travis, owner of Northstar Roofing. Write a sincere, professional introduction letter for a roofing proposal.

CUSTOMER NAME: ${customerName}

PROJECT ITEMS:
${projectItems.length > 0 ? projectItems.map(item => `- ${item}`).join('\n') : '- Standard roofing materials'}

Write a warm, appreciative introduction letter that:
- Starts with "Thank You" or similar warm greeting
- Expresses sincere gratitude for the opportunity to estimate their project
- Mentions the customer/project name naturally
- Provides a brief overview of what's included (mention the roofing system and any notable features like copper valleys, snowguards, etc.)
- Includes a "What's Included" section with bullet points:
  * Detailed line item estimate
  * Important links (terms, exclusions, warranty info)
  * References from past clients
- Closes with: "If you have any questions, please don't hesitate to reach out."
- Includes contact info:
  Email: omiah@northstarroof.com
  Phone: 720-333-7270
- Signs with: "Omiah Travis" and "Northstar Roofing"

TONE: Very sincere, professional, appreciative - like a personal note from Omiah thanking them for the opportunity. Not salesy or generic.

Keep it to one page max. Return ONLY the letter text, no other formatting or explanations.`;

  try {
    const response = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate introduction letter');
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    return text.trim();
  } catch (error) {
    console.error('Error generating introduction:', error);
    // Fallback introduction
    return `Thank You

Dear ${customerName},

Thank you for giving Northstar Roofing the opportunity to provide an estimate for your roofing project. We sincerely appreciate your consideration.

This proposal includes a detailed breakdown of materials, labor, and equipment for your project. We've carefully selected quality materials and components to ensure a durable, professional installation.

What's Included:
• Detailed line item estimate
• Important links (terms, exclusions, warranty info)
• References from past clients

If you have any questions, please don't hesitate to reach out.

Best regards,
Omiah Travis
Northstar Roofing

Email: omiah@northstarroof.com
Phone: 720-333-7270`;
  }
}

// Load PDF template
async function loadPDFTemplate(path: string): Promise<PDFDocument> {
  const response = await fetch(path);
  const arrayBuffer = await response.arrayBuffer();
  return PDFDocument.load(arrayBuffer);
}

// Generate introduction page
async function generateIntroductionPage(introText: string): Promise<PDFDocument> {
  const template = await loadPDFTemplate('/templates/blank-page.pdf');
  const pages = template.getPages();
  const page = pages[0];
  const { width, height } = page.getSize();
  
  const font = await template.embedFont(StandardFonts.Helvetica);
  const boldFont = await template.embedFont(StandardFonts.HelveticaBold);
  
  // Parse intro text into paragraphs
  const lines = introText.split('\n').filter(line => line.trim());
  let y = height - 100; // Start near top
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Check if it's a header (all caps or starts with "Thank")
    const isHeader = trimmed === trimmed.toUpperCase() || trimmed.toLowerCase().startsWith('thank');
    const isBullet = trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*');
    const isSignature = trimmed.includes('Omiah') || trimmed.includes('Northstar');
    
    const fontSize = isHeader ? 16 : isSignature ? 11 : isBullet ? 10 : 11;
    const currentFont = isHeader || isSignature ? boldFont : font;
    const color = rgb(0, 0, 0);
    
    // Word wrap
    const words = trimmed.split(' ');
    const maxWidth = width - 100;
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const textWidth = currentFont.widthOfTextAtSize(testLine, fontSize);
      
      if (textWidth > maxWidth && currentLine) {
        page.drawText(currentLine, {
          x: 50,
          y,
          size: fontSize,
          font: currentFont,
          color,
        });
        y -= fontSize + 5;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine) {
      page.drawText(currentLine, {
        x: 50,
        y,
        size: fontSize,
        font: currentFont,
        color,
      });
      y -= fontSize + (isHeader ? 10 : isBullet ? 5 : 8);
    }
    
    if (y < 100) break; // Stop if we run out of space
  }
  
  return template;
}

// Generate line item pages
async function generateLineItemPages(estimate: Estimate, markupMultiplier: number): Promise<PDFDocument[]> {
  const pages: PDFDocument[] = [];
  
  // Combine materials and accessories
  const materialsItems = [...estimate.byCategory.materials, ...estimate.byCategory.accessories];
  const laborItems = estimate.byCategory.labor;
  const equipmentItems = estimate.byCategory.equipment;
  
  // All items grouped by section
  const allItems: Array<{ item: typeof materialsItems[0]; section: string }> = [
    ...materialsItems.map(item => ({ item, section: 'MATERIALS' })),
    ...laborItems.map(item => ({ item, section: 'LABOR' })),
    ...equipmentItems.map(item => ({ item, section: 'EQUIPMENT & FEES' })),
  ];
  
  if (allItems.length === 0) {
    return pages;
  }
  
  let currentPage: PDFDocument | null = null;
  let currentPageItems: typeof allItems = [];
  let currentSection = '';
  let itemIndex = 0;
  const maxItemsPerPage = 7;
  
  const createNewPage = async (isLastPage: boolean): Promise<PDFDocument> => {
    const template = await loadPDFTemplate(isLastPage ? '/templates/blank-page-with-total.pdf' : '/templates/blank-page.pdf');
    const font = await template.embedFont(StandardFonts.Helvetica);
    const boldFont = await template.embedFont(StandardFonts.HelveticaBold);
    
    const pages_array = template.getPages();
    const page = pages_array[0];
    const { width } = page.getSize();
    
    // Add "ROOFING ESTIMATE" title
    page.drawText('ROOFING ESTIMATE', {
      x: 50,
      y: 750,
      size: 27.5,
      font: boldFont,
      color: rgb(0.84, 0.84, 0.84), // #d6d6d6
    });
    
    // Add table headers
    const headerY = 700;
    const descX = 50;
    const priceX = width - 200;
    
    // Description header
    page.drawRectangle({
      x: descX,
      y: headerY - 20,
      width: priceX - descX - 10,
      height: 20,
      color: rgb(0.84, 0.84, 0.84), // #d6d6d6
    });
    page.drawText('Description', {
      x: descX + 5,
      y: headerY - 15,
      size: 13.2,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    
    // Pricing header
    page.drawRectangle({
      x: priceX,
      y: headerY - 20,
      width: 150,
      height: 20,
      color: rgb(0.9, 0.9, 0.9), // #e6e6e6
    });
    page.drawText('Pricing', {
      x: priceX + 5,
      y: headerY - 15,
      size: 13.2,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    
    return template;
  };
  
  for (let i = 0; i < allItems.length; i++) {
    const { item, section } = allItems[i];
    const isLastItem = i === allItems.length - 1;
    const sectionChanged = currentSection !== section;
    
    // Check if we need a new page
    if (!currentPage || currentPageItems.length >= maxItemsPerPage || sectionChanged) {
      // Save previous page if it exists
      if (currentPage && currentPageItems.length > 0) {
        pages.push(currentPage);
      }
      
      // Create new page (use total template only if it's the very last item)
      currentPage = await createNewPage(isLastItem);
      currentPageItems = [];
      
      // Add section header if section changed
      if (sectionChanged && currentSection) {
        const pages_array = currentPage.getPages();
        const page = pages_array[0];
        const font = await currentPage.embedFont(StandardFonts.HelveticaBold);
        const sectionY = 680;
        page.drawText(section, {
          x: 50,
          y: sectionY,
          size: 12,
          font,
          color: rgb(0, 0, 0),
        });
      }
      
      currentSection = section;
    }
    
    // Add item to current page
    const pages_array = currentPage!.getPages();
    const page = pages_array[0];
    const font = await currentPage!.embedFont(StandardFonts.Helvetica);
    const boldFont = await currentPage!.embedFont(StandardFonts.HelveticaBold);
    const { width } = page.getSize();
    
    const descX = 50;
    const priceX = width - 200;
    const startY = 650 - (currentPageItems.length * 30);
    
    // Add section header if this is the first item of a new section
    if (sectionChanged && currentPageItems.length === 0) {
      const sectionY = startY + 20;
      page.drawText(section, {
        x: descX,
        y: sectionY,
        size: 12,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
    }
    
    const description = item.proposalDescription && item.proposalDescription.trim() 
      ? item.proposalDescription 
      : item.name;
    const clientPrice = Math.round(item.total * markupMultiplier * 100) / 100;
    
    // Word wrap description
    const maxDescWidth = priceX - descX - 10;
    const words = description.split(' ');
    let currentLine = '';
    let y = startY;
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const textWidth = font.widthOfTextAtSize(testLine, 12);
      
      if (textWidth > maxDescWidth && currentLine) {
        page.drawText(currentLine, {
          x: descX + 5,
          y,
          size: 12,
          font,
          color: rgb(0, 0, 0),
        });
        y -= 14;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine) {
      page.drawText(currentLine, {
        x: descX + 5,
        y,
        size: 12,
        font,
        color: rgb(0, 0, 0),
      });
    }
    
    // Price
    const priceText = `$${clientPrice.toFixed(2)}`;
    page.drawText(priceText, {
      x: priceX + 5,
      y: startY,
      size: 12,
      font,
      color: rgb(0, 0, 0),
    });
    
    // Border
    page.drawRectangle({
      x: descX,
      y: startY - 25,
      width: width - 100,
      height: 1,
      color: rgb(0.9, 0.9, 0.9), // #e6e6e6
    });
    
    currentPageItems.push({ item, section });
    itemIndex++;
  }
  
  // Save last page
  if (currentPage && currentPageItems.length > 0) {
    // Add Quote Total if last page uses total template
    const pages_array = currentPage.getPages();
    const page = pages_array[0];
    const boldFont = await currentPage.embedFont(StandardFonts.HelveticaBold);
    const { width } = page.getSize();
    
    const totalY = 200;
    const totalX = width - 250;
    
    // Quote Total box
    page.drawRectangle({
      x: totalX,
      y: totalY - 30,
      width: 200,
      height: 30,
      color: rgb(0, 0.16, 0.25), // #00293f
    });
    
    page.drawText('QUOTE TOTAL:', {
      x: totalX + 5,
      y: totalY - 20,
      size: 15,
      font: boldFont,
      color: rgb(0.9, 0.9, 0.9), // #e6e6e6
    });
    
    const totalPrice = Math.round(estimate.sellPrice * 100) / 100;
    page.drawText(`$${totalPrice.toFixed(2)}`, {
      x: totalX + 5,
      y: totalY - 5,
      size: 15,
      font: boldFont,
      color: rgb(0.9, 0.9, 0.9), // #e6e6e6
    });
    
    pages.push(currentPage);
  }
  
  return pages;
}

// Main function to generate proposal PDF
export async function generateProposalPDF(estimate: Estimate): Promise<Blob> {
  // Calculate markup multiplier
  const markupMultiplier = (1 + estimate.officeCostPercent / 100) * (1 + estimate.marginPercent / 100);
  
  // Load static templates
  const coverPDF = await loadPDFTemplate('/templates/cover.pdf');
  const importantLinksPDF = await loadPDFTemplate('/templates/important-links.pdf');
  const referencesPDF = await loadPDFTemplate('/templates/references.pdf');
  
  // Generate introduction page
  const customerName = estimate.customerInfo.name || 'Valued Customer';
  const projectItems = extractNotableItems(estimate);
  const introText = await generateIntroductionLetter(customerName, projectItems);
  const introPDF = await generateIntroductionPage(introText);
  
  // Generate line item pages
  const lineItemPages = await generateLineItemPages(estimate, markupMultiplier);
  
  // Combine all pages
  const finalPDF = await PDFDocument.create();
  
  // Copy cover page
  const [coverPage] = await finalPDF.copyPages(coverPDF, [0]);
  finalPDF.addPage(coverPage);
  
  // Copy introduction page
  const [introPage] = await finalPDF.copyPages(introPDF, [0]);
  finalPDF.addPage(introPage);
  
  // Copy line item pages
  for (const lineItemPage of lineItemPages) {
    const [page] = await finalPDF.copyPages(lineItemPage, [0]);
    finalPDF.addPage(page);
  }
  
  // Copy important links page
  const [importantLinksPage] = await finalPDF.copyPages(importantLinksPDF, [0]);
  finalPDF.addPage(importantLinksPage);
  
  // Copy references page
  const [referencesPage] = await finalPDF.copyPages(referencesPDF, [0]);
  finalPDF.addPage(referencesPage);
  
  // Generate blob
  const pdfBytes = await finalPDF.save();
  // Convert Uint8Array to ArrayBuffer for Blob compatibility
  const arrayBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;
  return new Blob([arrayBuffer], { type: 'application/pdf' });
}
