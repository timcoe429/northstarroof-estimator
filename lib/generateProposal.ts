import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { Estimate } from '@/types';

// Content safe zone constants (72 points = 1 inch)
const PAGE_WIDTH = 612; // Letter size
const PAGE_HEIGHT = 792;
const TOP_MARGIN = 144; // 2 inches
const BOTTOM_MARGIN = 72; // 1 inch
const LEFT_MARGIN = 36; // 0.5 inch
const RIGHT_MARGIN = 36; // 0.5 inch
const CONTENT_X_START = 36;
const CONTENT_X_END = 576;
const CONTENT_Y_START = 72; // from bottom
const CONTENT_Y_END = 648; // from bottom
const CONTENT_WIDTH = 540;
const CONTENT_HEIGHT = 576;

// Table column definitions
const DESC_COLUMN_X = 36;
const DESC_COLUMN_WIDTH = 400;
const PRICE_COLUMN_X = 450;
const PRICE_COLUMN_WIDTH = 126;
const PRICE_TEXT_X = 568; // Right-aligned position

// Quote Total box coordinates
const QUOTE_TOTAL_X = 580;
const QUOTE_TOTAL_Y = 91;

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

// Parse structured AI response into sections
interface StructuredIntro {
  greeting: string;
  opening: string;
  bodyPara1: string;
  bodyPara2: string;
  bullet1: string;
  bullet2: string;
  bullet3: string;
  closingPara: string;
}

function parseStructuredIntro(text: string, customerName: string): StructuredIntro {
  const result: StructuredIntro = {
    greeting: `Dear ${customerName},`,
    opening: '',
    bodyPara1: '',
    bodyPara2: '',
    bullet1: 'Detailed line item estimate breaking down all materials and labor',
    bullet2: 'Important links including terms, exclusions, and warranty info',
    bullet3: 'References from past clients',
    closingPara: 'If you have any questions, please don\'t hesitate to reach out.',
  };

  // Try to extract structured sections
  const greetingMatch = text.match(/GREETING[:\s]*([\s\S]+?)(?=\n(?:OPENING|BODY|BULLET|CLOSING)|$)/i);
  const openingMatch = text.match(/OPENING[:\s]*([\s\S]+?)(?=\n(?:GREETING|BODY|BULLET|CLOSING)|$)/i);
  const body1Match = text.match(/BODY_PARA_1[:\s]*([\s\S]+?)(?=\n(?:GREETING|OPENING|BODY_PARA_2|BULLET|CLOSING)|$)/i);
  const body2Match = text.match(/BODY_PARA_2[:\s]*([\s\S]+?)(?=\n(?:GREETING|OPENING|BODY_PARA_1|BULLET|CLOSING)|$)/i);
  const bullet1Match = text.match(/BULLET_1[:\s]*([\s\S]+?)(?=\n(?:GREETING|OPENING|BODY|BULLET_2|CLOSING)|$)/i);
  const bullet2Match = text.match(/BULLET_2[:\s]*([\s\S]+?)(?=\n(?:GREETING|OPENING|BODY|BULLET_1|BULLET_3|CLOSING)|$)/i);
  const bullet3Match = text.match(/BULLET_3[:\s]*([\s\S]+?)(?=\n(?:GREETING|OPENING|BODY|BULLET|CLOSING_PARA)|$)/i);
  const closingMatch = text.match(/CLOSING_PARA[:\s]*([\s\S]+?)(?=\n(?:GREETING|OPENING|BODY|BULLET)|$)/i);

  if (greetingMatch) result.greeting = greetingMatch[1].trim();
  if (openingMatch) result.opening = openingMatch[1].trim();
  if (body1Match) result.bodyPara1 = body1Match[1].trim();
  if (body2Match) result.bodyPara2 = body2Match[1].trim();
  if (bullet1Match) result.bullet1 = bullet1Match[1].trim();
  if (bullet2Match) result.bullet2 = bullet2Match[1].trim();
  if (bullet3Match) result.bullet3 = bullet3Match[1].trim();
  if (closingMatch) result.closingPara = closingMatch[1].trim();

  // Fallback: if no structured format found, try to parse as plain text
  if (!openingMatch && !body1Match) {
    const lines = text.split('\n').filter(l => l.trim());
    let lineIndex = 0;
    
    // Skip greeting if found
    if (lines[lineIndex]?.toLowerCase().includes('dear')) {
      lineIndex++;
    }
    
    // Try to find opening
    if (lines[lineIndex]) {
      result.opening = lines[lineIndex].trim();
      lineIndex++;
    }
    
    // Try to find body paragraphs
    const bodyLines: string[] = [];
    while (lineIndex < lines.length && !lines[lineIndex].toLowerCase().includes('included') && !lines[lineIndex].toLowerCase().includes('bullet')) {
      if (lines[lineIndex].trim()) {
        bodyLines.push(lines[lineIndex].trim());
      }
      lineIndex++;
    }
    if (bodyLines.length > 0) {
      result.bodyPara1 = bodyLines.slice(0, Math.ceil(bodyLines.length / 2)).join(' ');
      result.bodyPara2 = bodyLines.slice(Math.ceil(bodyLines.length / 2)).join(' ');
    }
  }

  return result;
}

