import type { Estimate, LineItem, VendorQuoteItem } from '@/types';
import type { GroupedVendorItem } from '@/types/estimator';
import { formatCurrency } from '@/lib/estimatorUtils';

interface BuildClientViewSectionsParams {
  estimate: Estimate;
  vendorQuoteItems: VendorQuoteItem[];
  groupedVendorItems: GroupedVendorItem[];
}

export const buildClientViewSections = ({
  estimate,
  vendorQuoteItems,
  groupedVendorItems,
}: BuildClientViewSectionsParams) => {
  // Calculate effective multiplier that makes line items sum to sellPrice
  const rawTotal = Object.values(estimate.totals).reduce((sum, t) => sum + t, 0);
  const effectiveMultiplier = rawTotal > 0 ? estimate.sellPrice / rawTotal : 1;
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

  // Define grouping threshold and kits
  const GROUPING_THRESHOLD = 1000; // sell price threshold (changed from 1500 to 1000)

  const kits = {
    panels: {
      keywords: ['coil', 'panel fabrication', 'fab-panel', 'panel clip', 'pcmech', 'pancakescrew', 'pcscga'],
      items: [] as Array<{ name: string; description: string; total: number }>,
      name: 'Panel System',
      description: 'Standing seam metal panels including coil, fabrication, clips, and fasteners'
    },
    flashing: {
      keywords: ['eave', 'rake', 'ridge', 'valley', 'sidewall', 'headwall', 'starter', 'head wall', 'side wall', 'drip edge', 'flashing', 'fab eave', 'fab rake', 'fab ridge', 'fab valley', 'fab starter', 'fab cz', 'fab head', 'fab side', 'fab transition', 'fab z', 'fab parapet', 'sheet 4x10', 'sheet 3x10', 'scsh', 'line fabrication', 'fabtrimscha'],
      items: [] as Array<{ name: string; description: string; total: number }>,
      name: 'Flashing Kit',
      description: 'Custom fabricated metal flashing including eave, rake, ridge, valley, sidewall, headwall, and starter pieces'
    },
    fasteners: {
      keywords: ['fastener', 'clip', 'screw', 'rivet', 'woodgrip', 'pancake', 'nail', 'lap tek'],
      items: [] as Array<{ name: string; description: string; total: number }>,
      name: 'Fasteners & Hardware',
      description: 'Panel clips, screws, rivets, and installation fasteners'
    },
    sealants: {
      keywords: ['sealant', 'caulk', 'tape', 'foam', 'closure', 'nova seal', 'butyl', 'poprivet', 'pop rivet'],
      items: [] as Array<{ name: string; description: string; total: number }>,
      name: 'Sealants & Accessories',
      description: 'Foam closures, butyl tape, caulk, and finishing materials'
    },
    other: {
      keywords: [],
      items: [] as Array<{ name: string; description: string; total: number }>,
      name: 'Additional Materials',
      description: 'Additional roofing materials and supplies'
    }
  };

  // Build materials array from INDIVIDUAL items (non-vendor + vendor materials + vendor accessories)
  // DO NOT use groupedVendorItems here - we want individual items for threshold checking
  const allMaterials = [
    ...nonVendorMaterials.map(item => ({
      name: item.name,
      description: item.proposalDescription && item.proposalDescription.trim() ? item.proposalDescription : item.name,
      total: item.total,
    })),
    ...nonVendorAccessories.map(item => ({
      name: item.name,
      description: item.proposalDescription && item.proposalDescription.trim() ? item.proposalDescription : item.name,
      total: item.total,
    })),
    ...vendorMaterials.map(item => ({
      name: item.name,
      description: item.proposalDescription && item.proposalDescription.trim() ? item.proposalDescription : item.name,
      total: item.total,
    })),
    ...vendorAccessories.map(item => ({
      name: item.name,
      description: item.proposalDescription && item.proposalDescription.trim() ? item.proposalDescription : item.name,
      total: item.total,
    })),
  ];

  // Step 1: Check INDIVIDUAL items against threshold BEFORE any grouping
  const standAloneItems = allMaterials.filter(item => (item.total * effectiveMultiplier) >= GROUPING_THRESHOLD);
  const groupableItems = allMaterials.filter(item => (item.total * effectiveMultiplier) < GROUPING_THRESHOLD);

  // Step 2: Group small items by kit type
  groupableItems.forEach(item => {
    const itemName = item.name.toLowerCase();
    let assigned = false;

    // Check panels kit
    if (kits.panels.keywords.some(kw => itemName.includes(kw))) {
      kits.panels.items.push(item);
      assigned = true;
    }
    // Check flashing kit
    else if (kits.flashing.keywords.some(kw => itemName.includes(kw))) {
      kits.flashing.items.push(item);
      assigned = true;
    }
    // Check fasteners kit
    else if (kits.fasteners.keywords.some(kw => itemName.includes(kw))) {
      kits.fasteners.items.push(item);
      assigned = true;
    }
    // Check sealants kit
    else if (kits.sealants.keywords.some(kw => itemName.includes(kw))) {
      kits.sealants.items.push(item);
      assigned = true;
    }

    // If no match, put in "Additional Materials"
    if (!assigned) {
      kits.other.items.push(item);
    }
  });

  // Step 3: Build final materials array
  const materials: Array<{ name: string; description: string; total: number }> = [];

  // Add standalone items
  materials.push(...standAloneItems);

  // Add non-empty kits (sum totals for kit)
  Object.values(kits).forEach(kit => {
    if (kit.items.length > 0) {
      const kitTotal = kit.items.reduce((sum, item) => sum + item.total, 0);
      materials.push({
        name: kit.name,
        description: kit.description,
        total: kitTotal
      });
    }
  });

  // Step 4: Sort by total descending (biggest first)
  materials.sort((a, b) => b.total - a.total);

  const equipment = [
    ...nonVendorEquipment.map(item => ({
      name: item.name,
      description: item.proposalDescription && item.proposalDescription.trim() ? item.proposalDescription : item.name,
      total: item.total,
    })),
    ...groupedEquipment.map(group => ({
      name: group.name,
      description: group.description || group.name,
      total: group.total,
    })),
  ];

  const labor = nonVendorLabor.map(item => ({
    name: item.name,
    description: item.proposalDescription && item.proposalDescription.trim() ? item.proposalDescription : item.name,
    total: item.total,
  }));

  return { materials, labor, equipment };
};

