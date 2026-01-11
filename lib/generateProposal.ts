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

// Table layout - based on Canva design measurements
const TABLE_LEFT = 50; // Left margin
const TABLE_WIDTH = 500; // Total table width (fits within 540pt content area)
const TABLE_RIGHT = TABLE_LEFT + TABLE_WIDTH; // 550

// Column widths (Description ~82%, Pricing ~18%)
const DESC_COLUMN_WIDTH = 410;
const PRICE_COLUMN_WIDTH = 90;
const DESC_COLUMN_LEFT = TABLE_LEFT;
const DESC_COLUMN_RIGHT = DESC_COLUMN_LEFT + DESC_COLUMN_WIDTH; // 460
const PRICE_COLUMN_LEFT = DESC_COLUMN_RIGHT;
const PRICE_COLUMN_RIGHT = TABLE_RIGHT; // 550

// Row dimensions
const HEADER_HEIGHT = 28;
const ROW_HEIGHT_SINGLE = 28; // For single-line items
const ROW_PADDING = 10; // Padding inside cells
const LINE_HEIGHT = 14; // For text wrapping calculation

// Border styling
const BORDER_WIDTH = 1.5; // 2px
const BORDER_COLOR = rgb(0.9, 0.9, 0.9); // #e6e6e6

// Header backgrounds
const DESC_HEADER_BG = rgb(0.84, 0.84, 0.84); // Light gray #d6d6d6
const PRICE_HEADER_BG = rgb(0.9, 0.9, 0.9); // Slightly lighter gray #e6e6e6

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

// Calculate row height based on text wrapping
function calculateRowHeight(text: string, font: any, fontSize: number, maxWidth: number): number {
  const lines = wordWrap(text, font, fontSize, maxWidth);
  const textHeight = lines.length * (fontSize + 4); // fontSize + line spacing
  return Math.max(ROW_HEIGHT_SINGLE, textHeight + ROW_PADDING * 2);
}

// Format currency with commas
function formatCurrency(amount: number): string {
  return '$' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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

// Page content data structure for two-pass approach
interface PageContent {
  items: Array<{ item: any; section: string; descLines: string[]; price: number }>;
}

// Generate line item pages using two-pass approach
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
  
  // PASS 1: Track content for each page (without rendering)
  const pageContents: PageContent[] = [];
  let currentPageContent: PageContent = { items: [] };
  let currentSection = '';
  let currentY = CONTENT_Y_END - 22; // Start below table header
  
  const font = await (await loadPDFTemplate('/templates/blank-page-estimate.pdf')).embedFont(StandardFonts.Helvetica);
  
  // Track content for each page
  for (let i = 0; i < allItems.length; i++) {
    const { item, section } = allItems[i];
    const sectionChanged = currentSection !== section;
    
    // Calculate space needed
    const description = item.proposalDescription && item.proposalDescription.trim() 
      ? item.proposalDescription 
      : item.name;
    const maxDescWidth = DESC_COLUMN_WIDTH - ROW_PADDING * 2;
    const sectionHeaderSpace = sectionChanged ? ROW_HEIGHT_SINGLE : 0;
    const itemHeight = calculateRowHeight(description, font, 10, maxDescWidth);
    const spaceNeeded = sectionHeaderSpace + itemHeight;
    const spaceAvailable = currentY - CONTENT_Y_START;
    
    // Only create new page when out of space (NOT on section change)
    if (currentPageContent.items.length === 0 || spaceAvailable < spaceNeeded) {
      // Save previous page content if it exists
      if (currentPageContent.items.length > 0) {
        pageContents.push(currentPageContent);
      }
      
      // Start new page
      currentPageContent = { items: [] };
      currentY = CONTENT_Y_END - HEADER_HEIGHT; // Below header
    }
    
    // Add section header if section changed (track space but don't store header separately)
    if (sectionChanged && currentSection) {
      currentY -= ROW_HEIGHT_SINGLE;
    }
    
    // Add item to current page content
    const clientPrice = Math.round(item.total * markupMultiplier * 100) / 100;
    currentPageContent.items.push({
      item,
      section,
      descLines: wordWrap(description, font, 10, maxDescWidth),
      price: clientPrice,
    });
    
    // Update Y position
    currentY = currentY - itemHeight;
    
    currentSection = section;
  }
  
  // Save last page content
  if (currentPageContent.items.length > 0) {
    pageContents.push(currentPageContent);
  }
  
  // PASS 1: Render all pages except the last one
  for (let pageIdx = 0; pageIdx < pageContents.length - 1; pageIdx++) {
    const pageContent = pageContents[pageIdx];
    const template = await loadPDFTemplate('/templates/blank-page-estimate.pdf');
    const pageFont = await template.embedFont(StandardFonts.Helvetica);
    const pageBoldFont = await template.embedFont(StandardFonts.HelveticaBold);
    const pages_array = template.getPages();
    const page = pages_array[0];
    
    // Draw table header
    let yPos = drawTableHeader(page, CONTENT_Y_END, pageFont, pageBoldFont);
    
    // Draw page content
    let lastSection = '';
    
    for (const contentItem of pageContent.items) {
      // Add section header if needed
      if (contentItem.section !== lastSection) {
        yPos = drawSectionHeader(page, yPos, contentItem.section, pageBoldFont);
        lastSection = contentItem.section;
      }
      
      // Draw item row
      const description = contentItem.item.proposalDescription && contentItem.item.proposalDescription.trim() 
        ? contentItem.item.proposalDescription 
        : contentItem.item.name;
      const priceText = formatCurrency(contentItem.price);
      yPos = drawLineItemRow(page, yPos, description, priceText, pageFont);
    }
    
    pages.push(template);
  }
  
  // PASS 2: Rebuild last page with Quote Total template
  if (pageContents.length > 0) {
    const lastPageContent = pageContents[pageContents.length - 1];
    const template = await loadPDFTemplate('/templates/blank-page-estimate-with-total.pdf');
    const pageFont = await template.embedFont(StandardFonts.Helvetica);
    const pageBoldFont = await template.embedFont(StandardFonts.HelveticaBold);
    const pages_array = template.getPages();
    const page = pages_array[0];
    
    // Draw table header
    let yPos = drawTableHeader(page, CONTENT_Y_END, pageFont, pageBoldFont);
    
    // Draw page content
    let lastSection = '';
    
    for (const contentItem of lastPageContent.items) {
      // Add section header if needed
      if (contentItem.section !== lastSection) {
        yPos = drawSectionHeader(page, yPos, contentItem.section, pageBoldFont);
        lastSection = contentItem.section;
      }
      
      // Draw item row
      const description = contentItem.item.proposalDescription && contentItem.item.proposalDescription.trim() 
        ? contentItem.item.proposalDescription 
        : contentItem.item.name;
      const priceText = formatCurrency(contentItem.price);
      yPos = drawLineItemRow(page, yPos, description, priceText, pageFont);
    }
    
    // Add Quote Total amount overlay
    const totalPrice = Math.round(estimate.sellPrice * 100) / 100;
    const priceText = formatCurrency(totalPrice);
    const priceWidth = pageBoldFont.widthOfTextAtSize(priceText, 14);
    
    page.drawText(priceText, {
      x: QUOTE_TOTAL_X - priceWidth,
      y: QUOTE_TOTAL_Y,
      size: 14,
      font: pageBoldFont,
      color: rgb(1, 1, 1), // #FFFFFF white
    });
    
    pages.push(template);
  }
  
  return pages;
}

