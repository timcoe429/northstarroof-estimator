import { useState, useMemo, useEffect, useCallback } from 'react';
import { UNIT_TYPES } from '@/lib/constants/unitTypes';
import { CATEGORIES } from '@/lib/constants/categories';
import type { Measurements, PriceItem, LineItem, CustomerInfo, Estimate, VendorQuoteItem } from '@/types';

type SelectableItem = PriceItem & {
  isVendorItem?: boolean;
  vendorQuoteId?: string;
  vendorCategory?: VendorQuoteItem['vendor_category'];
  isCustomItem?: boolean;
};

type UseEstimateBuilderParams = {
  measurements: Measurements | null;
  priceItems: PriceItem[];
  vendorSelectableItems: SelectableItem[];
  customItems: PriceItem[];
  isTearOffRef: { current: boolean };
  marginPercent: number;
  officeCostPercent: number;
  wastePercent: number;
  sundriesPercent: number;
  vendorAdjustedPriceMap: Map<string, number>;
  customerInfo: CustomerInfo;
  vendorItemMap: Map<string, VendorQuoteItem>;
  setStep: (step: string) => void;
};

export function useEstimateBuilder(params: UseEstimateBuilderParams) {
  const {
    measurements,
    priceItems,
    vendorSelectableItems,
    customItems,
    isTearOffRef,
    marginPercent,
    officeCostPercent,
    wastePercent,
    sundriesPercent,
    vendorAdjustedPriceMap,
    customerInfo,
    vendorItemMap,
    setStep,
  } = params;

  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [viewMode, setViewMode] = useState<'internal' | 'client'>('internal');
  const [sectionSort, setSectionSort] = useState<Record<string, { key: 'name' | 'price' | 'total'; direction: 'asc' | 'desc' }>>({
    materials: { key: 'name', direction: 'asc' },
    labor: { key: 'name', direction: 'asc' },
    equipment: { key: 'name', direction: 'asc' },
    accessories: { key: 'name', direction: 'asc' },
    schafer: { key: 'name', direction: 'asc' },
  });

  const allSelectableItems: SelectableItem[] = useMemo(() => {
    return [...priceItems, ...vendorSelectableItems, ...customItems];
  }, [priceItems, vendorSelectableItems, customItems]);

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
        if (name.includes('rolloff') && isTearOffRef.current) {
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
  }, [priceItems, isTearOffRef]);

  // Recalculate quantities whenever measurements or priceItems change
  useEffect(() => {
    if (measurements && priceItems.length > 0) {
      const quantities = calculateItemQuantities(measurements);
      setItemQuantities(prev => {
        // Merge with existing to preserve any manual edits, but update calculated ones
        const merged = { ...prev };
        Object.keys(quantities).forEach(id => {
          const priceItem = priceItems.find(item => item.id === id);
          if (!priceItem) return;
          if (priceItem.category === 'schafer' && merged[id] !== undefined) {
            return;
          }
          merged[id] = quantities[id];
        });
        return merged;
      });
    }
  }, [measurements, priceItems, calculateItemQuantities]);

  // Auto-select rolloff on tear-off
  useEffect(() => {
    if (!measurements || !isTearOffRef.current) return;
    const rolloffIds = priceItems
      .filter(item => item.name.toLowerCase().includes('rolloff'))
      .map(item => item.id);
    if (rolloffIds.length === 0) return;
    const rolloffQty = Math.ceil((measurements.total_squares || 0) / 15);
    setSelectedItems(prev => Array.from(new Set([...prev, ...rolloffIds])));
    setItemQuantities(prev => {
      const updated = { ...prev };
      rolloffIds.forEach(id => {
        updated[id] = rolloffQty;
      });
      return updated;
    });
  }, [measurements, isTearOffRef, priceItems]);

  const initializeEstimateItems = (m: Measurements) => {
    // Quantities will be recalculated by useEffect
    // This function is kept for backward compatibility but doesn't need to do anything
  };

  const ensureVendorItemQuantities = (selectedIds: string[]) => {
    if (vendorItemMap.size === 0) return;
    setItemQuantities(prev => {
      const updated = { ...prev };
      selectedIds.forEach(id => {
        if (updated[id] === undefined) {
          const vendorItem = vendorItemMap.get(id);
          if (vendorItem) {
            updated[id] = vendorItem.quantity || 0;
          }
        }
      });
      return updated;
    });
  };

  const getItemQuantity = (item: SelectableItem) => {
    if (itemQuantities[item.id] !== undefined) {
      return itemQuantities[item.id];
    }
    if (item.isVendorItem) {
      return vendorItemMap.get(item.id)?.quantity ?? 0;
    }
    return 0;
  };

  const toggleSectionSort = (category: string, key: 'name' | 'price' | 'total') => {
    setSectionSort(prev => {
      const current = prev[category] || { key: 'name', direction: 'asc' };
      if (current.key !== key) {
        return {
          ...prev,
          [category]: { key, direction: 'desc' },
        };
      }
      const direction = current.direction === 'desc' ? 'asc' : 'desc';
      return {
        ...prev,
        [category]: { key, direction },
      };
    });
  };

  const getEstimateCategoryItems = (category: string) => {
    const items = allSelectableItems.filter(item => item.category === category);
    const sort = sectionSort[category] || { key: 'name', direction: 'asc' };
    const multiplier = sort.direction === 'asc' ? 1 : -1;

    return [...items].sort((a, b) => {
      if (sort.key === 'name') {
        return a.name.localeCompare(b.name) * multiplier;
      }
      if (sort.key === 'price') {
        return ((a.price || 0) - (b.price || 0)) * multiplier;
      }
      const totalA = getItemQuantity(a) * (a.price || 0);
      const totalB = getItemQuantity(b) * (b.price || 0);
      return (totalA - totalB) * multiplier;
    });
  };

  const calculateEstimate = () => {
    if (!measurements) return;
    
    const wasteFactor = 1 + (wastePercent / 100);
    
    const lineItems: LineItem[] = selectedItems.map<LineItem | null>(id => {
      const item = allSelectableItems.find(p => p.id === id);
      if (!item) return null;

      const isVendorItem = item.isVendorItem === true;
      const isCustomItem = item.isCustomItem === true;
      const baseQty = itemQuantities[id] ?? 0;
      // Apply waste factor only to non-vendor materials
      const isMaterialCategory = item.category === 'materials' || item.category === 'schafer';
      const qty = !isVendorItem && isMaterialCategory ? Math.ceil(baseQty * wasteFactor) : baseQty;
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
        wasteAdded: !isVendorItem && isMaterialCategory ? qty - baseQty : 0,
        isCustomItem: isCustomItem || false,
      } as LineItem;
    }).filter((item): item is LineItem => item !== null);

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

    setEstimate({
      lineItems,
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
    });
    setStep('estimate');
  };

  return {
    selectedItems,
    setSelectedItems,
    itemQuantities,
    setItemQuantities,
    estimate,
    setEstimate,
    viewMode,
    setViewMode,
    sectionSort,
    setSectionSort,
    allSelectableItems,
    calculateItemQuantities,
    initializeEstimateItems,
    ensureVendorItemQuantities,
    getItemQuantity,
    toggleSectionSort,
    getEstimateCategoryItems,
    calculateEstimate,
  };
}
