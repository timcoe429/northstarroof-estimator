import { describe, it, expect } from 'vitest';
import { recalculateFinancials } from '@/lib/recalculateFinancials';
import type { Estimate } from '@/types';

function makeBaseEstimate(): Estimate {
  return {
    lineItems: [],
    optionalItems: [],
    byCategory: {
      materials: [],
      consumables: [],
      labor: [],
      equipment: [],
      accessories: [],
      schafer: [],
    },
    totals: {
      materials: 15000,
      consumables: 1500,
      labor: 10000,
      equipment: 2000,
      accessories: 500,
      schafer: 0,
    },
    baseCost: 31000,
    officeCostPercent: 10,
    officeAllocation: 3100,
    totalCost: 34100,
    marginPercent: 40,
    wastePercent: 10,
    sundriesPercent: 10,
    sundriesAmount: 1500,
    sellPrice: 56833,
    salesTaxPercent: 10,
    salesTaxAmount: 5683,
    finalPrice: 62516,
    grossProfit: 22733,
    profitMargin: 40,
    measurements: {
      total_squares: 25,
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
  };
}

describe('recalculateFinancials', () => {
  it('adjust margin 40% to 50% increases finalPrice', () => {
    const base = makeBaseEstimate();
    const r40 = recalculateFinancials(base, {
      marginPercent: 40,
      wastePercent: 10,
      officePercent: 10,
      salesTaxPercent: 10,
    });
    const r50 = recalculateFinancials(base, {
      marginPercent: 50,
      wastePercent: 10,
      officePercent: 10,
      salesTaxPercent: 10,
    });
    expect(r50.finalPrice).toBeGreaterThan(r40.finalPrice);
    expect(r50.sellPrice).toBeGreaterThan(r40.sellPrice);
  });

  it('adjust waste 10% to 15% increases totalCost', () => {
    const base = makeBaseEstimate();
    const r10 = recalculateFinancials(base, {
      marginPercent: 40,
      wastePercent: 10,
      officePercent: 10,
      salesTaxPercent: 10,
    });
    const r15 = recalculateFinancials(base, {
      marginPercent: 40,
      wastePercent: 15,
      officePercent: 10,
      salesTaxPercent: 10,
    });
    expect(r15.baseCost).toBeGreaterThan(r10.baseCost);
    expect(r15.totalCost).toBeGreaterThan(r10.totalCost);
  });

  it('adjust office 10% to 12% increases totalCost', () => {
    const base = makeBaseEstimate();
    const r10 = recalculateFinancials(base, {
      marginPercent: 40,
      wastePercent: 10,
      officePercent: 10,
      salesTaxPercent: 10,
    });
    const r12 = recalculateFinancials(base, {
      marginPercent: 40,
      wastePercent: 10,
      officePercent: 12,
      salesTaxPercent: 10,
    });
    expect(r12.officeAllocation).toBeGreaterThan(r10.officeAllocation);
    expect(r12.totalCost).toBeGreaterThan(r10.totalCost);
  });

  it('adjust tax 10% to 0% decreases finalPrice', () => {
    const base = makeBaseEstimate();
    const r10 = recalculateFinancials(base, {
      marginPercent: 40,
      wastePercent: 10,
      officePercent: 10,
      salesTaxPercent: 10,
    });
    const r0 = recalculateFinancials(base, {
      marginPercent: 40,
      wastePercent: 10,
      officePercent: 10,
      salesTaxPercent: 0,
    });
    expect(r0.finalPrice).toBeLessThan(r10.finalPrice);
    expect(r0.salesTaxAmount).toBe(0);
  });

  it('compounds multiple slider adjustments correctly', () => {
    const base = makeBaseEstimate();
    const result = recalculateFinancials(base, {
      marginPercent: 50,
      wastePercent: 15,
      officePercent: 12,
      salesTaxPercent: 8,
    });
    expect(result.totalCost).toBeGreaterThan(base.totalCost);
    expect(result.sellPrice).toBeGreaterThan(base.sellPrice);
    expect(result.profitMargin).toBeGreaterThan(40);
  });
});