// Generate introduction letter using AI
async function generateIntroductionLetter(customerName: string, projectItems: string[]): Promise<StructuredIntro> {
  const prompt = `You are Omiah Travis, owner of Northstar Roofing. Write a sincere, professional introduction letter for a roofing proposal.

CUSTOMER NAME: ${customerName}

PROJECT ITEMS:
${projectItems.length > 0 ? projectItems.map(item => `- ${item}`).join('\n') : '- Standard roofing materials'}

Return the letter content in this EXACT structure with labeled sections. NO markdown, NO asterisks, NO formatting characters. Plain text only.

GREETING
Dear ${customerName},

OPENING
[One warm sentence thanking them sincerely for the opportunity]

BODY_PARA_1
[2-3 sentences about the project, mention the roofing system and any notable features like copper valleys, snowguards, etc.]

BODY_PARA_2
[1-2 sentences about quality and care]

BULLET_1
Detailed line item estimate breaking down all materials and labor

BULLET_2
Important links including terms, exclusions, and warranty info

BULLET_3
References from past clients

CLOSING_PARA
[One sentence inviting questions]

TONE: Very sincere, professional, appreciative - like a personal note from Omiah thanking them for the opportunity. Not salesy or generic.

Return ONLY the structured content with section labels, no other text.`;

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
    return parseStructuredIntro(text.trim(), customerName);
  } catch (error) {
    console.error('Error generating introduction:', error);
    // Fallback
    return {
      greeting: `Dear ${customerName},`,
      opening: 'Thank you for giving Northstar Roofing the opportunity to provide an estimate for your roofing project.',
      bodyPara1: 'This proposal includes a detailed breakdown of materials, labor, and equipment for your project. We\'ve carefully selected quality materials and components to ensure a durable, professional installation.',
      bodyPara2: 'We take pride in our workmanship and attention to detail.',
      bullet1: 'Detailed line item estimate breaking down all materials and labor',
      bullet2: 'Important links including terms, exclusions, and warranty info',
      bullet3: 'References from past clients',
      closingPara: 'If you have any questions, please don\'t hesitate to reach out.',
    };
  }
}

