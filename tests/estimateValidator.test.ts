import { describe, it, expect } from 'vitest';
import { validateEstimate } from '@/lib/estimateValidator';
import type { Estimate, LineItem } from '@/types';

function makeEstimate(overrides: Partial<Estimate> = {}): Estimate {
  const item: LineItem = {
    id: '1',
    name: 'Brava Field Tile',
    unit: 'bundle',
    price: 43.25,
    coverage: null,
    coverageUnit: null,
    category: 'materials',
    baseQuantity: 28,
    quantity: 28,
    total: 1211,
    wasteAdded: 0,
  };
  return {
    lineItems: [item],
    optionalItems: [],
    byCategory: {
      materials: [item],
      consumables: [],
      labor: [],
      equipment: [],
      accessories: [],
      schafer: [],
    },
    totals: {
      materials: 1211,
      consumables: 0,
      labor: 0,
      equipment: 0,
      accessories: 0,
      schafer: 0,
    },
    baseCost: 15000,
    officeCostPercent: 10,
    officeAllocation: 1500,
    totalCost: 16500,
    marginPercent: 40,
    wastePercent: 10,
    sundriesPercent: 10,
    sundriesAmount: 121.1,
    sellPrice: 27500,
    salesTaxPercent: 10,
    salesTaxAmount: 2750,
    finalPrice: 30250,
    grossProfit: 11000,
    profitMargin: 40,
    measurements: {
      total_squares: 0,
      predominant_pitch: '7/12',
      ridge_length: 0,
      hip_length: 0,
      valley_length: 0,
      eave_length: 0,
      rake_length: 0,
      penetrations: 0,
      skylights: 0,
      chimneys: 0,
      complexity: 'standard',
    },
    customerInfo: { name: '', address: '', phone: '' },
    generatedAt: '',
    ...overrides,
  };
}

describe('validateEstimate', () => {
  it('returns isValid true for valid estimate', () => {
    const estimate = makeEstimate();
    const result = validateEstimate(estimate);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('flags line total mismatch', () => {
    const estimate = makeEstimate();
    estimate.lineItems[0].total = 999;
    const result = validateEstimate(estimate);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('does not match quantity'))).toBe(true);
  });

  it('flags category sum mismatch', () => {
    const estimate = makeEstimate();
    estimate.totals.materials = 500;
    const result = validateEstimate(estimate);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('Category "materials"'))).toBe(true);
  });

  it('flags margin < 25% as warning', () => {
    const estimate = makeEstimate({ marginPercent: 18 });
    const result = validateEstimate(estimate);
    expect(result.isValid).toBe(true);
    expect(result.warnings.some((w) => w.includes('Margin is low'))).toBe(true);
  });
});
