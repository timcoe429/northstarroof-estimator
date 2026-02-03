import type { PriceItem } from '@/types';

export interface HeatTapeCalc {
  eaveLength: number;
  valleyLength: number;
  triangles: number;
  eaveCable: number;
  valleyCable: number;
  totalLF: number;
  materialCost: number;
  laborCost: number;
}

export interface SnowRetentionCalc {
  eaveLength: number;
  pitch: string;
  numRows: number;
  totalQuantity: number;
  unit: 'lf' | 'each';
  materialCost: number;
  laborCost: number;
  type: 'snowguard' | 'snowfence';
}

/**
 * Parse pitch string (e.g., "7/12") to numeric value
 */
export function parsePitch(pitch: string): number {
  const match = pitch.match(/(\d+)\/(\d+)/);
  if (!match) return 7; // Default to 7/12 if can't parse
  return parseInt(match[1], 10);
}

/**
 * Get number of rows needed based on roof pitch
 * 1-4/12: 1 row
 * 5-7/12: 2 rows
 * 8-10/12: 3 rows
 * 11-12/12: 4 rows
 */
export function getRowsForPitch(pitch: string): number {
  const pitchNum = parsePitch(pitch);
  if (pitchNum <= 4) return 1;
  if (pitchNum <= 7) return 2;
  if (pitchNum <= 10) return 3;
  return 4; // 11-12/12
}

/**
 * Calculate heat tape requirements
 * Formula: triangles = eave_length ÷ 3
 * eave_cable = triangles × 6 (each triangle is 3' up + 3' down = 6 LF)
 * valley_cable = valley_length (straight run, full length)
 * total_heat_tape = eave_cable + valley_cable
 */
export function calculateHeatTape(
  eave: number,
  valley: number,
  materialPrice: number = 5.0,
  laborPrice: number = 7.5
): HeatTapeCalc {
  const triangles = Math.ceil(eave / 3);
  const eaveCable = triangles * 6; // 3' up + 3' down per triangle
  const valleyCable = valley;
  const totalLF = eaveCable + valleyCable;
  
  return {
    eaveLength: eave,
    valleyLength: valley,
    triangles,
    eaveCable,
    valleyCable,
    totalLF,
    materialCost: totalLF * materialPrice,
    laborCost: totalLF * laborPrice,
  };
}

/**
 * Calculate snow guard requirements
 * Formula: guards_per_row = eave_length (1 guard per foot)
 * num_rows = based on pitch
 * total_guards = guards_per_row × num_rows
 */
export function calculateSnowGuards(
  eave: number,
  pitch: string,
  materialPrice: number = 7.0,
  laborPrice: number = 5.0
): SnowRetentionCalc {
  const numRows = getRowsForPitch(pitch);
  const totalQuantity = eave * numRows;
  
  return {
    eaveLength: eave,
    pitch,
    numRows,
    totalQuantity,
    unit: 'each',
    materialCost: totalQuantity * materialPrice,
    laborCost: totalQuantity * laborPrice,
    type: 'snowguard',
  };
}

/**
 * Calculate snow fence requirements (for metal roofs)
 * Formula: num_rows = based on pitch
 * linear_feet = eave_length × num_rows
 */
export function calculateSnowFence(
  eave: number,
  pitch: string,
  materialPrice: number = 12.0,
  laborPrice: number = 5.0
): SnowRetentionCalc {
  const numRows = getRowsForPitch(pitch);
  const totalQuantity = eave * numRows;
  
  return {
    eaveLength: eave,
    pitch,
    numRows,
    totalQuantity,
    unit: 'lf',
    materialCost: totalQuantity * materialPrice,
    laborCost: totalQuantity * laborPrice,
    type: 'snowfence',
  };
}

/**
 * Find price item by name (case-insensitive, partial match)
 */
export function findPriceItemByName(
  priceItems: PriceItem[],
  searchName: string,
  category?: PriceItem['category']
): PriceItem | undefined {
  const lowerSearch = searchName.toLowerCase();
  return priceItems.find(item => {
    const matchesCategory = !category || item.category === category;
    const matchesName = item.name.toLowerCase().includes(lowerSearch);
    return matchesCategory && matchesName;
  });
}

/**
 * Get prices for accessory items from price list
 */
export function getAccessoryPrices(priceItems: PriceItem[]): {
  heatTapeMaterial: number;
  heatTapeLabor: number;
  snowFenceMaterial: number;
  snowFenceLabor: number;
  snowGuardMaterial: number;
  snowGuardLabor: number;
  skylight: number;
} {
  const heatTape = findPriceItemByName(priceItems, 'Heat Tape', 'materials') || 
                   findPriceItemByName(priceItems, 'Heat Tape', 'accessories');
  const heatTapeInstall = findPriceItemByName(priceItems, 'Heat Tape Install', 'labor') ||
                          findPriceItemByName(priceItems, 'Heat Tape', 'labor');
  
  const snowFence = findPriceItemByName(priceItems, 'Snow Fence', 'materials') ||
                    findPriceItemByName(priceItems, 'ColorGard', 'materials') ||
                    findPriceItemByName(priceItems, 'Snow Fence', 'accessories');
  const snowFenceInstall = findPriceItemByName(priceItems, 'Snow Fence Install', 'labor') ||
                           findPriceItemByName(priceItems, 'Snow Fence', 'labor');
  
  const snowGuard = findPriceItemByName(priceItems, 'RMSG Yeti Snowguard', 'materials') ||
                    findPriceItemByName(priceItems, 'Snowguard', 'materials') ||
                    findPriceItemByName(priceItems, 'Snow Guard', 'materials');
  const snowGuardInstall = findPriceItemByName(priceItems, 'Snowguard Install', 'labor') ||
                           findPriceItemByName(priceItems, 'Snow Guard Install', 'labor');
  
  const skylight = findPriceItemByName(priceItems, 'Skylight', 'accessories') ||
                   findPriceItemByName(priceItems, 'Skylight', 'materials');
  
  return {
    heatTapeMaterial: heatTape?.price ?? 5.0,
    heatTapeLabor: heatTapeInstall?.price ?? 7.5,
    snowFenceMaterial: snowFence?.price ?? 12.0,
    snowFenceLabor: snowFenceInstall?.price ?? 5.0,
    snowGuardMaterial: snowGuard?.price ?? 7.0,
    snowGuardLabor: snowGuardInstall?.price ?? 5.0,
    skylight: skylight?.price ?? 2400.0,
  };
}
