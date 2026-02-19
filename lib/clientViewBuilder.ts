import type { Estimate, LineItem, VendorQuoteItem } from '@/types';
import type { GroupedVendorItem } from '@/types/estimator';
import type { OrganizedProposal } from '@/lib/proposalOrganizer';
import { formatCurrency } from '@/lib/estimatorUtils';
import { groupItemsIntoKits } from './kitGrouping';

interface BuildClientViewSectionsParams {
  estimate: Estimate;
  vendorQuoteItems: VendorQuoteItem[];
  groupedVendorItems: GroupedVendorItem[];
  organizedProposal?: OrganizedProposal;
}

export const buildClientViewSections = ({
  estimate,
  vendorQuoteItems,
  groupedVendorItems,
  organizedProposal,
}: BuildClientViewSectionsParams) => {
  // Calculate effective multiplier that makes line items sum to finalPrice (includes sales tax)
  const rawTotal = Object.values(estimate.totals).reduce((sum, t) => sum + t, 0);
  const effectiveMultiplier = rawTotal > 0 ? estimate.finalPrice / rawTotal : 1;

  // Helper to check if item is optional (should not appear in main estimate)
  const isOptionalItem = (itemName: string): boolean => {
    const nameLower = itemName.toLowerCase();
    return nameLower.includes('skylight') ||
           nameLower.includes('heat tape') ||
           nameLower.includes('snow guard') ||
           nameLower.includes('snowguard') ||
           nameLower.includes('snow fence') ||
           nameLower.includes('snowfence') ||
           nameLower.includes('colorgard');
  };

  // Use actual item names from estimate (no AI organization)
  const vendorItemIds = new Set(vendorQuoteItems.map(item => item.id));

  const nonVendorMaterials = estimate.byCategory.materials
    .filter(item => !vendorItemIds.has(item.id))
    .filter(item => !isOptionalItem(item.name));
  const nonVendorAccessories = estimate.byCategory.accessories
    .filter(item => !vendorItemIds.has(item.id))
    .filter(item => !isOptionalItem(item.name));
  const nonVendorEquipment = estimate.byCategory.equipment.filter(item => !vendorItemIds.has(item.id));
  const nonVendorLabor = estimate.byCategory.labor
    .filter(item => !isOptionalItem(item.name));

  // Get INDIVIDUAL vendor items (not grouped) from materials and accessories
  const vendorMaterials = estimate.byCategory.materials
    .filter(item => vendorItemIds.has(item.id))
    .filter(item => !isOptionalItem(item.name));
  const vendorAccessories = estimate.byCategory.accessories
    .filter(item => vendorItemIds.has(item.id))
    .filter(item => !isOptionalItem(item.name));

  // Get grouped equipment (equipment should stay grouped as before)
  const groupedEquipment = groupedVendorItems.filter(group => group.category === 'equipment');

  // Build materials array - combine materials and accessories, use name as description
  const materials = [
    ...nonVendorMaterials.map(item => ({
      name: item.name,
      description: (item as LineItem).proposalDescription || item.name,
      total: item.total,
    })),
    ...nonVendorAccessories.map(item => ({
      name: item.name,
      description: (item as LineItem).proposalDescription || item.name,
      total: item.total,
    })),
    ...vendorMaterials.map(item => ({
      name: item.name,
      description: (item as LineItem).proposalDescription || item.name,
      total: item.total,
    })),
    ...vendorAccessories.map(item => ({
      name: item.name,
      description: (item as LineItem).proposalDescription || item.name,
      total: item.total,
    })),
  ];

  // Sort by total descending (biggest first)
  materials.sort((a, b) => b.total - a.total);

  const equipment = [
    ...nonVendorEquipment.map(item => ({
      name: item.name,
      description: (item as LineItem).proposalDescription || item.name,
      total: item.total,
    })),
    ...groupedEquipment.map(group => ({
      name: group.name,
      description: (group as { proposalDescription?: string }).proposalDescription || group.name,
      total: group.total,
    })),
  ];

  const labor = nonVendorLabor.map(item => ({
    name: item.name,
    description: (item as LineItem).proposalDescription || item.name,
    total: item.total,
  }));

  return { materials, labor, equipment };
};

