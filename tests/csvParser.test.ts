import { describe, it, expect } from 'vitest';
import { parseEstimateCSV } from '@/lib/csvParser';

describe('parseEstimateCSV', () => {
  it('parses valid CSV to Estimate with byCategory', () => {
    const csv = `Name,Address,Description,Quantity,Unit,Unit Price,Total,Category,Notes
John Smith,123 Main St,Brava Field Tile,28,bundle,43.25,1211,materials,
,,Hugo (standard),25,sq,550,13750,labor,
,,Porto Potty,1,flat,600,600,equipment,`;

    const result = parseEstimateCSV(csv);
    expect(result.success).toBe(true);
    expect(result.estimate).toBeDefined();
    expect(result.estimate!.byCategory.materials).toHaveLength(1);
    expect(result.estimate!.byCategory.materials[0].name).toBe('Brava Field Tile');
    expect(result.estimate!.byCategory.consumables).toHaveLength(1);
    expect(result.estimate!.byCategory.consumables![0].name).toBe('Consumables & Hardware');
    expect(result.estimate!.byCategory.consumables![0].total).toBeCloseTo(121.1, 1); // 10% of 1211 materials
    expect(result.estimate!.byCategory.labor).toHaveLength(1);
    expect(result.estimate!.byCategory.equipment).toHaveLength(1);
    expect(result.estimate!.customerInfo.name).toBe('John Smith');
    expect(result.estimate!.customerInfo.address).toBe('123 Main St');
  });

  it('uses defaults when optional fields missing', () => {
    const csv = `Description,Quantity,Unit,Unit Price,Total,Category
Brava Field Tile,28,bundle,43.25,1211,materials`;

    const result = parseEstimateCSV(csv);
    expect(result.success).toBe(true);
    expect(result.estimate!.customerInfo.name).toBe('');
    expect(result.estimate!.customerInfo.address).toBe('');
    expect(result.estimate!.marginPercent).toBe(40);
    expect(result.estimate!.wastePercent).toBe(10);
  });

  it('routes isOptional items to optionalItems', () => {
    const csv = `Description,Quantity,Unit,Unit Price,Total,Category,Notes
Brava Field Tile,28,bundle,43.25,1211,materials,
Skylight,1,each,2400,2400,accessories,Optional - not included`;

    const result = parseEstimateCSV(csv);
    expect(result.success).toBe(true);
    expect(result.estimate!.lineItems).toHaveLength(1);
    expect(result.estimate!.optionalItems).toHaveLength(1);
    expect(result.estimate!.optionalItems[0].name).toBe('Skylight');
    expect(result.estimate!.optionalItems[0].isOptional).toBe(true);
  });

  it('returns error for invalid CSV format - missing columns', () => {
    const csv = `Col1,Col2
a,b`;

    const result = parseEstimateCSV(csv);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it('returns error for CSV with only header', () => {
    const csv = `Description,Quantity,Category`;

    const result = parseEstimateCSV(csv);
    expect(result.success).toBe(false);
    expect(result.errors).toContain('CSV must have a header row and at least one data row');
  });

  it('handles Item column as fallback for Description', () => {
    const csv = `Item,Quantity,Unit Price,Total,Category
Some Material,10,50,500,materials`;

    const result = parseEstimateCSV(csv);
    expect(result.success).toBe(true);
    expect(result.estimate!.byCategory.materials[0].name).toBe('Some Material');
  });

  it('normalizes Landfill Charge to Debris Haulaway & Landfill', () => {
    const csv = `Description,Quantity,Unit,Unit Price,Total,Category
Landfill Charge,1,each,750,750,equipment`;

    const result = parseEstimateCSV(csv);
    expect(result.success).toBe(true);
    expect(result.estimate!.byCategory.equipment).toHaveLength(1);
    expect(result.estimate!.byCategory.equipment[0].name).toBe('Debris Haulaway & Landfill');
  });

  it('skips Rolloff (use trailer, not rolloff)', () => {
    const csv = `Description,Quantity,Unit,Unit Price,Total,Category
Porto Potty,1,flat,600,600,equipment,
Rolloff,1,flat,750,750,equipment,
Debris Haulaway & Landfill,1,each,750,750,equipment`;

    const result = parseEstimateCSV(csv);
    expect(result.success).toBe(true);
    const equipment = result.estimate!.byCategory.equipment;
    expect(equipment).toHaveLength(2); // Porto Potty + Debris Haulaway (Rolloff skipped)
    expect(equipment.some((e) => e.name.toLowerCase().includes('rolloff'))).toBe(false);
  });
});