// Helper function to draw table header
function drawTableHeader(page: any, y: number, font: any, boldFont: any): number {
  const headerBottom = y - HEADER_HEIGHT;
  
  // Description header background (light gray)
  page.drawRectangle({
    x: DESC_COLUMN_LEFT,
    y: headerBottom,
    width: DESC_COLUMN_WIDTH,
    height: HEADER_HEIGHT,
    color: DESC_HEADER_BG,
  });
  
  // Pricing header background (slightly lighter gray)
  page.drawRectangle({
    x: PRICE_COLUMN_LEFT,
    y: headerBottom,
    width: PRICE_COLUMN_WIDTH,
    height: HEADER_HEIGHT,
    color: PRICE_HEADER_BG,
  });
  
  // Border - top of header
  page.drawRectangle({
    x: TABLE_LEFT,
    y: y - BORDER_WIDTH,
    width: TABLE_WIDTH,
    height: BORDER_WIDTH,
    color: BORDER_COLOR,
  });
  
  // Border - bottom of header
  page.drawRectangle({
    x: TABLE_LEFT,
    y: headerBottom,
    width: TABLE_WIDTH,
    height: BORDER_WIDTH,
    color: BORDER_COLOR,
  });
  
  // Border - left side
  page.drawRectangle({
    x: TABLE_LEFT,
    y: headerBottom,
    width: BORDER_WIDTH,
    height: HEADER_HEIGHT,
    color: BORDER_COLOR,
  });
  
  // Border - right side
  page.drawRectangle({
    x: TABLE_RIGHT - BORDER_WIDTH,
    y: headerBottom,
    width: BORDER_WIDTH,
    height: HEADER_HEIGHT,
    color: BORDER_COLOR,
  });
  
  // Border - vertical divider between columns
  page.drawRectangle({
    x: PRICE_COLUMN_LEFT - BORDER_WIDTH / 2,
    y: headerBottom,
    width: BORDER_WIDTH,
    height: HEADER_HEIGHT,
    color: BORDER_COLOR,
  });
  
  // "Description" text - centered
  const descText = 'Description';
  const descTextWidth = boldFont.widthOfTextAtSize(descText, 11);
  const descTextX = DESC_COLUMN_LEFT + (DESC_COLUMN_WIDTH - descTextWidth) / 2;
  const textY = headerBottom + (HEADER_HEIGHT - 11) / 2 + 3;
  
  page.drawText(descText, {
    x: descTextX,
    y: textY,
    size: 11,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  
  // "Pricing" text - centered
  const pricingText = 'Pricing';
  const pricingTextWidth = boldFont.widthOfTextAtSize(pricingText, 11);
  const pricingTextX = PRICE_COLUMN_LEFT + (PRICE_COLUMN_WIDTH - pricingTextWidth) / 2;
  
  page.drawText(pricingText, {
    x: pricingTextX,
    y: textY,
    size: 11,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  
  return headerBottom; // Return Y position for next row
}

// Helper function to draw a line item row
function drawLineItemRow(
  page: any, 
  y: number, 
  description: string, 
  price: string, 
  font: any, 
  isSection: boolean = false
): number {
  const maxDescWidth = DESC_COLUMN_WIDTH - ROW_PADDING * 2;
  const fontSize = 10;
  
  // Calculate row height based on text wrapping
  const lines = wordWrap(description, font, fontSize, maxDescWidth);
  const textHeight = lines.length * (fontSize + 4);
  const rowHeight = Math.max(ROW_HEIGHT_SINGLE, textHeight + ROW_PADDING * 2);
  
  const rowBottom = y - rowHeight;
  
  // Row background (white/transparent - no fill needed)
  
  // Border - bottom of row
  page.drawRectangle({
    x: TABLE_LEFT,
    y: rowBottom,
    width: TABLE_WIDTH,
    height: BORDER_WIDTH,
    color: BORDER_COLOR,
  });
  
  // Border - left side
  page.drawRectangle({
    x: TABLE_LEFT,
    y: rowBottom,
    width: BORDER_WIDTH,
    height: rowHeight,
    color: BORDER_COLOR,
  });
  
  // Border - right side
  page.drawRectangle({
    x: TABLE_RIGHT - BORDER_WIDTH,
    y: rowBottom,
    width: BORDER_WIDTH,
    height: rowHeight,
    color: BORDER_COLOR,
  });
  
  // Border - vertical divider
  page.drawRectangle({
    x: PRICE_COLUMN_LEFT - BORDER_WIDTH / 2,
    y: rowBottom,
    width: BORDER_WIDTH,
    height: rowHeight,
    color: BORDER_COLOR,
  });
  
  // Description text - left aligned with padding
  const textStartY = y - ROW_PADDING - fontSize;
  let textY = textStartY;
  
  for (const line of lines) {
    page.drawText(line, {
      x: DESC_COLUMN_LEFT + ROW_PADDING,
      y: textY,
      size: fontSize,
      font: isSection ? font : font, // Use boldFont for section headers if needed
      color: rgb(0, 0, 0),
    });
    textY -= (fontSize + 4);
  }
  
  // Price text - right aligned with padding
  if (price) {
    const priceWidth = font.widthOfTextAtSize(price, fontSize);
    page.drawText(price, {
      x: PRICE_COLUMN_RIGHT - ROW_PADDING - priceWidth,
      y: textStartY,
      size: fontSize,
      font: font,
      color: rgb(0, 0, 0),
    });
  }
  
  return rowBottom; // Return Y position for next row
}

// Helper function to draw section header row
function drawSectionHeader(page: any, y: number, sectionName: string, boldFont: any): number {
  const rowHeight = ROW_HEIGHT_SINGLE;
  const rowBottom = y - rowHeight;
  
  // Border - bottom
  page.drawRectangle({
    x: TABLE_LEFT,
    y: rowBottom,
    width: TABLE_WIDTH,
    height: BORDER_WIDTH,
    color: BORDER_COLOR,
  });
  
  // Border - left
  page.drawRectangle({
    x: TABLE_LEFT,
    y: rowBottom,
    width: BORDER_WIDTH,
    height: rowHeight,
    color: BORDER_COLOR,
  });
  
  // Border - right
  page.drawRectangle({
    x: TABLE_RIGHT - BORDER_WIDTH,
    y: rowBottom,
    width: BORDER_WIDTH,
    height: rowHeight,
    color: BORDER_COLOR,
  });
  
  // Section name - bold, left aligned
  page.drawText(sectionName, {
    x: DESC_COLUMN_LEFT + ROW_PADDING,
    y: rowBottom + (rowHeight - 10) / 2 + 2,
    size: 10,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  
  return rowBottom;
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
