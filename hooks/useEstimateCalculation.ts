import { useMemo, useState, useCallback } from 'react';
import type { Measurements, PriceItem, LineItem, CustomerInfo, Estimate, VendorQuoteItem } from '@/types';
import type { SelectableItem, ValidationWarning } from '@/types/estimator';
import { CATEGORIES } from '@/lib/constants';
import { calculateItemQuantitiesFromMeasurements } from '@/lib/calculateItemQuantities';

interface UseEstimateCalculationProps {
  measurements: Measurements | null;
  selectedItems: string[];
  itemQuantities: Record<string, number>;
  allSelectableItems: SelectableItem[];
  vendorAdjustedPriceMap: Map<string, number>;
  wastePercent: number;
  sundriesPercent: number;
  salesTaxPercent: number;
  marginPercent: number;
  officeCostPercent: number;
  customerInfo: CustomerInfo;
  priceItems: PriceItem[];
  isTearOff: boolean;
}

export const useEstimateCalculation = ({
  measurements,
  selectedItems,
  itemQuantities,
  allSelectableItems,
  vendorAdjustedPriceMap,
  wastePercent,
  sundriesPercent,
  salesTaxPercent,
  marginPercent,
  officeCostPercent,
  customerInfo,
  priceItems,
  isTearOff,
}: UseEstimateCalculationProps) => {
  const [validationWarnings, setValidationWarnings] = useState<ValidationWarning[]>([]);

  // Combined multiplier = (1 + officePercent/100) × (1 + marginPercent/100)
  const markupMultiplier = useMemo(() => {
    return (1 + officeCostPercent / 100) * (1 + marginPercent / 100);
  }, [officeCostPercent, marginPercent]);

  // Calculate quantities for ALL items based on measurements
  const calculateItemQuantities = useCallback(
    (m: Measurements) => calculateItemQuantitiesFromMeasurements(m, priceItems, isTearOff),
    [priceItems, isTearOff]
  );

  // Run validation checks on estimate
  const runValidationChecks = (estimate: Estimate): ValidationWarning[] => {
    const warnings: ValidationWarning[] = [];
    
    // Waste % is 0
    if (estimate.wastePercent === 0) {
      warnings.push({
        id: 'waste-zero',
        message: 'Waste % is 0 — typically should be 10-15%',
        severity: 'warning',
        field: 'wastePercent'
      });
    }
    
    // No labor selected
    if (estimate.byCategory.labor.length === 0) {
      warnings.push({
        id: 'no-labor',
        message: 'No labor items selected',
        severity: 'warning'
      });
    }
    
    // No underlayment
    const underlaymentKeywords = ['underlayment', 'ice & water', 'sharkskin', 'felt', 'synthetic'];
    const hasUnderlayment = estimate.byCategory.materials.some(item =>
      underlaymentKeywords.some(keyword => item.name.toLowerCase().includes(keyword))
    );
    if (!hasUnderlayment) {
      warnings.push({
        id: 'no-underlayment',
        message: 'No underlayment selected — most roofs require underlayment',
        severity: 'warning'
      });
    }
    
    // No drip edge
    const hasDripEdge = [...estimate.byCategory.materials, ...estimate.byCategory.accessories].some(item =>
      item.name.toLowerCase().includes('drip edge')
    );
    if (!hasDripEdge) {
      warnings.push({
        id: 'no-drip-edge',
        message: 'No drip edge selected',
        severity: 'warning'
      });
    }
    
    // Margin too low
    if (estimate.marginPercent < 25) {
      warnings.push({
        id: 'margin-low',
        message: 'Margin is below 25% — is this intentional?',
        severity: 'warning',
        field: 'marginPercent'
      });
    }
    
    // Margin too high
    if (estimate.marginPercent > 60) {
      warnings.push({
        id: 'margin-high',
        message: 'Margin is above 60% — is this intentional?',
        severity: 'warning',
        field: 'marginPercent'
      });
    }
    
    // Materials seem low
    const minMaterialsCost = estimate.measurements.total_squares * 50;
    if (estimate.totals.materials < minMaterialsCost) {
      warnings.push({
        id: 'materials-low',
        message: 'Materials cost seems low for roof size — verify items are selected',
        severity: 'warning'
      });
    }
    
    return warnings;
  };

  // Calculate estimate
  // skipValidation: when true, avoids setValidationWarnings (for read-only display during render, e.g. All Combined tab)
  const calculateEstimate = useCallback((skipValidation?: boolean): Estimate | null => {
    if (!measurements) return null;
    
    const wasteFactor = 1 + (wastePercent / 100);
    
    const allLineItems: LineItem[] = selectedItems.map<LineItem | null>(id => {
      const item = allSelectableItems.find(p => p.id === id);
      if (!item) return null;

      const isVendorItem = item.isVendorItem === true;
      const isCustomItem = item.isCustomItem === true;
      const baseQty = itemQuantities[id] ?? 0;
      // Check if item is optional (skylights)
      const isOptional = item.name.toLowerCase().includes('skylight');
      // Apply waste factor only to non-vendor materials (and not optional items)
      const isMaterialCategory = item.category === 'materials' || item.category === 'schafer';
      const qty = !isVendorItem && isMaterialCategory && !isOptional ? Math.ceil(baseQty * wasteFactor) : baseQty;
      const itemPrice = isVendorItem ? (vendorAdjustedPriceMap.get(item.id) ?? item.price) : item.price;
      const baseTotal = baseQty * itemPrice;
      const total = qty * itemPrice;

      const { isVendorItem: _, vendorQuoteId: __, vendorCategory: ___, isCustomItem: ____, ...baseItem } = item;

      return {
        ...baseItem,
        price: itemPrice,
        baseQuantity: baseQty,
        quantity: qty,
        total,
        wasteAdded: !isVendorItem && isMaterialCategory && !isOptional ? qty - baseQty : 0,
        isCustomItem: isCustomItem || false,
        isOptional: isOptional || false,
      } as LineItem;
    }).filter((item): item is LineItem => item !== null);

    // Separate optional items from regular line items
    const lineItems = allLineItems.filter(item => !item.isOptional);
    const optionalItems = allLineItems.filter(item => item.isOptional);

    const byCategory: Estimate['byCategory'] = Object.keys(CATEGORIES).reduce((acc, cat) => {
      acc[cat as keyof typeof CATEGORIES] = lineItems.filter(item => item.category === cat);
      return acc;
    }, {
      materials: [],
      labor: [],
      equipment: [],
      accessories: [],
      schafer: [],
    });

    const totals: Estimate['totals'] = Object.entries(byCategory).reduce((acc, [cat, items]) => {
      acc[cat as keyof Estimate['totals']] = items.reduce((sum, item) => sum + item.total, 0);
      return acc;
    }, {
      materials: 0,
      labor: 0,
      equipment: 0,
      accessories: 0,
      schafer: 0,
    });

    // Calculate Sundries (percentage of materials total only)
    const sundriesBase = totals.materials + (totals.schafer || 0);
    const sundriesAmount = sundriesBase * (sundriesPercent / 100);

    // Calculate costs and profit
    // Base cost = materials + labor + equipment + accessories + sundries
    const baseCost = Object.values(totals).reduce((sum, t) => sum + t, 0) + sundriesAmount;
    const officeAllocation = baseCost * (officeCostPercent / 100);
    const totalCost = baseCost + officeAllocation;
    
    // Margin is applied on top of cost: sellPrice = cost / (1 - margin%)
    const sellPrice = totalCost / (1 - (marginPercent / 100));
    const grossProfit = sellPrice - totalCost;
    const profitMargin = sellPrice > 0 ? (grossProfit / sellPrice) * 100 : 0;

    // Calculate sales tax AFTER sell price (applied to final sell price)
    const salesTaxAmount = sellPrice * (salesTaxPercent / 100);
    const finalPrice = sellPrice + salesTaxAmount;

    // Create the estimate object
    const newEstimate: Estimate = {
      lineItems,
      optionalItems,
      byCategory,
      totals,
      baseCost,
      officeCostPercent,
      officeAllocation,
      totalCost,
      marginPercent,
      wastePercent,
      sundriesPercent,
      sundriesAmount,
      sellPrice,
      salesTaxPercent,
      salesTaxAmount,
      finalPrice,
      grossProfit,
      profitMargin,
      measurements,
      customerInfo,
      generatedAt: new Date().toLocaleString(),
    };

    // Run validation checks - skip when used for read-only display (prevents setState-during-render infinite loop)
    if (!skipValidation) {
      const warnings = runValidationChecks(newEstimate);
      setValidationWarnings(warnings);
    }

    return newEstimate;
  }, [
    measurements,
    selectedItems,
    itemQuantities,
    allSelectableItems,
    vendorAdjustedPriceMap,
    wastePercent,
    sundriesPercent,
    salesTaxPercent,
    marginPercent,
    officeCostPercent,
    customerInfo,
  ]);

  return {
    calculateEstimate,
    runValidationChecks,
    calculateItemQuantities,
    markupMultiplier,
    validationWarnings,
    setValidationWarnings,
  };
};
