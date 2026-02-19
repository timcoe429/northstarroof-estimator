import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { Estimate, LineItem } from '@/types';
import { groupItemsIntoKits } from '@/lib/kitGrouping';

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

// Row dimensions — increased for better readability
const HEADER_HEIGHT = 28;
const ROW_HEIGHT_SINGLE = 32; // For single-line items (was 28)
const ROW_PADDING = 18; // Padding inside cells (was 15)
const ROW_PADDING_VERTICAL = 8; // Extra top/bottom padding
const LINE_HEIGHT = 16; // For text wrapping (was 14)
const SECTION_GAP_ABOVE = 20; // Margin above section header
const SECTION_GAP_BELOW = 8;  // Margin below section header

// Border styling
const BORDER_WIDTH = 1.5; // 2px
const BORDER_COLOR = rgb(0.9, 0.9, 0.9); // #e6e6e6

// Header backgrounds
const DESC_HEADER_BG = rgb(0.84, 0.84, 0.84); // Light gray #d6d6d6
const PRICE_HEADER_BG = rgb(0.9, 0.9, 0.9); // Slightly lighter gray #e6e6e6

// Quote Total box coordinates
const QUOTE_TOTAL_X = 580;
const QUOTE_TOTAL_Y = 91;

// Content Area Boundaries (measured from PDF templates)
// Regular page: blank-page-estimate.pdf
const REGULAR_PAGE_CONTENT_HEIGHT = 558;  // 7.75 inches × 72
const REGULAR_PAGE_BOTTOM_MARGIN = 115;   // 1.6 inches × 72 (min Y from bottom)

// Quote total page: blank-page-estimate-with-total.pdf  
const QUOTE_PAGE_CONTENT_HEIGHT = 504;    // 7 inches × 72
const QUOTE_PAGE_BOTTOM_MARGIN = 144;     // 2 inches × 72 (min Y from bottom)

// Quote Total Box (measured from template)
const QUOTE_TOTAL_BOX_WIDTH = 117;   // 1.626 inches × 72
const QUOTE_TOTAL_BOX_HEIGHT = 46;   // 0.632 inches × 72

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

// Intro letter format: greeting + body paragraphs + bullet points
interface SimpleIntro {
  greeting: string;
  bodyParagraphs: string[];
  bulletPoints: string[];
}

function parseIntroLetter(text: string): SimpleIntro {
  // Convert literal escape sequences to real newlines (handles \n, \r\n, \r, and double-encoded \\n)
  let bodyText = text;
  while (bodyText.includes('\\n') || bodyText.includes('\\r')) {
    bodyText = bodyText
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\n');
  }
  const trimmed = bodyText.trim();
  const lines = trimmed.split(/\n/).map((l) => l.trim());
  const greeting = lines[0]?.toLowerCase().includes('dear') ? lines[0] : 'Dear Homeowner,';
  const bodyStart = lines[0]?.toLowerCase().includes('dear') ? 1 : 0;
  const bodyParagraphs: string[] = [];
  const bulletPoints: string[] = [];
  let currentParagraph: string[] = [];
  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      bodyParagraphs.push(currentParagraph.join(' ').trim());
      currentParagraph = [];
    }
  };
  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i];
    if (line.toLowerCase().includes('kind regards') || line.toLowerCase().includes('omiah travis')) break;
    const isBullet = /^\s*[•\-]\s*(.+)$/.test(line) || line.startsWith('•') || line.startsWith('-');
    if (isBullet) {
      flushParagraph();
      const bulletText = line.replace(/^\s*[•\-]\s*/, '').trim();
      if (bulletText) bulletPoints.push(bulletText);
    } else if (line) {
      currentParagraph.push(line);
    } else {
      // Blank line — paragraph break
      flushParagraph();
    }
  }
  flushParagraph();
  // Fallback: if nothing parsed, use legacy double-space split
  if (bodyParagraphs.length === 0 && bulletPoints.length === 0) {
    const bodyText = trimmed.split(/\n+/).slice(bodyStart).join(' ').replace(/\s+/g, ' ').trim();
    const idx = bodyText.toLowerCase().indexOf('kind regards');
    const beforeSig = idx >= 0 ? bodyText.slice(0, idx).trim() : bodyText;
    if (beforeSig) {
      const paras = beforeSig.split(/\s{2,}/).filter(Boolean);
      if (paras.length > 0) bodyParagraphs.push(...paras);
      else bodyParagraphs.push(beforeSig);
    }
  }
  return { greeting, bodyParagraphs, bulletPoints };
}

