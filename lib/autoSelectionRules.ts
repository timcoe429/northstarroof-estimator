import type { PriceItem, VendorQuote, VendorQuoteItem } from '@/types';

/**
 * Auto-selection rules that trigger after RoofScope upload
 * User sees auto-selected items in the list before generating estimate
 */

export type RoofType = 'metal' | 'non-metal' | 'synthetic' | 'asphalt-presidential' | 'asphalt-basic';

export interface AutoSelectionContext {
  jobDescription: string;
  availablePriceItems: PriceItem[];
  vendorQuotes: VendorQuote[];
  vendorQuoteItems: VendorQuoteItem[];
  selectedLaborItems?: string[];
}

export interface AutoSelectionResult {
  autoSelectedItemIds: string[];
  detectedRoofType: RoofType;
  appliedRules: string[];
}

/**
 * Detect roof type using multi-source detection in priority order
 */
export function detectRoofType(context: AutoSelectionContext): RoofType {
  const { jobDescription, vendorQuotes, vendorQuoteItems } = context;

  // Priority 1: Check vendor quote vendor name
  const hasMetalVendor = vendorQuotes.some(
    quote => quote.vendor === 'schafer' || quote.vendor === 'tra' || quote.vendor === 'rocky-mountain'
  );
  if (hasMetalVendor) {
    return 'metal';
  }

  // Priority 2: Check vendor quote item names for metal keywords
  const metalItemKeywords = ['standing seam', 'panel', 'coil', 'ag panel', 'pro panel', 'r panel', 'metal panel'];
  const hasMetalItems = vendorQuoteItems.some(item => {
    const itemName = item.name.toLowerCase();
    return metalItemKeywords.some(keyword => itemName.includes(keyword));
  });
  if (hasMetalItems) {
    return 'metal';
  }

  // Priority 3: Check job description for specific roof types
  const description = jobDescription.toLowerCase();

  // Check for synthetic systems (most specific)
  if (description.includes('davinci') || description.includes('brava') ||
      description.includes('synthetic slate') || description.includes('synthetic shake')) {
    return 'synthetic';
  }

  // Check for presidential asphalt
  if (description.includes('presidential')) {
    return 'asphalt-presidential';
  }

  // Check for basic asphalt
  if (description.includes('shingle') || description.includes('asphalt') ||
      description.includes('composition')) {
    return 'asphalt-basic';
  }

  // Check for metal roof in description
  if (description.includes('metal roof') || description.includes('metal panel') ||
      description.includes('standing seam')) {
    return 'metal';
  }

  // Check for non-metal types (tile, slate, shake)
  if (description.includes('tile') || description.includes('slate') ||
      description.includes('cedar shake') || description.includes('wood shake')) {
    return 'non-metal';
  }

  // Priority 4: Default to non-metal if unclear
  return 'non-metal';
}

/**
 * Find a price item by matching against multiple possible keywords
 */
function findItemByKeywords(
  priceItems: PriceItem[],
  keywords: string[]
): PriceItem | null {
  return priceItems.find(item => {
    const itemName = item.name.toLowerCase();
    return keywords.some(keyword => itemName.includes(keyword.toLowerCase()));
  }) || null;
}

/**
 * Check if a labor crew member is selected
 */
function isLaborCrewSelected(
  context: AutoSelectionContext,
  crewNames: string[]
): boolean {
  if (!context.selectedLaborItems || context.selectedLaborItems.length === 0) {
    return false;
  }

  return context.selectedLaborItems.some(itemId => {
    const item = context.availablePriceItems.find(p => p.id === itemId);
    if (!item) return false;
    const itemName = item.name.toLowerCase();
    return crewNames.some(crew => itemName.includes(crew.toLowerCase()));
  });
}

/**
 * Apply underlayment auto-selection rules
 */
function applyUnderlaymentRules(
  context: AutoSelectionContext,
  roofType: RoofType
): { itemIds: string[]; rules: string[] } {
  const { availablePriceItems } = context;
  const selectedIds: string[] = [];
  const appliedRules: string[] = [];

  // RULE: PSU 30 - ALWAYS auto-select on every roof
  const psu30 = findItemByKeywords(availablePriceItems, [
    'psu 30', 'psu30', 'owens corning psu', 'high temp'
  ]);
  if (psu30) {
    selectedIds.push(psu30.id);
    appliedRules.push('PSU 30 High Temp - Always selected');
  }

  // RULE: GAF Versa Shield - Only for metal roofs (IN ADDITION to PSU 30)
  if (roofType === 'metal') {
    const versaShield = findItemByKeywords(availablePriceItems, [
      'versa shield', 'versashield', 'gaf versa'
    ]);
    if (versaShield) {
      selectedIds.push(versaShield.id);
      appliedRules.push('GAF Versa Shield - Selected for metal roof');
    }
  }

  // RULE: SolarHide Radiant Barrier - Only for non-metal roofs (IN ADDITION to PSU 30)
  if (roofType !== 'metal') {
    const solarHide = findItemByKeywords(availablePriceItems, [
      'solarhide', 'solar hide', 'radiant barrier'
    ]);
    if (solarHide) {
      selectedIds.push(solarHide.id);
      appliedRules.push('SolarHide Radiant Barrier - Selected for non-metal roof');
    }
  }

  return { itemIds: selectedIds, rules: appliedRules };
}

