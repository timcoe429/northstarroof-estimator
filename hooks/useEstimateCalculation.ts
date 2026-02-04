import { useMemo, useState, useCallback } from 'react';
import type { Measurements, PriceItem, LineItem, CustomerInfo, Estimate, VendorQuoteItem } from '@/types';
import type { SelectableItem, ValidationWarning } from '@/types/estimator';
import { CATEGORIES, UNIT_TYPES } from '@/lib/constants';

interface UseEstimateCalculationProps {
  measurements: Measurements | null;
  selectedItems: string[];
  itemQuantities: Record<string, number>;
  allSelectableItems: SelectableItem[];
  vendorAdjustedPriceMap: Map<string, number>;
  wastePercent: number;
  sundriesPercent: number;
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
  const calculateItemQuantities = useCallback((m: Measurements) => {
    const quantities: Record<string, number> = {};
    
    priceItems.forEach(item => {
      const name = item.name.toLowerCase();
      let qty = 0;

      // Normalize coverage to number and coverageUnit to lowercase string
      const coverage = item.coverage ? (typeof item.coverage === 'string' ? parseFloat(item.coverage) : item.coverage) : null;
      const coverageUnit = item.coverageUnit ? item.coverageUnit.toLowerCase() : null;

      // PRIORITY 1: IF item has coverage AND coverageUnit → Calculate using coverage FIRST
      if (coverage && coverageUnit) {
        if (coverageUnit === 'lf') {
          // Linear coverage calculation
          if (name.includes('starter')) {
            // Starter uses perimeter: eave_length + rake_length
            qty = Math.ceil(((m.eave_length || 0) + (m.rake_length || 0)) / coverage);
          } else if (name.includes('valley')) {
            qty = Math.ceil((m.valley_length || 0) / coverage);
          } else if (name.includes('eave') || name.includes('drip')) {
            qty = Math.ceil((m.eave_length || 0) / coverage);
          } else if (name.includes('rake')) {
            qty = Math.ceil((m.rake_length || 0) / coverage);
          } else if (name.includes('ridge') || name.includes('h&r')) {
            // H&R covers both ridge and hip
            qty = Math.ceil(((m.ridge_length || 0) + (m.hip_length || 0)) / coverage);
          } else if (name.includes('hip')) {
            qty = Math.ceil((m.hip_length || 0) / coverage);
          } else {
            // Default linear: use eave_length
            qty = Math.ceil((m.eave_length || 0) / coverage);
          }
        } else if (coverageUnit === 'sqft') {
          // Convert squares to sq ft, then divide by coverage
          qty = Math.ceil((m.total_squares * 100) / coverage);
        } else if (coverageUnit === 'sq') {
          // Coverage in squares
          qty = Math.ceil(m.total_squares / coverage);
        }
      }
      // PRIORITY 1.5: Manual-entry items (unit "each", no coverage, not flat fee) → Default to 0
      else if (item.unit === 'each' && !coverage) {
        // Check if it's a known flat fee item
        const isFlatFeeItem = name.includes('delivery') || name.includes('fuel') || name.includes('porto') || name.includes('rolloff') || name.includes('reprographic');
        
        // If not a flat fee item, default to 0 (user must enter quantity manually)
        // This includes labor items with "each" unit that aren't per-square (like "Snowguard Install")
        if (!isFlatFeeItem) {
          qty = 0;
        } else {
          // Flat fee items: always 1
          qty = 1;
        }
      }
      // PRIORITY 2: ELSE IF special cases (only when no coverage)
      else if (name.includes('osb') || name.includes('oriented strand')) {
        // OSB sheets: total_squares × 3
        qty = m.total_squares * 3;
      } else if (name.includes('starter')) {
        // Starter: eave_length + rake_length (perimeter) - no coverage
        qty = (m.eave_length || 0) + (m.rake_length || 0);
      } else if (name.includes('delivery') || name.includes('fuel') || name.includes('porto') || name.includes('rolloff') || item.unit === 'flat') {
        if (name.includes('rolloff') && isTearOff) {
          qty = Math.ceil((m.total_squares || 0) / 15);
        } else {
          // Flat fee items: always 1
          qty = 1;
        }
      } else if (item.category === 'labor' && item.unit !== 'each') {
        // Labor items (per-square): total_squares
        // Exclude "each" unit labor items (they're handled above as manual-entry)
        qty = m.total_squares || 0;
      }
      // PRIORITY 3: ELSE fall back to unit-based calculation
      else {
        const unitType = UNIT_TYPES.find(u => u.value === item.unit);
        if (!unitType) {
          quantities[item.id] = 0;
          return;
        }

        if (unitType.calcType === 'area') {
          if (item.unit === 'sf') {
            qty = (m.total_squares || 0) * 100;
          } else {
            // Area-based items (Field Tile, Shakes, Shingles, Underlayment)
            // No coverage, use total_squares directly
            qty = m.total_squares || 0;
          }
        } else if (unitType.calcType === 'linear') {
          // Linear-based items - no coverage, use direct measurements
          if (name.includes('valley')) {
            qty = m.valley_length || 0;
          } else if (name.includes('eave') || name.includes('drip')) {
            qty = m.eave_length || 0;
          } else if (name.includes('rake')) {
            qty = m.rake_length || 0;
          } else if (name.includes('ridge')) {
            qty = m.ridge_length || 0;
          } else if (name.includes('hip')) {
            qty = m.hip_length || 0;
          } else if (name.includes('h&r')) {
            // H&R covers both ridge and hip
            qty = (m.ridge_length || 0) + (m.hip_length || 0);
          } else {
            // Default linear: 0 if no match
            qty = 0;
          }
        } else if (unitType.calcType === 'count') {
          // Count-based items
          if (name.includes('boot') || name.includes('pipe') || name.includes('jack') || name.includes('flash') || name.includes('vent')) {
            qty = m.penetrations || 0;
          } else if (name.includes('skylight') || name.includes('velux')) {
            qty = m.skylights || 0;
          } else if (name.includes('chimney')) {
            qty = m.chimneys || 0;
          } else {
            // Default count: 0
            qty = 0;
          }
        } else if (unitType.calcType === 'flat') {
          // Flat fee items
          qty = 1;
        }
      }

      quantities[item.id] = qty;
    });

    return quantities;
  }, [priceItems, isTearOff]);

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
  const calculateEstimate = useCallback((): Estimate | null => {
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
      grossProfit,
      profitMargin,
      measurements,
      customerInfo,
      generatedAt: new Date().toLocaleString(),
    };

    // Run validation checks - IMPORTANT: pass newEstimate directly, NOT estimate state
    const warnings = runValidationChecks(newEstimate);
    setValidationWarnings(warnings);

    return newEstimate;
  }, [
    measurements,
    selectedItems,
    itemQuantities,
    allSelectableItems,
    vendorAdjustedPriceMap,
    wastePercent,
    sundriesPercent,
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