// Load PDF template
async function loadPDFTemplate(path: string): Promise<PDFDocument> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load template: ${path} (Status: ${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  try {
    return await PDFDocument.load(arrayBuffer);
  } catch (error) {
    throw new Error(`Failed to parse PDF template: ${path}. Error: ${error instanceof Error ? error.message : 'Unknown error'}. This may indicate the file is corrupted or not a valid PDF.`);
  }
}

// Word wrap helper
function wordWrap(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const textWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (textWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

// Generate introduction page
async function generateIntroductionPage(intro: StructuredIntro): Promise<PDFDocument> {
  const template = await loadPDFTemplate('/templates/thank-you.pdf');
  const pages = template.getPages();
  const page = pages[0];
  const { height } = page.getSize();
  
  const font = await template.embedFont(StandardFonts.Helvetica);
  const boldFont = await template.embedFont(StandardFonts.HelveticaBold);
  
  // Start from top of content area (Y from bottom - PDF coordinates are from bottom)
  // CONTENT_Y_END = 648 points from bottom, which is 792 - 648 = 144 from top
  let y = CONTENT_Y_END; // 648 points from bottom
  
  const maxLineWidth = 500;
  const textX = CONTENT_X_START + 50; // Start a bit indented
  
  // GREETING: Helvetica, 11pt, #000000
  const greetingLines = wordWrap(intro.greeting, font, 11, maxLineWidth);
  for (const line of greetingLines) {
    page.drawText(line, {
      x: textX,
      y,
      size: 11,
      font,
      color: rgb(0, 0, 0),
    });
    y -= 11 + 2; // Line height + spacing
  }
  y -= 20 - 2; // After greeting: 20 points
  
  // OPENING: Helvetica Bold, 14pt, #00293f
  const openingLines = wordWrap(intro.opening, boldFont, 14, maxLineWidth);
  for (const line of openingLines) {
    page.drawText(line, {
      x: textX,
      y,
      size: 14,
      font: boldFont,
      color: rgb(0, 0.16, 0.25), // #00293f
    });
    y -= 14 + 2;
  }
  y -= 15 - 2; // After opening: 15 points
  
  // BODY_PARA_1: Helvetica, 11pt, #000000
  if (intro.bodyPara1) {
    const body1Lines = wordWrap(intro.bodyPara1, font, 11, maxLineWidth);
    for (const line of body1Lines) {
      page.drawText(line, {
        x: textX,
        y,
        size: 11,
        font,
        color: rgb(0, 0, 0),
      });
      y -= 11 + 2;
    }
    y -= 12 - 2; // Between paragraphs: 12 points
  }
  
  // BODY_PARA_2: Helvetica, 11pt, #000000
  if (intro.bodyPara2) {
    const body2Lines = wordWrap(intro.bodyPara2, font, 11, maxLineWidth);
    for (const line of body2Lines) {
      page.drawText(line, {
        x: textX,
        y,
        size: 11,
        font,
        color: rgb(0, 0, 0),
      });
      y -= 11 + 2;
    }
    y -= 15 - 2; // Before "What's Included": 15 points
  }
  
  // "What's Included" header: Helvetica Bold, 11pt, #000000
  const includedHeader = 'What\'s Included in This Proposal:';
  page.drawText(includedHeader, {
    x: textX,
    y,
    size: 11,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  y -= 11 + 8; // After header: 8 points
  
  // Bullets: Helvetica, 11pt, #000000, use • character
  const bullets = [intro.bullet1, intro.bullet2, intro.bullet3];
  for (const bullet of bullets) {
    const bulletText = `• ${bullet}`;
    const bulletLines = wordWrap(bulletText, font, 11, maxLineWidth);
    for (const line of bulletLines) {
      page.drawText(line, {
        x: textX,
        y,
        size: 11,
        font,
        color: rgb(0, 0, 0),
      });
      y -= 11 + 2;
    }
    y -= 6 - 2; // Between bullets: 6 points
  }
  y -= 15 - 6; // After last bullet: 15 points
  
  // CLOSING_PARA: Helvetica, 11pt, #000000
  const closingLines = wordWrap(intro.closingPara, font, 11, maxLineWidth);
  for (const line of closingLines) {
    page.drawText(line, {
      x: textX,
      y,
      size: 11,
      font,
      color: rgb(0, 0, 0),
    });
    y -= 11 + 2;
  }
  y -= 20 - 2; // Before "Best regards,": 20 points
  
  // "Best regards,": Helvetica, 11pt, #000000
  page.drawText('Best regards,', {
    x: textX,
    y,
    size: 11,
    font,
    color: rgb(0, 0, 0),
  });
  y -= 11 + 8; // After "Best regards,": 8 points
  
  // "Omiah Travis": Helvetica Bold, 11pt, #000000
  page.drawText('Omiah Travis', {
    x: textX,
    y,
    size: 11,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  y -= 11 + 2; // After "Omiah Travis": 2 points
  
  // "Northstar Roofing": Helvetica, 11pt, #000000
  page.drawText('Northstar Roofing', {
    x: textX,
    y,
    size: 11,
    font,
    color: rgb(0, 0, 0),
  });
  y -= 11 + 12; // After "Northstar Roofing": 12 points
  
  // Contact info: Helvetica, 10pt, #000000
  page.drawText('Email: omiah@northstarroof.com', {
    x: textX,
    y,
    size: 10,
    font,
    color: rgb(0, 0, 0),
  });
  y -= 10 + 4; // Between email and phone: 4 points
  
  page.drawText('Phone: 720-333-7270', {
    x: textX,
    y,
    size: 10,
    font,
    color: rgb(0, 0, 0),
  });
  
  return template;
}

// Generate line item pages
async function generateLineItemPages(estimate: Estimate, markupMultiplier: number): Promise<PDFDocument[]> {
  const pages: PDFDocument[] = [];
  
  // Combine materials and accessories into MATERIALS section
  const materialsItems = [...estimate.byCategory.materials, ...estimate.byCategory.accessories];
  const laborItems = estimate.byCategory.labor;
  const equipmentItems = estimate.byCategory.equipment;
  
  // All items grouped by section (only THREE sections)
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
  let currentY = CONTENT_Y_END - 22; // Start below table header
  
  const createNewPage = async (isLastPage: boolean): Promise<PDFDocument> => {
    const template = await loadPDFTemplate(isLastPage ? '/templates/blank-page-estimate-with-total.pdf' : '/templates/blank-page-estimate.pdf');
    const font = await template.embedFont(StandardFonts.Helvetica);
    const boldFont = await template.embedFont(StandardFonts.HelveticaBold);
    
    const pages_array = template.getPages();
    const page = pages_array[0];
    
    // Table header row (templates have "ROOFING ESTIMATE" title built-in)
    // Header is at top of content area, 22 points tall
    const headerY = CONTENT_Y_END; // Top of header (648 from bottom)
    
    // Description header background: #d6d6d6, X=36 to X=436, height 22
    page.drawRectangle({
      x: DESC_COLUMN_X,
      y: headerY - 22, // Bottom of rectangle
      width: 400, // X=436 - X=36
      height: 22,
      color: rgb(0.84, 0.84, 0.84), // #d6d6d6
    });
    
    // Pricing header background: #e6e6e6, X=436 to X=576, height 22
    page.drawRectangle({
      x: 436,
      y: headerY - 22, // Bottom of rectangle
      width: 140, // X=576 - X=436
      height: 22,
      color: rgb(0.9, 0.9, 0.9), // #e6e6e6
    });
    
    // "Description" text: Helvetica Bold, 10pt, #000000, X=44
    // Center text vertically in header (approximately 7pt from bottom of header)
    page.drawText('Description', {
      x: 44,
      y: headerY - 15, // Approximately centered in 22pt header
      size: 10,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    
    // "Pricing" text: Helvetica Bold, 10pt, #000000, right-aligned to X=568
    const pricingText = 'Pricing';
    const pricingWidth = boldFont.widthOfTextAtSize(pricingText, 10);
    page.drawText(pricingText, {
      x: PRICE_TEXT_X - pricingWidth,
      y: headerY - 15, // Approximately centered in 22pt header
      size: 10,
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
    // Calculate space needed: section header (36 points) + line item (24 points)
    const spaceNeeded = sectionChanged ? 36 + 24 : 24;
    const spaceAvailable = currentY - CONTENT_Y_START;
    
    if (!currentPage || spaceAvailable < spaceNeeded || sectionChanged) {
      // Save previous page if it exists
      if (currentPage && currentPageItems.length > 0) {
        pages.push(currentPage);
      }
      
      // Create new page (use total template only if it's the very last item)
      currentPage = await createNewPage(isLastItem);
      currentPageItems = [];
      currentY = CONTENT_Y_END - 22 - 12; // Below header (22pt) minus 12pt before section header
      currentSection = section;
    }
    
    const pages_array = currentPage!.getPages();
    const page = pages_array[0];
    const font = await currentPage!.embedFont(StandardFonts.Helvetica);
    const boldFont = await currentPage!.embedFont(StandardFonts.HelveticaBold);
    
    // Add section header if section changed
    if (sectionChanged) {
      currentY -= 12; // 12 points before section header
      
      // Section header: Helvetica Bold, 10pt, #000000, X=36, NO background
      page.drawText(section, {
        x: DESC_COLUMN_X,
        y: currentY,
        size: 10,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      
      currentY -= 10 + 6; // Text height + 6 points after
    }
    
    // Add line item
    const description = item.proposalDescription && item.proposalDescription.trim() 
      ? item.proposalDescription 
      : item.name;
    const clientPrice = Math.round(item.total * markupMultiplier * 100) / 100;
    
    // Word wrap description
    const maxDescWidth = DESC_COLUMN_WIDTH - 8; // 8pt padding
    const descLines = wordWrap(description, font, 10, maxDescWidth);
    
    // Draw description (indented: X=44)
    let descY = currentY;
    for (const line of descLines) {
      page.drawText(line, {
        x: 44,
        y: descY,
        size: 10,
        font,
        color: rgb(0, 0, 0),
      });
      descY -= 12; // Line spacing
    }
    
    // Price: Helvetica, 10pt, #000000, right-aligned to X=568
    const priceText = `$${clientPrice.toFixed(2)}`;
    const priceWidth = font.widthOfTextAtSize(priceText, 10);
    page.drawText(priceText, {
      x: PRICE_TEXT_X - priceWidth,
      y: currentY,
      size: 10,
      font,
      color: rgb(0, 0, 0),
    });
    
    // Separator line: #e6e6e6, 0.5pt stroke, X=36 to X=576
    const lineY = currentY - Math.max(descLines.length * 12, 24) + 12;
    page.drawRectangle({
      x: DESC_COLUMN_X,
      y: lineY - 0.25,
      width: CONTENT_X_END - DESC_COLUMN_X,
      height: 0.5,
      color: rgb(0.9, 0.9, 0.9), // #e6e6e6
    });
    
    // Update Y position for next item
    currentY = lineY - 12; // Space after separator
    
    currentPageItems.push({ item, section });
  }
  
  // Save last page
  if (currentPage && currentPageItems.length > 0) {
    // Add Quote Total amount if last page uses total template
    const pages_array = currentPage.getPages();
    const page = pages_array[0];
    const boldFont = await currentPage.embedFont(StandardFonts.HelveticaBold);
    
    const totalPrice = Math.round(estimate.sellPrice * 100) / 100;
    const priceText = `$${totalPrice.toFixed(2)}`;
    const priceWidth = boldFont.widthOfTextAtSize(priceText, 14);
    
    // Only overlay dollar amount at exact position: X=580, Y=91, right-aligned, white
    page.drawText(priceText, {
      x: QUOTE_TOTAL_X - priceWidth,
      y: QUOTE_TOTAL_Y,
      size: 14,
      font: boldFont,
      color: rgb(1, 1, 1), // #FFFFFF white
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
  const intro = await generateIntroductionLetter(customerName, projectItems);
  const introPDF = await generateIntroductionPage(intro);
  
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