/**
 * Apply nail auto-selection rules based on roofing system
 */
function applyNailRules(
  context: AutoSelectionContext,
  roofType: RoofType
): { itemIds: string[]; rules: string[] } {
  const { availablePriceItems } = context;
  const selectedIds: string[] = [];
  const appliedRules: string[] = [];

  // RULE: 1 3/4" Ringshank - Synthetic systems (DaVinci, Brava)
  if (roofType === 'synthetic') {
    const ringshankNails = findItemByKeywords(availablePriceItems, [
      '1 3/4', '1.75', 'ringshank', 'ring shank'
    ]);
    if (ringshankNails) {
      selectedIds.push(ringshankNails.id);
      appliedRules.push('1 3/4" Ringshank nails - Selected for synthetic system');
    }
  }

  // RULE: 1 3/4" Non-ringshank - Presidential asphalt shingles
  if (roofType === 'asphalt-presidential') {
    const nails = findItemByKeywords(availablePriceItems, [
      '1 3/4', '1.75', 'nail'
    ]);
    // Make sure it's NOT ringshank
    if (nails && !nails.name.toLowerCase().includes('ringshank') &&
        !nails.name.toLowerCase().includes('ring shank')) {
      selectedIds.push(nails.id);
      appliedRules.push('1 3/4" Non-ringshank nails - Selected for Presidential shingles');
    }
  }

  // RULE: 1 1/2" Non-ringshank - Basic asphalt shingles
  if (roofType === 'asphalt-basic') {
    const nails = findItemByKeywords(availablePriceItems, [
      '1 1/2', '1.5', 'nail'
    ]);
    // Make sure it's NOT ringshank
    if (nails && !nails.name.toLowerCase().includes('ringshank') &&
        !nails.name.toLowerCase().includes('ring shank')) {
      selectedIds.push(nails.id);
      appliedRules.push('1 1/2" Non-ringshank nails - Selected for basic shingles');
    }
  }

  return { itemIds: selectedIds, rules: appliedRules };
}

/**
 * Apply equipment and fees auto-selection rules
 */
function applyEquipmentRules(
  context: AutoSelectionContext
): { itemIds: string[]; rules: string[] } {
  const { availablePriceItems } = context;
  const selectedIds: string[] = [];
  const appliedRules: string[] = [];

  // RULE: Porta Potty - Always auto-select with quantity 1
  const portaPotty = findItemByKeywords(availablePriceItems, [
    'porta potty', 'porto potty', 'portable', 'restroom'
  ]);
  if (portaPotty) {
    selectedIds.push(portaPotty.id);
    appliedRules.push('Porta Potty - Always selected');
  }

  // RULE: Debris Haulaway & Landfill - Always auto-select with quantity 1 (trailer for debris, NOT rolloff)
  const debrisLandfill = findItemByKeywords(availablePriceItems, [
    'debris haulaway', 'landfill'
  ]);
  if (debrisLandfill && !debrisLandfill.name.toLowerCase().includes('rolloff')) {
    selectedIds.push(debrisLandfill.id);
    appliedRules.push('Debris Haulaway & Landfill - Always selected');
  }

  // RULE: Overnights - Auto-select when Sergio or Hugo is selected as labor
  const isSergio = isLaborCrewSelected(context, ['sergio']);
  const isHugo = isLaborCrewSelected(context, ['hugo']);

  if (isSergio || isHugo) {
    const overnights = findItemByKeywords(availablePriceItems, [
      'overnight', 'overnights'
    ]);
    if (overnights) {
      selectedIds.push(overnights.id);
      const crew = isSergio ? 'Sergio' : 'Hugo';
      appliedRules.push(`Overnights - Auto-selected for ${crew}'s crew`);
    }
  }

  return { itemIds: selectedIds, rules: appliedRules };
}

/**
 * Main auto-selection function
 * Returns array of item IDs that should be auto-selected
 */
export function applyAutoSelectionRules(
  context: AutoSelectionContext
): AutoSelectionResult {
  // Detect roof type using multi-source detection
  const roofType = detectRoofType(context);

  // Apply all rule sets
  const underlaymentResult = applyUnderlaymentRules(context, roofType);
  const nailResult = applyNailRules(context, roofType);
  const equipmentResult = applyEquipmentRules(context);

  // Combine all selected item IDs (remove duplicates)
  const allSelectedIds = [
    ...underlaymentResult.itemIds,
    ...nailResult.itemIds,
    ...equipmentResult.itemIds,
  ];
  const uniqueIds = Array.from(new Set(allSelectedIds));

  // Combine all applied rules
  const allRules = [
    `Detected roof type: ${roofType}`,
    ...underlaymentResult.rules,
    ...nailResult.rules,
    ...equipmentResult.rules,
  ];

  return {
    autoSelectedItemIds: uniqueIds,
    detectedRoofType: roofType,
    appliedRules: allRules,
  };
}
