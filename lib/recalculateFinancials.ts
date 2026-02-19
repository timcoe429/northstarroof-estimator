import type { Estimate } from '@/types';

const SUNDRIES_PERCENT = 10;

export interface Financials {
  marginPercent: number;
  wastePercent: number;
  officePercent: number;
  salesTaxPercent: number;
}

/**
 * Recalculate estimate financial fields from line item totals
 * and new margin/waste/office/tax percentages.
 * Sundries fixed at 10% of materials + schafer.
 */
export function recalculateFinancials(
  estimate: Estimate,
  financials: Financials
): Estimate {
  const { marginPercent, wastePercent, officePercent, salesTaxPercent } =
    financials;
  const totals = estimate.totals;

  const consumablesInMaterials = estimate.byCategory.materials.some((i) => i.id === 'consumables');
  const baseMaterialsSchafer = consumablesInMaterials
    ? totals.materials - (totals.consumables ?? 0) + (totals.schafer || 0)
    : totals.materials + (totals.schafer || 0);
  const wasteAllowance = baseMaterialsSchafer * (wastePercent / 100);
  const sundriesAmount = baseMaterialsSchafer * (SUNDRIES_PERCENT / 100);
  const rawCost =
    totals.materials +
    totals.labor +
    totals.equipment +
    totals.accessories +
    (totals.schafer || 0);
  const baseCost = rawCost + wasteAllowance + sundriesAmount;
  const officeAllocation = baseCost * (officePercent / 100);
  const totalCost = baseCost + officeAllocation;
  const sellPrice = totalCost / (1 - marginPercent / 100);
  const salesTaxAmount = sellPrice * (salesTaxPercent / 100);
  const finalPrice = sellPrice + salesTaxAmount;
  const grossProfit = sellPrice - totalCost;
  const profitMargin =
    sellPrice > 0 ? (grossProfit / sellPrice) * 100 : 0;

  // Update consumables line (sundries) — lives in materials, not separate category
  const consumablesLine = estimate.byCategory.consumables?.[0] ?? estimate.byCategory.materials.find((i) => i.id === 'consumables') ?? {
    id: 'consumables',
    name: 'Consumables & Hardware',
    proposalDescription: 'Nails, screws, caulk, sealant, caps, and miscellaneous fasteners required to complete the roofing installation.',
    unit: 'each',
    price: sundriesAmount,
    coverage: null,
    coverageUnit: null,
    category: 'materials' as const,
    baseQuantity: 1,
    quantity: 1,
    total: sundriesAmount,
    wasteAdded: 0,
  };
  const updatedConsumablesLine = {
    ...consumablesLine,
    proposalDescription: consumablesLine.proposalDescription ?? 'Nails, screws, caulk, sealant, caps, and miscellaneous fasteners required to complete the roofing installation.',
    category: 'materials' as const,
    price: sundriesAmount,
    total: sundriesAmount,
  };
  const materialsWithoutConsumables = estimate.byCategory.materials.filter((i) => i.id !== 'consumables');
  const materialsWithConsumables = [...materialsWithoutConsumables, updatedConsumablesLine];
  const materialsTotal = estimate.totals.materials - (estimate.totals.consumables ?? 0) + sundriesAmount;
  const updatedTotals = {
    ...estimate.totals,
    materials: materialsTotal,
    consumables: sundriesAmount,
  };

  return {
    ...estimate,
    byCategory: { ...estimate.byCategory, materials: materialsWithConsumables, consumables: [] },
    totals: updatedTotals,
    baseCost,
    officeCostPercent: officePercent,
    officeAllocation,
    totalCost,
    marginPercent,
    wastePercent,
    sundriesPercent: SUNDRIES_PERCENT,
    sundriesAmount,
    sellPrice,
    salesTaxPercent: salesTaxPercent,
    salesTaxAmount,
    finalPrice,
    grossProfit,
    profitMargin,
  };
}
