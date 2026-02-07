import type { Estimate, VendorQuoteItem } from '@/types';
import type { GroupedVendorItem } from '@/types/estimator';

export interface OrganizedItem {
  displayName: string;
  total: number; // sum of source items' totals (from calculator, NOT from AI)
  itemIds: number[]; // reference to original item IDs
  locked: boolean;
}

export interface OrganizedProposal {
  materials: OrganizedItem[];
  labor: OrganizedItem[];
  equipment: OrganizedItem[];
}

interface ApiResponse {
  groups: Array<{ displayName: string; itemIds: number[] }>;
}

export async function organizeProposal(
  estimate: Estimate,
  manualOverrides: Record<string, { quantity?: boolean; price?: boolean; name?: boolean }>,
  vendorQuoteItems: VendorQuoteItem[],
  groupedVendorItems: GroupedVendorItem[]
): Promise<OrganizedProposal> {
  try {
    // Step 1: Build ID map - assign numeric IDs to all items
    const itemMap = new Map<number, { 
      name: string; 
      total: number; 
      category: 'materials' | 'labor' | 'equipment'; 
      locked: boolean;
    }>();
    let nextId = 1;

    // Combine materials and accessories into materials category
    const materialsAndAccessories = [
      ...estimate.byCategory.materials,
      ...estimate.byCategory.accessories,
    ];

    materialsAndAccessories.forEach(item => {
      itemMap.set(nextId, {
        name: item.name,
        total: item.total,
        category: 'materials',
        locked: manualOverrides[item.id]?.name === true,
      });
      nextId++;
    });

    // Add labor items
    estimate.byCategory.labor.forEach(item => {
      itemMap.set(nextId, {
        name: item.name,
        total: item.total,
        category: 'labor',
        locked: manualOverrides[item.id]?.name === true,
      });
      nextId++;
    });

    // Add equipment items
    estimate.byCategory.equipment.forEach(item => {
      itemMap.set(nextId, {
        name: item.name,
        total: item.total,
        category: 'equipment',
        locked: manualOverrides[item.id]?.name === true,
      });
      nextId++;
    });

    // Vendor items are already included in estimate.byCategory, so skip vendorQuoteItems
    // Only add grouped vendor items (equipment groups) which are not in estimate.byCategory
    // Add grouped vendor items (equipment groups)
    groupedVendorItems.forEach(group => {
      if (group.category === 'equipment') {
        itemMap.set(nextId, {
          name: group.name,
          total: group.total,
          category: 'equipment',
          locked: false,
        });
        nextId++;
      }
    });

    if (itemMap.size === 0) {
      // No items to organize
      return {
        materials: [],
        labor: [],
        equipment: [],
      };
    }

    // Step 2: Send items with IDs to the API
    console.log('Items being sent to AI organizer:', Array.from(itemMap.entries()).map(([id, item]) => `ID ${id}: "${item.name}" ($${item.total.toFixed(2)}) [${item.category}] ${item.locked ? 'LOCKED' : ''}`));
    const response = await fetch('/api/organize-proposal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: Array.from(itemMap.entries()).map(([id, item]) => ({
          id,
          name: item.name,
          category: item.category,
          total: item.total,
          locked: item.locked,
        })),
        jobDescription: estimate.customerInfo.name ? 
          `Job for ${estimate.customerInfo.name}` : undefined,
        customerAddress: estimate.customerInfo.address || undefined,
      }),
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status}`);
    }

    const apiResponse: ApiResponse = await response.json();
    console.log('AI organizer response:', JSON.stringify(apiResponse, null, 2));

    // Step 3: Process the response using IDs NOT names
    const organized: OrganizedProposal = {
      materials: [],
      labor: [],
      equipment: [],
    };

    // Process each group from the API response
    apiResponse.groups.forEach(group => {
      let total = 0;
      let locked = false;
      const itemIds: number[] = [];

      // Look up each itemId in itemMap and sum totals
      group.itemIds.forEach(id => {
        const item = itemMap.get(id);
        if (item) {
          total += item.total;
          itemIds.push(id);
          // If any source item is locked, the group is locked
          if (item.locked) {
            locked = true;
          }
        } else {
          // Log warning if ID is not found (shouldn't happen)
          console.warn(`Could not find item ID ${id} in itemMap`);
        }
      });

      // Skip groups with no valid items
      if (itemIds.length === 0) {
        return;
      }

      const organizedItem: OrganizedItem = {
        displayName: group.displayName,
        total,
        itemIds,
        locked,
      };

      // Determine category from first item (all items in a group should be same category)
      const firstItem = itemMap.get(itemIds[0]);
      if (firstItem) {
        if (firstItem.category === 'materials') {
          organized.materials.push(organizedItem);
        } else if (firstItem.category === 'labor') {
          organized.labor.push(organizedItem);
        } else if (firstItem.category === 'equipment') {
          organized.equipment.push(organizedItem);
        }
      }
    });

    // Step 4: Check for missing items - ensure every item ID is accounted for
    const usedItemIds = new Set<number>();
    apiResponse.groups.forEach(group => {
      group.itemIds.forEach(id => usedItemIds.add(id));
    });

    // Find missing item IDs
    const missingItemIds: number[] = [];
    itemMap.forEach((item, id) => {
      if (!usedItemIds.has(id)) {
        missingItemIds.push(id);
      }
    });

    // Add missing items as standalone groups
    if (missingItemIds.length > 0) {
      console.warn(`AI organizer missed ${missingItemIds.length} items. Adding as standalone groups:`, 
        missingItemIds.map(id => {
          const item = itemMap.get(id);
          return item ? `ID ${id}: "${item.name}" ($${item.total.toFixed(2)})` : `ID ${id}`;
        })
      );

      missingItemIds.forEach(id => {
        const item = itemMap.get(id);
        if (!item) return;

        const organizedItem: OrganizedItem = {
          displayName: item.name, // Use original name for missing items
          total: item.total,
          itemIds: [id],
          locked: item.locked,
        };

        // Add to appropriate category
        if (item.category === 'materials') {
          organized.materials.push(organizedItem);
        } else if (item.category === 'labor') {
          organized.labor.push(organizedItem);
        } else if (item.category === 'equipment') {
          organized.equipment.push(organizedItem);
        }
      });
    }

    // Sort each category by total (highest first)
    organized.materials.sort((a, b) => b.total - a.total);
    organized.labor.sort((a, b) => b.total - a.total);
    organized.equipment.sort((a, b) => b.total - a.total);

    return organized;
  } catch (error) {
    console.error('Error organizing proposal:', error);
    // Fallback: return each item as its own group
    return getFallbackProposal(estimate, vendorQuoteItems, groupedVendorItems, manualOverrides);
  }
}

// Fallback: return each item as its own group
function getFallbackProposal(
  estimate: Estimate,
  vendorQuoteItems: VendorQuoteItem[],
  groupedVendorItems: GroupedVendorItem[],
  manualOverrides: Record<string, { quantity?: boolean; price?: boolean; name?: boolean }>
): OrganizedProposal {
  const materials: OrganizedItem[] = [];
  const labor: OrganizedItem[] = [];
  const equipment: OrganizedItem[] = [];
  let nextId = 1;

  // Process materials and accessories
  [...estimate.byCategory.materials, ...estimate.byCategory.accessories].forEach(item => {
    materials.push({
      displayName: item.name,
      total: item.total,
      itemIds: [nextId++],
      locked: manualOverrides[item.id]?.name === true,
    });
  });

  // Process labor
  estimate.byCategory.labor.forEach(item => {
    labor.push({
      displayName: item.name,
      total: item.total,
      itemIds: [nextId++],
      locked: manualOverrides[item.id]?.name === true,
    });
  });

  // Process equipment
  estimate.byCategory.equipment.forEach(item => {
    equipment.push({
      displayName: item.name,
      total: item.total,
      itemIds: [nextId++],
      locked: manualOverrides[item.id]?.name === true,
    });
  });

  // Process vendor items
  vendorQuoteItems.forEach(item => {
    const category = item.category === 'equipment' ? 'equipment' : 'materials';
    const target = category === 'equipment' ? equipment : materials;
    target.push({
      displayName: item.name,
      total: item.extended_price,
      itemIds: [nextId++],
      locked: false,
    });
  });

  // Process grouped vendor items
  groupedVendorItems.forEach(group => {
    if (group.category === 'equipment') {
      equipment.push({
        displayName: group.name,
        total: group.total,
        itemIds: [nextId++],
        locked: false,
      });
    }
  });

  // Sort by total (highest first)
  materials.sort((a, b) => b.total - a.total);
  labor.sort((a, b) => b.total - a.total);
  equipment.sort((a, b) => b.total - a.total);

  return { materials, labor, equipment };
}
