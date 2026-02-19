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
async function generateIntroductionLetter(
  customerName: string,
  customerAddress: string,
  projectItems: string[],
  aiSuggestions?: string
): Promise<StructuredIntro> {
  const prompt = `You are Omiah Travis, owner of Northstar Roofing in Aspen, Colorado. Write a sincere, professional introduction letter for a roofing proposal.

CUSTOMER NAME: ${customerName}
PROJECT ADDRESS: ${customerAddress}

PROJECT ITEMS:
${projectItems.length > 0 ? projectItems.map(item => `- ${item}`).join('\n') : '- Standard roofing materials'}
${aiSuggestions ? `\nSTRUCTURE INFORMATION (mention in opening/body to personalize for multi-structure properties):\n${aiSuggestions}\n` : ''}

Write a warm, personalized thank you letter that:
- Addresses the customer by name
- References the property location/address naturally (e.g., "your beautiful home on [street]" or "your property at [address]")
- Mentions the specific roofing system and notable features being installed
- Sounds genuinely appreciative, not generic or salesy
- Emphasizes Northstar's commitment to quality craftsmanship

Return the letter content in this EXACT structure with labeled sections. NO markdown, NO asterisks, NO formatting characters. Plain text only.

GREETING
Dear ${customerName},

OPENING
[One warm sentence thanking them sincerely, can reference the property location]

BODY_PARA_1
[2-3 sentences about the project, mention the roofing system, notable features, and how it will benefit their specific property]

BODY_PARA_2
[1-2 sentences about Northstar's commitment to quality and treating every project like their own home]

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
    const intro = parseStructuredIntro(text.trim(), customerName);
    if (aiSuggestions && intro.opening) {
      intro.opening = `Thank you for the opportunity to provide an estimate for your property. ${aiSuggestions}`;
    }
    return intro;
  } catch (error) {
    console.error('Error generating introduction:', error);
    // Fallback
    const fallback: StructuredIntro = {
      greeting: `Dear ${customerName},`,
      opening: aiSuggestions
        ? `Thank you for the opportunity to provide an estimate for your property. ${aiSuggestions}`
        : 'Thank you for giving Northstar Roofing the opportunity to provide an estimate for your roofing project.',
      bodyPara1: 'This proposal includes a detailed breakdown of materials, labor, and equipment for your project. We\'ve carefully selected quality materials and components to ensure a durable, professional installation.',
      bodyPara2: 'We take pride in our workmanship and attention to detail.',
      bullet1: 'Detailed line item estimate breaking down all materials and labor',
      bullet2: 'Important links including terms, exclusions, and warranty info',
      bullet3: 'References from past clients',
      closingPara: 'If you have any questions, please don\'t hesitate to reach out.',
    };
    return fallback;
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

// Generate introduction page
async function generateIntroductionPage(intro: StructuredIntro): Promise<PDFDocument> {
  const template = await loadPDFTemplate('/templates/thank-you.pdf');
  const pages = template.getPages();
  const page = pages[0];
  const { height } = page.getSize();
  
  const font = await template.embedFont(StandardFonts.Helvetica);
  const boldFont = await template.embedFont(StandardFonts.HelveticaBold);
  
  const maxLineWidth = 500;
  const textX = CONTENT_X_START + 50; // Start a bit indented
  
  // PASS 1: Calculate total content height
  let totalHeight = 0;
  
  // GREETING
  const greetingLines = wordWrap(intro.greeting, font, 11, maxLineWidth);
  totalHeight += greetingLines.length * (11 + 2); // Line height + spacing
  totalHeight += 20; // After greeting spacing
  
  // OPENING
  const openingLines = wordWrap(intro.opening, boldFont, 14, maxLineWidth);
  totalHeight += openingLines.length * (14 + 2);
  totalHeight += 15; // After opening spacing
  
  // BODY_PARA_1
  let body1Lines: string[] = [];
  if (intro.bodyPara1) {
    body1Lines = wordWrap(intro.bodyPara1, font, 11, maxLineWidth);
    totalHeight += body1Lines.length * (11 + 2);
    totalHeight += 12; // Between paragraphs spacing
  }
  
  // BODY_PARA_2
  let body2Lines: string[] = [];
  if (intro.bodyPara2) {
    body2Lines = wordWrap(intro.bodyPara2, font, 11, maxLineWidth);
    totalHeight += body2Lines.length * (11 + 2);
    totalHeight += 15; // Before "What's Included" spacing
  }
  
  // "What's Included" header
  totalHeight += 11 + 8; // Header + spacing
  
  // Bullets
  const bullets = [intro.bullet1, intro.bullet2, intro.bullet3];
  for (const bullet of bullets) {
    const bulletText = `• ${bullet}`;
    const bulletLines = wordWrap(bulletText, font, 11, maxLineWidth);
    totalHeight += bulletLines.length * (11 + 2);
    totalHeight += 6; // Between bullets spacing
  }
  totalHeight -= 6; // Remove last bullet spacing
  totalHeight += 15; // After last bullet spacing
  
  // CLOSING_PARA
  const closingLines = wordWrap(intro.closingPara, font, 11, maxLineWidth);
  totalHeight += closingLines.length * (11 + 2);
  totalHeight += 20; // Before "Best regards," spacing
  
  // Signature block
  totalHeight += 11 + 8; // "Best regards,"
  totalHeight += 11 + 2; // "Omiah Travis"
  totalHeight += 11 + 12; // "Northstar Roofing"
  totalHeight += 10 + 4; // Email
  totalHeight += 10; // Phone (last item, no spacing after)
  
  // Calculate available height and center content
  const availableHeight = CONTENT_Y_END - CONTENT_Y_START;
  const startY = CONTENT_Y_END - ((availableHeight - totalHeight) / 2);
  
  // PASS 2: Draw content starting from centered position
  let y = startY;
  
  // GREETING: Helvetica, 11pt, #000000
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
  if (intro.bodyPara1 && body1Lines.length > 0) {
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
  if (intro.bodyPara2 && body2Lines.length > 0) {
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
  items: Array<{ item: any; section: string; descLines: string[]; price: number; isOptional?: boolean }>;
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
    
    const description = item.name;
    const maxDescWidth = DESC_COLUMN_WIDTH - ROW_PADDING * 2;
    const sectionHeaderHeight = sectionChanged ? 12 + SECTION_GAP_ABOVE + SECTION_GAP_BELOW : 0;
    const itemHeight = calculateRowHeight(description, font, 11, maxDescWidth, (item as { subtitle?: string }).subtitle);
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
      descLines: wordWrap(description, font, 11, maxDescWidth),
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
    const pages_array = template.getPages();
    const page = pages_array[0];
    
    // Start from top of content area (no table header)
    let yPos = CONTENT_Y_END;
    
    // Draw page content
    let lastSection = '';
    
    for (let idx = 0; idx < pageContent.items.length; idx++) {
      const contentItem = pageContent.items[idx];
      const isFirstInSection = contentItem.section !== lastSection;
      if (isFirstInSection) {
        yPos = drawSectionHeader(page, yPos, contentItem.section, pageBoldFont);
        lastSection = contentItem.section;
      }
      
      const description = contentItem.item.name;
      const priceText = formatCurrency(contentItem.price);
      const subtitle = (contentItem.item as any).subtitle;
      const newYPos = drawLineItemRow(page, yPos, description, priceText, pageFont, isFirstInSection, contentItem.isOptional || false, subtitle, idx);
      
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
    const pages_array = template.getPages();
    const page = pages_array[0];
    
    // Start from top of content area (no table header)
    let yPos = CONTENT_Y_END;
    
    // Draw page content
    let lastSection = '';
    
    for (let idx = 0; idx < lastPageContent.items.length; idx++) {
      const contentItem = lastPageContent.items[idx];
      const isFirstInSection = contentItem.section !== lastSection;
      if (isFirstInSection) {
        yPos = drawSectionHeader(page, yPos, contentItem.section, pageBoldFont);
        lastSection = contentItem.section;
      }
      
      const description = contentItem.item.name;
      const priceText = formatCurrency(contentItem.price);
      const subtitle = (contentItem.item as any).subtitle;
      const newYPos = drawLineItemRow(page, yPos, description, priceText, pageFont, isFirstInSection, contentItem.isOptional || false, subtitle, idx);
      
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

// Helper function to draw a line item row
function drawLineItemRow(
  page: any, 
  y: number, 
  description: string, 
  price: string, 
  font: any, 
  isFirstInSection: boolean = false,
  isOptional: boolean = false,
  subtitle?: string,
  rowIndex: number = 0
): number {
  const maxDescWidth = DESC_COLUMN_WIDTH - ROW_PADDING * 2;
  const fontSize = 11;
  const subtitleFontSize = 9;
  
  const lines = wordWrap(description, font, fontSize, maxDescWidth);
  let textHeight = lines.length * (fontSize + 5);
  
  if (subtitle) {
    const subtitleLines = wordWrap(subtitle, font, subtitleFontSize, maxDescWidth);
    textHeight += subtitleLines.length * (subtitleFontSize + 4) + 8;
  }
  
  const rowHeight = Math.max(ROW_HEIGHT_SINGLE, textHeight + ROW_PADDING_VERTICAL * 2);
  
  const rowBottom = y - rowHeight;
  
  // Alternating row background (every other row light gray)
  if (rowIndex % 2 === 1 && !isOptional) {
    page.drawRectangle({
      x: TABLE_LEFT,
      y: rowBottom,
      width: TABLE_WIDTH,
      height: rowHeight,
      color: rgb(0.976, 0.976, 0.976), // #f9f9f9
    });
  }
  
  if (isFirstInSection) {
    page.drawRectangle({
      x: TABLE_LEFT,
      y: y,  // Top of this row
      width: TABLE_WIDTH,
      height: BORDER_WIDTH,
      color: BORDER_COLOR,
    });
  }
  
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
  
  let totalTextHeight = lines.length * (fontSize + 5) - 5;
  if (subtitle) {
    const subtitleLines = wordWrap(subtitle, font, subtitleFontSize, maxDescWidth);
    totalTextHeight += subtitleLines.length * (subtitleFontSize + 4) + 8;
  }
  
  const centerY = rowBottom + (rowHeight / 2);
  const textStartY = centerY + (totalTextHeight / 2) - fontSize;
  let textY = textStartY;
  
  // Use lighter gray color for optional items
  const textColor = isOptional ? rgb(0.5, 0.5, 0.5) : rgb(0, 0, 0);
  
  for (const line of lines) {
    page.drawText(line, {
      x: DESC_COLUMN_LEFT + ROW_PADDING,
      y: textY,
      size: fontSize,
      font: font,
      color: textColor,
    });
    textY -= (fontSize + 5);
  }
  
  if (subtitle) {
    textY -= 8;
    const subtitleLines = wordWrap(subtitle, font, subtitleFontSize, maxDescWidth);
    for (const line of subtitleLines) {
      page.drawText(line, {
        x: DESC_COLUMN_LEFT + ROW_PADDING + 10,
        y: textY,
        size: subtitleFontSize,
        font: font,
        color: rgb(0.5, 0.5, 0.5),
      });
      textY -= (subtitleFontSize + 4);
    }
  }
  
  // Price text - vertically centered
  if (price) {
    const priceWidth = font.widthOfTextAtSize(price, fontSize);
    const priceY = rowBottom + (rowHeight / 2) - (fontSize / 2) + 2;
    page.drawText(price, {
      x: PRICE_COLUMN_RIGHT - ROW_PADDING - priceWidth,
      y: priceY,
      size: fontSize,
      font: font,
      color: textColor,
    });
  }
  
  return rowBottom; // Return Y position for next row
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
  
  // Generate introduction page
  const customerName = estimate.customerInfo.name || 'Valued Customer';
  const customerAddress = estimate.customerInfo.address || '';
  const projectItems = extractNotableItems(estimate);
  const intro = await generateIntroductionLetter(customerName, customerAddress, projectItems, aiSuggestions);
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
