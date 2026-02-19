import type { Estimate, LineItem, Measurements, CustomerInfo } from '@/types';

const VALID_CATEGORIES = ['materials', 'labor', 'equipment', 'accessories', 'schafer'] as const;
type Category = (typeof VALID_CATEGORIES)[number];

export interface ParseResult {
  success: boolean;
  estimate?: Estimate;
  errors?: string[];
}

const SUNDRIES_PERCENT = 10;
const DEFAULT_MARGIN = 40;
const DEFAULT_WASTE = 10;
const DEFAULT_OFFICE = 10;
const DEFAULT_TAX = 10;

/**
 * Parse a CSV row handling quoted fields with commas
 */
function parseCSVRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (inQuotes) {
      current += char;
    } else if (char === ',') {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Normalize CSV header to canonical name (case-insensitive)
 */
function normalizeHeader(header: string): string {
  const map: Record<string, string> = {
    building: 'building',
    name: 'name',
    address: 'address',
    item: 'item',
    description: 'description',
    desc: 'description',
    quantity: 'quantity',
    qty: 'quantity',
    unit: 'unit',
    'unit price': 'unitprice',
    unitprice: 'unitprice',
    price: 'unitprice',
    total: 'total',
    category: 'category',
    cat: 'category',
    notes: 'notes',
    optional: 'notes',
  };
  return map[header.toLowerCase().trim()] || header.toLowerCase().trim();
}

/**
 * Map CSV category value to valid category
 */
function normalizeCategory(value: string): Category {
  const v = value.toLowerCase().trim();
  if (v === 'material' || v === 'mats') return 'materials';
  if (v === 'vendor' || v === 'schafer') return 'schafer';
  if (VALID_CATEGORIES.includes(v as Category)) return v as Category;
  return 'materials'; // default
}

/**
 * Check if category is Intro (case-insensitive) — not a line item, used for PDF intro letter
 */
function isIntroCategory(value: string): boolean {
  return value.toLowerCase().trim() === 'intro';
}

/**
 * Check if item is optional from Notes column
 */
function isOptionalFromNotes(notes: string): boolean {
  if (!notes) return false;
  const n = notes.toLowerCase();
  return (
    n.includes('optional') ||
    n.includes('not included') ||
    n.includes('excluded') ||
    n.includes('separate')
  );
}

function toNum(val: string): number {
  const cleaned = (val || '').replace(/[$,]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/** Normalize display name (e.g., Landfill Charge → Debris Haulaway & Landfill) */
function normalizeItemName(name: string): string {
  const n = name.trim();
  if (n.toLowerCase() === 'landfill charge') return 'Debris Haulaway & Landfill';
  return n;
}

/** Skip items we no longer use (e.g., Rolloff — replaced by trailer/debris haulaway) */
function shouldSkipItem(name: string): boolean {
  const n = name.toLowerCase().trim();
  return n === 'rolloff' || n === 'roll-off' || n === 'roll off';
}

const MINIMAL_MEASUREMENTS: Measurements = {
  total_squares: 0,
  predominant_pitch: '0/12',
  ridge_length: 0,
  hip_length: 0,
  valley_length: 0,
  eave_length: 0,
  rake_length: 0,
  penetrations: 0,
  skylights: 0,
  chimneys: 0,
  complexity: 'standard',
};

/**
 * Parse CSV text into an Estimate object
 */
export function parseEstimateCSV(csvText: string): ParseResult {
  const errors: string[] = [];
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());

  if (lines.length < 2) {
    return {
      success: false,
      errors: ['CSV must have a header row and at least one data row'],
    };
  }

  const headerRow = parseCSVRow(lines[0]);
  const headers = headerRow.map(normalizeHeader);

  const hasColumn = (name: string) => headers.indexOf(name) >= 0;
  const needDesc = hasColumn('description') || hasColumn('item');
  const needCategory = hasColumn('category');

  if (!needDesc) {
    errors.push('CSV must have Description or Item column');
  }
  if (!needCategory) {
    errors.push('CSV must have Category column');
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const lineItems: LineItem[] = [];
  const optionalItems: LineItem[] = [];
  const introLetterParts: string[] = [];
  let customerName = '';
  let customerAddress = '';

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVRow(lines[i]);
    if (cells.every((c) => !c.trim())) continue;

    const getCell = (name: string) => {
      const idx = headers.indexOf(name);
      return idx >= 0 ? (cells[idx] || '').trim() : '';
    };

    if (i === 1 && getCell('name')) {
      customerName = getCell('name');
    }
    if (i === 1 && getCell('address')) {
      customerAddress = getCell('address');
    }

    const categoryRaw = getCell('category');
    if (isIntroCategory(categoryRaw)) {
      const desc = getCell('description') || getCell('item') || '';
      if (desc.trim()) introLetterParts.push(desc.trim());
      continue;
    }

    const itemCol = getCell('item');
    const descCol = getCell('description');
    const name = normalizeItemName(itemCol || descCol || 'Unnamed Item');
    if (shouldSkipItem(name)) continue;
    const proposalDescription = itemCol && descCol ? descCol.trim() : '';
    const quantity = toNum(getCell('quantity'));
    const unit = getCell('unit') || 'each';
    const price = toNum(getCell('unitprice'));
    const total = toNum(getCell('total'));
    const category = normalizeCategory(categoryRaw);
    const isOptional = isOptionalFromNotes(getCell('notes'));

    const item: LineItem = {
      id: `csv_${i}`,
      name,
      unit,
      price: price || (quantity && total ? total / quantity : 0),
      coverage: null,
      coverageUnit: null,
      category,
      baseQuantity: quantity,
      quantity,
      total: total || quantity * (price || 0),
      wasteAdded: 0,
      isOptional,
      ...(proposalDescription ? { proposalDescription } : {}),
    };

    if (isOptional) {
      optionalItems.push(item);
    } else {
      lineItems.push(item);
    }
  }

  const byCategory: Estimate['byCategory'] = {
    materials: [],
    consumables: [],
    labor: [],
    equipment: [],
    accessories: [],
    schafer: [],
  };

  for (const item of lineItems) {
    if (byCategory[item.category]) {
      byCategory[item.category].push(item);
    }
  }

  const totals: Estimate['totals'] = {
    materials: byCategory.materials.reduce((s, i) => s + i.total, 0),
    labor: byCategory.labor.reduce((s, i) => s + i.total, 0),
    equipment: byCategory.equipment.reduce((s, i) => s + i.total, 0),
    accessories: byCategory.accessories.reduce((s, i) => s + i.total, 0),
    schafer: byCategory.schafer.reduce((s, i) => s + i.total, 0),
  };

  // Add consumables (sundries) as explicit line — 10% of materials + schafer
  const consumablesTotal = (totals.materials + totals.schafer) * (SUNDRIES_PERCENT / 100);
  byCategory.consumables = [{
    id: 'consumables',
    name: 'Consumables & Hardware',
    unit: 'each',
    price: consumablesTotal,
    coverage: null,
    coverageUnit: null,
    category: 'consumables',
    baseQuantity: 1,
    quantity: 1,
    total: consumablesTotal,
    wasteAdded: 0,
  }];
  totals.consumables = consumablesTotal;

  const customerInfo: CustomerInfo = {
    name: customerName,
    address: customerAddress,
    phone: '',
  };

  const rawCost = Object.values(totals).reduce((a, b) => a + b, 0);
  const materialsSchafer = totals.materials + totals.schafer;
  const sundriesAmount = materialsSchafer * (SUNDRIES_PERCENT / 100);
  const wasteAllowance = materialsSchafer * (DEFAULT_WASTE / 100);
  const baseCost = rawCost + wasteAllowance + sundriesAmount;
  const officeAllocation = baseCost * (DEFAULT_OFFICE / 100);
  const totalCost = baseCost + officeAllocation;
  const sellPrice = totalCost / (1 - DEFAULT_MARGIN / 100);
  const salesTaxAmount = sellPrice * (DEFAULT_TAX / 100);
  const finalPrice = sellPrice + salesTaxAmount;
  const grossProfit = sellPrice - totalCost;
  const profitMargin = sellPrice > 0 ? (grossProfit / sellPrice) * 100 : 0;

  const estimate: Estimate = {
    lineItems,
    optionalItems,
    byCategory,
    totals,
    baseCost,
    officeCostPercent: DEFAULT_OFFICE,
    officeAllocation,
    totalCost,
    marginPercent: DEFAULT_MARGIN,
    wastePercent: DEFAULT_WASTE,
    sundriesPercent: SUNDRIES_PERCENT,
    sundriesAmount,
    sellPrice,
    salesTaxPercent: DEFAULT_TAX,
    salesTaxAmount,
    finalPrice,
    grossProfit,
    profitMargin,
    measurements: MINIMAL_MEASUREMENTS,
    customerInfo,
    generatedAt: new Date().toLocaleString(),
    ...(introLetterParts.length > 0 ? { introLetterText: introLetterParts.join('\n\n') } : {}),
  };

  return { success: true, estimate };
}

/**
 * CSV template with correct equipment (no Rolloff; Debris Haulaway & Landfill).
 * Equipment: Porto Potty, Fuel Charge, Debris Haulaway & Landfill, Overnight Charge (when Hugo crew).
 */
export const CSV_TEMPLATE = `Name,Address,Description,Quantity,Unit,Unit Price,Total,Category,Notes
Customer Name,123 Main St,Brava Field Tile,28,bundle,43.25,1211,materials,
,,Hugo (standard),25,sq,550,13750,labor,
,,Porto Potty,1,flat,600,600,equipment,
,,Fuel Charge,1,each,194,194,equipment,
,,Debris Haulaway & Landfill,1,each,750,750,equipment,
,,Overnight Charge,1,flat,387,387,equipment,Only when crew is Hugo
`;

/** Download CSV template file */
export function downloadCSVTemplate(): void {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'estimate_template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
