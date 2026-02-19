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

  const materialsSchafer = totals.materials + (totals.schafer || 0);
  const wasteAllowance = materialsSchafer * (wastePercent / 100);
  const sundriesAmount = materialsSchafer * (SUNDRIES_PERCENT / 100);
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

  // Update consumables line (sundries) with recalculated amount
  const consumablesLine = estimate.byCategory.consumables?.[0] ?? {
    id: 'consumables',
    name: 'Consumables & Hardware',
    unit: 'each',
    price: sundriesAmount,
    coverage: null,
    coverageUnit: null,
    category: 'consumables' as const,
    baseQuantity: 1,
    quantity: 1,
    total: sundriesAmount,
    wasteAdded: 0,
  };
  const consumables = [{
    ...consumablesLine,
    price: sundriesAmount,
    total: sundriesAmount,
  }];
  const updatedTotals = {
    ...estimate.totals,
    consumables: sundriesAmount,
  };

  return {
    ...estimate,
    byCategory: { ...estimate.byCategory, consumables },
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
