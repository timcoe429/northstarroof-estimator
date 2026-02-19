import type { PriceItem, VendorQuoteItem } from '@/types';
import type { SelectableItem } from '@/types/estimator';
import type { BuildingEstimateState } from '@/hooks/useBuildings';
import type { EquipmentRule } from '@/types/equipment';

export interface MultiBuildingCalculationInput {
  buildings: BuildingEstimateState[];
  allSelectableItems: SelectableItem[];
  equipmentRules: EquipmentRule[];
  priceItems: PriceItem[];
  vendorQuoteItems: VendorQuoteItem[];
  vendorItemMap: Map<string, VendorQuoteItem>;
  vendorAdjustedPriceMap: Map<string, number>;
}

export interface MultiBuildingCalculationResult {
  combinedSelectedItems: string[];
  combinedItemQuantities: Record<string, number>;
  buildingSubtotals: Record<
    string,
    {
      buildingName: string;
      roofSystem: string;
      materialsTotal: number;
      itemCount: number;
    }
  >;
  laborTotal: number;
  equipmentTotal: number;
  equipmentItems: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
}

function getPrice(itemId: string, allSelectableItems: SelectableItem[], vendorAdjustedPriceMap: Map<string, number>): number {
  const adjusted = vendorAdjustedPriceMap.get(itemId);
  if (adjusted !== undefined) return adjusted;
  const item = allSelectableItems.find((p) => p.id === itemId);
  return item?.price ?? 0;
}

export function assembleMultiBuildingCalculation(
  input: MultiBuildingCalculationInput
): MultiBuildingCalculationResult {
  const {
    buildings,
    allSelectableItems,
    equipmentRules,
    priceItems,
    vendorQuoteItems,
    vendorItemMap,
    vendorAdjustedPriceMap,
  } = input;

  const combinedSelectedItems: string[] = [];
  const combinedItemQuantities: Record<string, number> = {};
  const buildingSubtotals: MultiBuildingCalculationResult['buildingSubtotals'] = {};
  const equipmentItems: MultiBuildingCalculationResult['equipmentItems'] = [];

  const totalSquares = buildings.reduce(
    (sum, b) => sum + (b.measurements?.total_squares ?? 0),
    0
  );

  const vendorItemIds = new Set(vendorQuoteItems.map((v) => v.id));

  // 1. Per-building materials (exclude vendor items; they are job-level, added in step 4)
  for (const building of buildings) {
    const items = building.selectedItems ?? [];
    const quantities = building.itemQuantities ?? {};
    let materialsTotal = 0;
    let itemCount = 0;

    for (const item of items) {
      if (vendorItemIds.has(item.id)) continue;

      const qty = quantities[item.id] ?? 0;
      if (qty <= 0) continue;

      if (!combinedSelectedItems.includes(item.id)) {
        combinedSelectedItems.push(item.id);
      }
      combinedItemQuantities[item.id] = (combinedItemQuantities[item.id] ?? 0) + qty;

      const price = getPrice(item.id, allSelectableItems, vendorAdjustedPriceMap);
      materialsTotal += price * qty;
      itemCount++;
    }

    buildingSubtotals[building.id] = {
      buildingName: building.name,
      roofSystem: building.roofSystem || '—',
      materialsTotal,
      itemCount,
    };
  }

  // 2. Labor
  const laborItem = priceItems.find((p) => p.category === 'labor');
  if (laborItem && totalSquares > 0) {
    if (!combinedSelectedItems.includes(laborItem.id)) {
      combinedSelectedItems.push(laborItem.id);
    }
    combinedItemQuantities[laborItem.id] =
      (combinedItemQuantities[laborItem.id] ?? 0) + totalSquares;
  }

  const laborTotal = laborItem ? totalSquares * laborItem.price : 0;

  // 3. Equipment
  let equipmentTotal = 0;
  for (const rule of equipmentRules) {
    const priceItem = priceItems.find((p) => p.name === rule.itemName);
    if (!priceItem) continue;

    const qty =
      rule.ruleType === 'per-60-squares'
        ? Math.ceil(totalSquares / 60)
        : rule.defaultQty;

    if (!combinedSelectedItems.includes(priceItem.id)) {
      combinedSelectedItems.push(priceItem.id);
    }
    combinedItemQuantities[priceItem.id] =
      (combinedItemQuantities[priceItem.id] ?? 0) + qty;

    const total = qty * priceItem.price;
    equipmentTotal += total;
    equipmentItems.push({
      name: priceItem.name,
      quantity: qty,
      unitPrice: priceItem.price,
      total,
    });
  }

  // 4. Vendor items (job-level, one quantity per item)
  for (const vItem of vendorQuoteItems) {
    const qty = vendorItemMap.get(vItem.id)?.quantity ?? vItem.quantity ?? 0;
    if (!combinedSelectedItems.includes(vItem.id)) {
      combinedSelectedItems.push(vItem.id);
    }
    combinedItemQuantities[vItem.id] = qty;
  }

  return {
    combinedSelectedItems,
    combinedItemQuantities,
    buildingSubtotals,
    laborTotal,
    equipmentTotal,
    equipmentItems,
  };
}
