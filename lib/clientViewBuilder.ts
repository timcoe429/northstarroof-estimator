import type { Estimate, LineItem, VendorQuoteItem } from '@/types';
import type { GroupedVendorItem } from '@/types/estimator';
import type { OrganizedProposal } from '@/lib/proposalOrganizer';
import { formatCurrency } from '@/lib/estimatorUtils';

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

  // Use actual item names from estimate (no AI organization)
  const vendorItemIds = new Set(vendorQuoteItems.map(item => item.id));

  const nonVendorMaterials = estimate.byCategory.materials.filter(item => !vendorItemIds.has(item.id));
  const nonVendorAccessories = estimate.byCategory.accessories.filter(item => !vendorItemIds.has(item.id));
  const nonVendorEquipment = estimate.byCategory.equipment.filter(item => !vendorItemIds.has(item.id));
  const nonVendorLabor = estimate.byCategory.labor.filter(item => !vendorItemIds.has(item.id));

  // Get INDIVIDUAL vendor items (not grouped) from materials and accessories
  const vendorMaterials = estimate.byCategory.materials.filter(item => vendorItemIds.has(item.id));
  const vendorAccessories = estimate.byCategory.accessories.filter(item => vendorItemIds.has(item.id));

  // Get grouped equipment (equipment should stay grouped as before)
  const groupedEquipment = groupedVendorItems.filter(group => group.category === 'equipment');

  // Build materials array - combine materials and accessories, use name as description
  const materials = [
    ...nonVendorMaterials.map(item => ({
      name: item.name,
      description: item.name,
      total: item.total,
    })),
    ...nonVendorAccessories.map(item => ({
      name: item.name,
      description: item.name,
      total: item.total,
    })),
    ...vendorMaterials.map(item => ({
      name: item.name,
      description: item.name,
      total: item.total,
    })),
    ...vendorAccessories.map(item => ({
      name: item.name,
      description: item.name,
      total: item.total,
    })),
  ];

  // Sort by total descending (biggest first)
  materials.sort((a, b) => b.total - a.total);

  const equipment = [
    ...nonVendorEquipment.map(item => ({
      name: item.name,
      description: item.name,
      total: item.total,
    })),
    ...groupedEquipment.map(group => ({
      name: group.name,
      description: group.name,
      total: group.total,
    })),
  ];

  const labor = nonVendorLabor.map(item => ({
    name: item.name,
    description: item.name,
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
  
  // Calculate effective multiplier for applying to line items (uses finalPrice which includes sales tax)
  const rawTotal = Object.values(estimate.totals).reduce((sum, t) => sum + t, 0);
  const effectiveMultiplier = rawTotal > 0 ? estimate.finalPrice / rawTotal : 1;

  const buildLineItems = (items: Array<{ name: string; description: string; total: number }>, category: LineItem['category']) => {
    return items.map((item, idx) => {
      // Apply effective multiplier to get client-facing price
      const clientPrice = Math.round(item.total * effectiveMultiplier * 100) / 100;
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
      };
    });
  };

  const materials = buildLineItems(clientSections.materials, 'materials');
  const labor = buildLineItems(clientSections.labor, 'labor');
  const equipment = buildLineItems(clientSections.equipment, 'equipment');

  const byCategory = {
    materials,
    labor,
    equipment,
    accessories: [],
    schafer: [],
  };

  const totals = {
    materials: materials.reduce((sum, item) => sum + item.total, 0),
    labor: labor.reduce((sum, item) => sum + item.total, 0),
    equipment: equipment.reduce((sum, item) => sum + item.total, 0),
    accessories: 0,
    schafer: 0,
  };

  return {
    ...estimate,
    lineItems: [...materials, ...labor, ...equipment],
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
  
  // Calculate effective multiplier for applying to line items (uses finalPrice which includes sales tax)
  const rawTotal = Object.values(estimate.totals).reduce((sum, t) => sum + t, 0);
  const effectiveMultiplier = rawTotal > 0 ? estimate.finalPrice / rawTotal : 1;

  const sectionConfig = [
    { key: 'materials', label: 'Materials', items: clientSections.materials },
    { key: 'labor', label: 'Labor', items: clientSections.labor },
    { key: 'equipment', label: 'Equipment & Fees', items: clientSections.equipment },
  ];

  sectionConfig.forEach(section => {
    if (!section.items || section.items.length === 0) return;
    text += `${section.label.toUpperCase()}\n`;
    section.items.forEach(item => {
      const clientPrice = Math.round(item.total * effectiveMultiplier * 100) / 100;
      text += `${item.description}\t${formatCurrency(clientPrice)}\n`;
    });
    const sectionTotal = section.items.reduce((sum, item) => sum + item.total, 0);
    const clientSubtotal = Math.round(sectionTotal * effectiveMultiplier * 100) / 100;
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