export const buildEstimateForClientPdf = (
  estimate: Estimate,
  vendorQuoteItems: VendorQuoteItem[],
  groupedVendorItems: GroupedVendorItem[]
): Estimate => {
  const clientSections = buildClientViewSections({
    estimate,
    vendorQuoteItems,
    groupedVendorItems,
  });
  
  // Calculate effective multiplier for applying to line items
  const rawTotal = Object.values(estimate.totals).reduce((sum, t) => sum + t, 0);
  const effectiveMultiplier = rawTotal > 0 ? estimate.sellPrice / rawTotal : 1;

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
        proposalDescription: item.description,
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
  groupedVendorItems: GroupedVendorItem[]
) => {
  let text = `ROOFING ESTIMATE\n`;
  text += `${estimate.customerInfo.name || 'Customer'}\n`;
  text += `${estimate.customerInfo.address || 'Address'}\n`;
  text += `${estimate.generatedAt}\n\n`;

  const clientSections = buildClientViewSections({
    estimate,
    vendorQuoteItems,
    groupedVendorItems,
  });
  
  // Calculate effective multiplier for applying to line items
  const rawTotal = Object.values(estimate.totals).reduce((sum, t) => sum + t, 0);
  const effectiveMultiplier = rawTotal > 0 ? estimate.sellPrice / rawTotal : 1;

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
  text += `TOTAL\t${formatCurrency(estimate.sellPrice)}\n`;

  try {
    await navigator.clipboard.writeText(text);
    // Show success feedback (you could add a toast notification here)
    alert('Estimate copied to clipboard!');
  } catch (err) {
    console.error('Failed to copy:', err);
    alert('Failed to copy to clipboard');
  }
};