export const buildEstimateForClientPdf = (
  estimate: Estimate,
  vendorQuoteItems: VendorQuoteItem[],
  groupedVendorItems: GroupedVendorItem[],
  organizedProposal?: OrganizedProposal
): Estimate => {
  const clientSections = buildClientViewSections({
    estimate,
    vendorQuoteItems,
    groupedVendorItems,
    organizedProposal,
  });
  
  // Calculate category totals
  const equipmentTotal = estimate.totals.equipment;
  const otherTotal = estimate.totals.materials + estimate.totals.labor + 
                     estimate.totals.accessories + estimate.totals.schafer;
  
  // Calculate category-specific multipliers
  // Equipment: office overhead only (no profit margin)
  const equipmentMultiplier = 1 + (estimate.officeCostPercent / 100);
  // Other categories: absorb remaining markup to reach finalPrice
  const otherMultiplier = otherTotal > 0 
    ? (estimate.finalPrice - equipmentTotal * equipmentMultiplier) / otherTotal 
    : 1;

  // Helper to get multiplier for category
  const getMultiplier = (category: LineItem['category']) => {
    return category === 'equipment' ? equipmentMultiplier : otherMultiplier;
  };

  const buildLineItems = (items: Array<{ name: string; description: string; total: number }>, category: LineItem['category']) => {
    const multiplier = getMultiplier(category);
    return items.map((item, idx) => {
      // Apply category-specific multiplier to get client-facing price
      const clientPrice = Math.round(item.total * multiplier * 100) / 100;
      return {
        id: `client_${category}_${idx}`,
        name: item.name,
        unit: 'lot',
        price: clientPrice,
        coverage: null,
        coverageUnit: null,
        category,
        baseQuantity: 1,
        quantity: 1,
        total: clientPrice,
        wasteAdded: 0,
        baseCost: item.total, // Preserve base cost for grouping logic
      } as any;
    });
  };

  const materials = buildLineItems(clientSections.materials, 'materials');
  const labor = buildLineItems(clientSections.labor, 'labor');
  const equipment = buildLineItems(clientSections.equipment, 'equipment');

  // Apply deterministic kit grouping
  const groupedMaterials = groupItemsIntoKits(materials);
  const groupedLabor = labor; // Labor never grouped
  const groupedEquipment = equipment; // Equipment never grouped

  const byCategory = {
    materials: groupedMaterials,
    labor: groupedLabor,
    equipment: groupedEquipment,
    accessories: [],
    schafer: [],
  };

  const totals = {
    materials: groupedMaterials.reduce((sum, item) => sum + item.total, 0),
    labor: groupedLabor.reduce((sum, item) => sum + item.total, 0),
    equipment: groupedEquipment.reduce((sum, item) => sum + item.total, 0),
    accessories: 0,
    schafer: 0,
  };

  return {
    ...estimate,
    lineItems: [...groupedMaterials, ...groupedLabor, ...groupedEquipment],
    byCategory,
    totals,
  } as Estimate;
};

export const copyClientViewToClipboard = async (
  estimate: Estimate,
  vendorQuoteItems: VendorQuoteItem[],
  groupedVendorItems: GroupedVendorItem[],
  organizedProposal?: OrganizedProposal
) => {
  let text = `ROOFING ESTIMATE\n`;
  text += `${estimate.customerInfo.name || 'Customer'}\n`;
  text += `${estimate.customerInfo.address || 'Address'}\n`;
  text += `${estimate.generatedAt}\n\n`;

  const clientSections = buildClientViewSections({
    estimate,
    vendorQuoteItems,
    groupedVendorItems,
    organizedProposal,
  });
  
  // Calculate category totals
  const equipmentTotal = estimate.totals.equipment;
  const otherTotal = estimate.totals.materials + estimate.totals.labor + 
                     estimate.totals.accessories + estimate.totals.schafer;
                     
  // Calculate category-specific multipliers
  // Equipment: office overhead only (no profit margin)
  const equipmentMultiplier = 1 + (estimate.officeCostPercent / 100);
  // Other categories: absorb remaining markup to reach finalPrice
  const otherMultiplier = otherTotal > 0 
    ? (estimate.finalPrice - equipmentTotal * equipmentMultiplier) / otherTotal 
    : 1;

  const sectionConfig = [
    { key: 'materials', label: 'Materials', items: clientSections.materials },
    { key: 'labor', label: 'Labor', items: clientSections.labor },
    { key: 'equipment', label: 'Equipment & Fees', items: clientSections.equipment },
  ];

  sectionConfig.forEach(section => {
    if (!section.items || section.items.length === 0) return;
    text += `${section.label.toUpperCase()}\n`;
    // Use category-specific multiplier
    const multiplier = section.key === 'equipment' ? equipmentMultiplier : otherMultiplier;
    section.items.forEach(item => {
      const clientPrice = Math.round(item.total * multiplier * 100) / 100;
      text += `${item.description}\t${formatCurrency(clientPrice)}\n`;
    });
    const sectionTotal = section.items.reduce((sum, item) => sum + item.total, 0);
    const clientSubtotal = Math.round(sectionTotal * multiplier * 100) / 100;
    text += `${section.label} Subtotal\t${formatCurrency(clientSubtotal)}\n\n`;
  });

  // Totals
  text += `${'─'.repeat(40)}\n`;
  text += `TOTAL\t${formatCurrency(estimate.finalPrice)}\n`;

  try {
    await navigator.clipboard.writeText(text);
    // Show success feedback (you could add a toast notification here)
    alert('Estimate copied to clipboard!');
  } catch (err) {
    console.error('Failed to copy:', err);
    alert('Failed to copy to clipboard');
  }
};