// Generate introduction letter using AI — new format: Dear Homeowner, 2-3 paragraphs, no bullets, under 200 words
async function generateIntroductionLetter(estimate: Estimate): Promise<SimpleIntro> {
  const address = estimate.customerInfo?.address || 'Your property';
  const notableItems = extractNotableItems(estimate);
  const material = notableItems.find((n) =>
    /brava|davinci|shake|tile|asphalt|metal|cedar/i.test(n)
  ) || notableItems[0] || 'roofing materials';
  const scopeItems = notableItems.length > 0 ? notableItems.join(', ') : 'standard roofing materials';
  const pitch = estimate.measurements?.predominant_pitch || 'Not specified';
  const totalSquares = estimate.measurements?.total_squares ?? 0;
  const totalSquaresStr = totalSquares > 0 ? String(totalSquares) : 'Not specified';

  const prompt = `Write a personalized introduction letter for a roofing proposal.

JOB DETAILS:
- Property address: ${address}
- Material: ${material}
- Key scope items: ${scopeItems}
- Roof pitch: ${pitch}
- Total squares: ${totalSquaresStr}

RULES:
- Open with "Dear Homeowner,"
- 2-3 short paragraphs, no bullet points
- Warm, professional, elevated tone — written for a high-end Aspen client
- Reference the specific material and scope naturally
- Weave in Aspen/mountain context where it fits naturally, not forced
- Never use generic phrases like "we treat every home like our own"
- Never list services as bullets
- Under 200 words total
- Close with:
  Kind regards,
  Omiah Travis
  Northstar Roofing
  omiah@northstarroof.com
  720-333-7270

Return ONLY the letter text. No other text.`;

  try {
    const response = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, max_tokens: 1000 }),
    });
    if (!response.ok) throw new Error('Failed to generate introduction letter');
    const data = await response.json();
    const text = (data.content?.[0]?.text || '').trim();
    return parseIntroLetter(text);
  } catch (error) {
    console.error('Error generating introduction:', error);
    return {
      greeting: 'Dear Homeowner,',
      bodyParagraphs: [
        'Thank you for the opportunity to provide an estimate for your roofing project. This proposal includes a detailed breakdown of materials, labor, and equipment.',
        'We have carefully selected quality components to ensure a durable, professional installation suited to our mountain environment.',
      ],
      bulletPoints: [],
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
function calculateRowHeight(text: string, font: any, fontSize: number, maxWidth: number, subtitle?: string): number {
  const lines = wordWrap(text, font, fontSize, maxWidth);
  let textHeight = lines.length * (fontSize + 5); // fontSize + line spacing (1.6 ratio)
  if (subtitle) {
    const subtitleLines = wordWrap(subtitle, font, 9, maxWidth);
    textHeight += subtitleLines.length * (9 + 4) + 8;
  }
  return Math.max(ROW_HEIGHT_SINGLE, textHeight + ROW_PADDING_VERTICAL * 2);
}

// Format currency with commas
function formatCurrency(amount: number): string {
  return '$' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Intro letter page layout constants
const INTRO_LEFT_MARGIN = 72;   // 1 inch - generous margins
const INTRO_RIGHT_MARGIN = 72;  // 1 inch
const INTRO_CONTENT_WIDTH = PAGE_WIDTH - INTRO_LEFT_MARGIN - INTRO_RIGHT_MARGIN; // 468pt
const INTRO_FONT_SIZE = 11;
const INTRO_LINE_HEIGHT = 15;   // 11pt + 4pt leading
const INTRO_PARAGRAPH_GAP = 18; // space between paragraphs
const INTRO_BULLET_GAP = 10;    // space between bullet items
const INTRO_BODY_TO_SIGNATURE_GAP = 40; // minimum gap between letter body and signature block

// Generate introduction page — professional letter layout with paragraphs and bullets
async function generateIntroductionPage(intro: SimpleIntro): Promise<PDFDocument> {
  const template = await loadPDFTemplate('/templates/thank-you.pdf');
  const pages = template.getPages();
  const page = pages[0];

  const font = await template.embedFont(StandardFonts.Helvetica);
  const boldFont = await template.embedFont(StandardFonts.HelveticaBold);

  const maxLineWidth = INTRO_CONTENT_WIDTH;
  const textX = INTRO_LEFT_MARGIN;

  // Start from top of content area — page feels full, not centered/floating
  let y = CONTENT_Y_END - 36; // 0.5 inch from top

  // Body paragraphs (letter body from CSV opens with its own first sentence — no greeting)
  for (const para of intro.bodyParagraphs) {
    const paraLines = wordWrap(para, font, INTRO_FONT_SIZE, maxLineWidth);
    for (const line of paraLines) {
      page.drawText(line, { x: textX, y, size: INTRO_FONT_SIZE, font, color: rgb(0, 0, 0) });
      y -= INTRO_LINE_HEIGHT;
    }
    y -= INTRO_PARAGRAPH_GAP;
  }

  // Bullet points — indented with bullet character, continuation lines align with text
  const bulletChar = '• ';
  const bulletCharWidth = font.widthOfTextAtSize(bulletChar, INTRO_FONT_SIZE);
  const bulletContinuationX = textX + bulletCharWidth;
  for (const bullet of intro.bulletPoints) {
    const fullLine = bulletChar + bullet;
    const bulletLines = wordWrap(fullLine, font, INTRO_FONT_SIZE, maxLineWidth);
    for (let i = 0; i < bulletLines.length; i++) {
      const line = bulletLines[i];
      const drawX = i === 0 ? textX : bulletContinuationX;
      page.drawText(line, { x: drawX, y, size: INTRO_FONT_SIZE, font, color: rgb(0, 0, 0) });
      y -= INTRO_LINE_HEIGHT;
    }
    y -= INTRO_BULLET_GAP;
  }

  // Minimum 40pt gap between letter body and signature block
  y -= INTRO_BODY_TO_SIGNATURE_GAP;

  // Signature block — unchanged
  page.drawText('Kind regards,', { x: textX, y, size: 11, font, color: rgb(0, 0, 0) });
  y -= 11 + 8;
  page.drawText('Omiah Travis', { x: textX, y, size: 11, font: boldFont, color: rgb(0, 0, 0) });
  y -= 11 + 2;
  page.drawText('Northstar Roofing', { x: textX, y, size: 11, font, color: rgb(0, 0, 0) });
  y -= 11 + 12;
  page.drawText('omiah@northstarroof.com', { x: textX, y, size: 10, font, color: rgb(0, 0, 0) });
  y -= 10 + 4;
  page.drawText('720-333-7270', {
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
  items: Array<{ item: any; section: string; itemName: string; itemDescription: string; price: number; isOptional?: boolean }>;
}

// Generate line item pages using two-pass approach
async function generateLineItemPages(estimate: Estimate): Promise<PDFDocument[]> {
  const pages: PDFDocument[] = [];

  // Cost-tier-based margin: higher-cost items get higher multipliers
  const HIGH_COST_THRESHOLD = 5000;   // $5k+ items: ~65% markup
  const MEDIUM_COST_THRESHOLD = 1000; // $1k-$5k: ~35% markup
  const MULTIPLIERS = {
    HIGH_COST: 1.65,    // $5k+ items (GAF, labor)
    MEDIUM_COST: 1.35,  // $1k-$5k (accessories, consumables)
    LOW_COST: 1.10,     // <$1k (equipment, small items)
  };

  const getTierMultiplier = (itemBaseTotal: number): number => {
    if (itemBaseTotal >= HIGH_COST_THRESHOLD) return MULTIPLIERS.HIGH_COST;
    if (itemBaseTotal >= MEDIUM_COST_THRESHOLD) return MULTIPLIERS.MEDIUM_COST;
    return MULTIPLIERS.LOW_COST;
  };

  // Get custom section headers or use defaults
  const sectionHeaders = {
    materials: estimate.sectionHeaders?.materials ?? 'Materials',
    consumables: estimate.sectionHeaders?.consumables ?? 'Consumables & Hardware',
    labor: estimate.sectionHeaders?.labor ?? 'Labor',
    equipment: estimate.sectionHeaders?.equipment ?? 'Equipment & Fees',
    accessories: estimate.sectionHeaders?.accessories ?? 'Accessories',
    schafer: estimate.sectionHeaders?.schafer ?? 'Vendor Quote',
  };

  // Section order: MATERIALS, CONSUMABLES, ACCESSORIES, LABOR, EQUIPMENT, OPTIONAL
  const consumablesItems = estimate.byCategory.consumables || [];
  const accessoriesItems = groupItemsIntoKits(estimate.byCategory.accessories || []);
  const materialsItems = groupItemsIntoKits(estimate.byCategory.materials || []);
  const schaferItems = estimate.byCategory.schafer || [];
  const laborItems = estimate.byCategory.labor;
  const equipmentItems = estimate.byCategory.equipment;
  const optionalItems = estimate.optionalItems || [];

  const allItems: Array<{ item: LineItem & { subtitle?: string }; section: string; isOptional?: boolean }> = [
    ...materialsItems.map((item) => ({ item, section: sectionHeaders.materials })),
    ...schaferItems.map((item) => ({ item, section: sectionHeaders.materials })),
    ...consumablesItems.map((item) => ({ item, section: sectionHeaders.consumables })),
    ...accessoriesItems.map((item) => ({ item, section: sectionHeaders.accessories })),
    ...laborItems.map((item) => ({ item, section: sectionHeaders.labor })),
    ...equipmentItems.map((item) => ({ item, section: sectionHeaders.equipment })),
    ...optionalItems.map((item) => ({ item, section: 'OPTIONAL ITEMS (Not Included in Quote Total)', isOptional: true })),
  ];

  if (allItems.length === 0) {
    return pages;
  }

  // Precompute tiered sum for non-optional items; scale so total = finalPrice
  let tieredSum = 0;
  const tierMultipliers: number[] = [];
  allItems.forEach((entry, idx) => {
    if (entry.isOptional) {
      tierMultipliers[idx] = 1;
      return;
    }
    const m = getTierMultiplier(entry.item.total);
    tierMultipliers[idx] = m;
    tieredSum += entry.item.total * m;
  });
  const scaleFactor = tieredSum > 0 ? estimate.finalPrice / tieredSum : 1;
  
  // PASS 1: Track content for each page (without rendering)
  const pageContents: PageContent[] = [];
  let currentPageContent: PageContent = { items: [] };
  let currentSection = '';
  let currentY = CONTENT_Y_END; // Start from top of content area
  
  const font = await (await loadPDFTemplate('/templates/blank-page-estimate.pdf')).embedFont(StandardFonts.Helvetica);
  
  // Track content for each page
  for (let i = 0; i < allItems.length; i++) {
    const { item, section } = allItems[i];
    const sectionChanged = currentSection !== section;
    
    const itemName = item.name;
    const itemDescription = (item as LineItem & { proposalDescription?: string }).proposalDescription ?? '';
    const displayText = itemDescription ? `${itemName} — ${itemDescription}` : itemName;
    const maxDescWidth = DESC_COLUMN_WIDTH - ROW_PADDING * 2;
    const sectionHeaderHeight = sectionChanged ? 12 + SECTION_GAP_ABOVE + SECTION_GAP_BELOW : 0;
    const itemHeight = calculateRowHeight(displayText, font, 11, maxDescWidth, (item as { subtitle?: string }).subtitle);
    const spaceNeeded = sectionHeaderHeight + itemHeight;
    
    // Determine bottom margin: if this is the last item and would fit on current page,
    // use quote page margin (since it will be the last page). Otherwise use regular margin.
    // We need to check if this item would be the last item on what becomes the last page.
    // For now, use regular margin for all pages except when we know it's the final page.
    // The last page will be handled specially in PASS 2.
    const isLastItem = i === allItems.length - 1;
    const wouldBeLastPage = isLastItem && currentPageContent.items.length > 0;
    const bottomMargin = wouldBeLastPage ? QUOTE_PAGE_BOTTOM_MARGIN : REGULAR_PAGE_BOTTOM_MARGIN;
    const spaceAvailable = currentY - bottomMargin;
    const pageContentHeight = CONTENT_Y_END - bottomMargin;
    const spaceUsedPercent = 1 - spaceAvailable / pageContentHeight;

    // Smart page break: don't split Equipment section — if Equipment would start with <40% page left and has <4 items, push to next page
    const isEquipmentStart = section === sectionHeaders.equipment && currentSection !== section;
    const equipmentItemCount = equipmentItems.length;
    const shouldBreakForEquipment = isEquipmentStart && equipmentItemCount < 4 && spaceUsedPercent > 0.6;

    if (currentPageContent.items.length === 0 || spaceAvailable < spaceNeeded || shouldBreakForEquipment) {
      // Save previous page content if it exists
      if (currentPageContent.items.length > 0) {
        pageContents.push(currentPageContent);
      }
      
      // Start new page
      currentPageContent = { items: [] };
      currentY = CONTENT_Y_END; // Start from top of content area
      
      // If this is the last item and we're starting a new page, it will be the last page
      // So use quote page margin for space calculation
      if (isLastItem) {
        const spaceAvailableForLastPage = currentY - QUOTE_PAGE_BOTTOM_MARGIN;
        if (spaceAvailableForLastPage < spaceNeeded) {
          // This shouldn't happen if margins are correct, but handle it
          console.warn('Last item would not fit on final page with quote margin');
        }
      }
    }
    
    // Add item to current page content
    const multiplier = allItems[i].isOptional ? 1 : tierMultipliers[i] * scaleFactor;
    const clientPrice = Math.round(item.total * multiplier * 100) / 100;
    currentPageContent.items.push({
      item,
      section,
      itemName,
      itemDescription,
      price: clientPrice,
      isOptional: allItems[i].isOptional || false,
    });
    
    // Update Y position (section header when changed + item)
    currentY = currentY - (sectionChanged ? sectionHeaderHeight : 0) - itemHeight;
    
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
    const pageObliqueFont = await template.embedFont(StandardFonts.HelveticaOblique);
    const pages_array = template.getPages();
    const page = pages_array[0];
    
    let yPos = CONTENT_Y_END;
    let lastSection = '';
    
    for (let idx = 0; idx < pageContent.items.length; idx++) {
      const contentItem = pageContent.items[idx];
      const isFirstInSection = contentItem.section !== lastSection;
      if (isFirstInSection) {
        yPos = drawSectionHeader(page, yPos, contentItem.section, pageBoldFont);
        lastSection = contentItem.section;
      }
      const subtitle = (contentItem.item as any).subtitle;
      const newYPos = drawLineItemRow(page, yPos, contentItem.itemName, contentItem.itemDescription, formatCurrency(contentItem.price), pageFont, pageBoldFont, pageObliqueFont, isFirstInSection, contentItem.isOptional || false, subtitle, idx);
      if (newYPos < REGULAR_PAGE_BOTTOM_MARGIN) break;
      yPos = newYPos;
    }
    pages.push(template);
  }
  
  // PASS 2: Rebuild last page with Quote Total template
  if (pageContents.length > 0) {
    const lastPageContent = pageContents[pageContents.length - 1];
    const template = await loadPDFTemplate('/templates/blank-page-estimate-with-total.pdf');
    const pageFont = await template.embedFont(StandardFonts.Helvetica);
    const pageBoldFont = await template.embedFont(StandardFonts.HelveticaBold);
    const pageObliqueFont = await template.embedFont(StandardFonts.HelveticaOblique);
    const pages_array = template.getPages();
    const page = pages_array[0];
    
    let yPos = CONTENT_Y_END;
    let lastSection = '';
    
    for (let idx = 0; idx < lastPageContent.items.length; idx++) {
      const contentItem = lastPageContent.items[idx];
      const isFirstInSection = contentItem.section !== lastSection;
      if (isFirstInSection) {
        yPos = drawSectionHeader(page, yPos, contentItem.section, pageBoldFont);
        lastSection = contentItem.section;
      }
      const subtitle = (contentItem.item as any).subtitle;
      const newYPos = drawLineItemRow(page, yPos, contentItem.itemName, contentItem.itemDescription, formatCurrency(contentItem.price), pageFont, pageBoldFont, pageObliqueFont, isFirstInSection, contentItem.isOptional || false, subtitle, idx);
      if (newYPos < QUOTE_PAGE_BOTTOM_MARGIN) break;
      yPos = newYPos;
    }
    
    // Add Quote Total amount overlay - vertically centered in navy box (uses finalPrice which includes sales tax)
    const totalPrice = Math.round(estimate.finalPrice * 100) / 100;
    const priceText = formatCurrency(totalPrice);
    const priceWidth = pageBoldFont.widthOfTextAtSize(priceText, 14);
    const fontSize = 14;
    // Increase Y position by 4 points to properly center vertically
    const textY = QUOTE_TOTAL_Y + 4;
    
    page.drawText(priceText, {
      x: QUOTE_TOTAL_X - priceWidth,
      y: textY,
      size: fontSize,
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
  
  // Pricing header background (slightly lighter gray) - touch seamlessly with description header
  page.drawRectangle({
    x: PRICE_COLUMN_LEFT,
    y: headerBottom,
    width: PRICE_COLUMN_WIDTH,
    height: HEADER_HEIGHT,
    color: PRICE_HEADER_BG,
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

// Helper function to draw a line item row — format: **Name** — *Description* (bold name, oblique description)
function drawLineItemRow(
  page: any,
  y: number,
  itemName: string,
  itemDescription: string,
  priceText: string,
  font: any,
  boldFont: any,
  obliqueFont: any,
  isFirstInSection: boolean = false,
  isOptional: boolean = false,
  subtitle?: string,
  rowIndex: number = 0
): number {
  const maxDescWidth = DESC_COLUMN_WIDTH - ROW_PADDING * 2;
  const fontSize = 11;
  const subtitleFontSize = 9;
  const displayText = itemDescription ? `${itemName} — ${itemDescription}` : itemName;
  const lines = wordWrap(displayText, font, fontSize, maxDescWidth);
  let textHeight = lines.length * (fontSize + 5);
  if (subtitle) {
    const subtitleLines = wordWrap(subtitle, font, subtitleFontSize, maxDescWidth);
    textHeight += subtitleLines.length * (subtitleFontSize + 4) + 8;
  }
  const rowHeight = Math.max(ROW_HEIGHT_SINGLE, textHeight + ROW_PADDING_VERTICAL * 2);
  const rowBottom = y - rowHeight;

  if (rowIndex % 2 === 1 && !isOptional) {
    page.drawRectangle({ x: TABLE_LEFT, y: rowBottom, width: TABLE_WIDTH, height: rowHeight, color: rgb(0.976, 0.976, 0.976) });
  }
  if (isFirstInSection) {
    page.drawRectangle({ x: TABLE_LEFT, y, width: TABLE_WIDTH, height: BORDER_WIDTH, color: BORDER_COLOR });
  }
  page.drawRectangle({ x: TABLE_LEFT, y: rowBottom, width: TABLE_WIDTH, height: BORDER_WIDTH, color: BORDER_COLOR });
  page.drawRectangle({ x: TABLE_LEFT, y: rowBottom, width: BORDER_WIDTH, height: rowHeight, color: BORDER_COLOR });
  page.drawRectangle({ x: TABLE_RIGHT - BORDER_WIDTH, y: rowBottom, width: BORDER_WIDTH, height: rowHeight, color: BORDER_COLOR });
  page.drawRectangle({ x: PRICE_COLUMN_LEFT - BORDER_WIDTH / 2, y: rowBottom, width: BORDER_WIDTH, height: rowHeight, color: BORDER_COLOR });

  let totalTextHeight = lines.length * (fontSize + 5) - 5;
  if (subtitle) {
    totalTextHeight += wordWrap(subtitle, font, subtitleFontSize, maxDescWidth).length * (subtitleFontSize + 4) + 8;
  }
  const centerY = rowBottom + (rowHeight / 2);
  const textStartY = centerY + (totalTextHeight / 2) - fontSize;
  let textY = textStartY;
  const textColor = isOptional ? rgb(0.5, 0.5, 0.5) : rgb(0, 0, 0);

  const sep = ' — ';
  let seenSeparator = false;
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    let x = DESC_COLUMN_LEFT + ROW_PADDING;
    if (itemDescription && line.includes(sep)) {
      seenSeparator = true;
      const [before, after] = line.split(sep);
      if (before) {
        page.drawText(before, { x, y: textY, size: fontSize, font: boldFont, color: textColor });
        x += boldFont.widthOfTextAtSize(before, fontSize);
      }
      page.drawText(sep, { x, y: textY, size: fontSize, font, color: textColor });
      x += font.widthOfTextAtSize(sep, fontSize);
      if (after) {
        page.drawText(after, { x, y: textY, size: fontSize, font: obliqueFont, color: textColor });
      }
    } else if (itemDescription) {
      page.drawText(line, { x, y: textY, size: fontSize, font: seenSeparator ? obliqueFont : boldFont, color: textColor });
    } else {
      page.drawText(line, { x, y: textY, size: fontSize, font: boldFont, color: textColor });
    }
    textY -= fontSize + 5;
  }

  if (subtitle) {
    textY -= 8;
    for (const line of wordWrap(subtitle, font, subtitleFontSize, maxDescWidth)) {
      page.drawText(line, { x: DESC_COLUMN_LEFT + ROW_PADDING + 10, y: textY, size: subtitleFontSize, font, color: rgb(0.5, 0.5, 0.5) });
      textY -= subtitleFontSize + 4;
    }
  }

  if (priceText) {
    const priceWidth = font.widthOfTextAtSize(priceText, fontSize);
    const priceY = rowBottom + (rowHeight / 2) - (fontSize / 2) + 2;
    page.drawText(priceText, { x: PRICE_COLUMN_RIGHT - ROW_PADDING - priceWidth, y: priceY, size: fontSize, font, color: textColor });
  }
  return rowBottom;
}

// Helper function to draw section header row — clean navy text, no background/padding/border
function drawSectionHeader(page: any, y: number, sectionName: string, boldFont: any): number {
  const fontSize = 12;
  const headerHeight = fontSize;
  const headerBottom = y - SECTION_GAP_ABOVE - headerHeight - SECTION_GAP_BELOW;

  // Section name — 12pt bold navy #003366, no background, no padding, no border
  const textY = headerBottom + SECTION_GAP_BELOW;
  page.drawText(sectionName, {
    x: TABLE_LEFT,
    y: textY,
    size: fontSize,
    font: boldFont,
    color: rgb(0, 0.2, 0.4), // #003366 navy
  });

  return headerBottom;
}

// Main function to generate proposal PDF
export async function generateProposalPDF(estimate: Estimate, aiSuggestions?: string): Promise<Blob> {
  // Load static templates
  const coverPDF = await loadPDFTemplate('/templates/cover.pdf');
  const importantLinksPDF = await loadPDFTemplate('/templates/important-links.pdf');
  const referencesPDF = await loadPDFTemplate('/templates/references.pdf');
  
  // Generate introduction page — use custom intro from CSV if present, otherwise AI
  const intro = estimate.introLetterText
    ? parseIntroLetter(estimate.introLetterText)
    : await generateIntroductionLetter(estimate);
  const introPDF = await generateIntroductionPage(intro);
  
  // Generate line item pages (effective multiplier calculated inside)
  const lineItemPages = await generateLineItemPages(estimate);
  
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
