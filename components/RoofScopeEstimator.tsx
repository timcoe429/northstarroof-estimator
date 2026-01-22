'use client'

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Upload, DollarSign, Calculator, Settings, ChevronDown, ChevronUp, AlertCircle, Check, X, Edit2, Plus, Trash2, Package, Users, Truck, Wrench, FileText, Copy, Bot } from 'lucide-react';
import Image from 'next/image';
import type { Measurements, PriceItem, LineItem, CustomerInfo, Estimate, SavedQuote, VendorQuote, VendorQuoteItem } from '@/types';
import { saveQuote, loadQuotes, loadQuote, deleteQuote, loadPriceItems, savePriceItem, savePriceItemsBulk, deletePriceItemFromDB, saveVendorQuotes, loadVendorQuotes } from '@/lib/supabase';
import { generateProposalPDF } from '@/lib/generateProposal';
import { useAuth } from '@/lib/AuthContext';
import { CATEGORIES } from '@/lib/constants/categories';
import { UNIT_TYPES, CALC_MAPPINGS } from '@/lib/constants/unitTypes';
import { descriptionMap } from '@/lib/constants/descriptionMap';
import { generateId, toNumber, escapeRegExp, formatCurrency } from '@/lib/utils/helpers';
import { useFinancialSettings } from '@/lib/hooks/useFinancialSettings';
import { useCustomItems } from '@/lib/hooks/useCustomItems';
import { useSavedQuotes } from '@/lib/hooks/useSavedQuotes';
import { usePriceList } from '@/lib/hooks/usePriceList';
import { useMeasurements } from '@/lib/hooks/useMeasurements';
import { useJobDescription } from '@/lib/hooks/useJobDescription';
import { useVendorQuotes } from '@/lib/hooks/useVendorQuotes';
import { useEstimateBuilder } from '@/lib/hooks/useEstimateBuilder';
import { usePasteHandler } from '@/lib/hooks/usePasteHandler';

type SelectableItem = PriceItem & {
  isVendorItem?: boolean;
  vendorQuoteId?: string;
  vendorCategory?: VendorQuoteItem['vendor_category'];
  isCustomItem?: boolean;
};

type GroupedVendorItem = {
  id: string;
  name: string;
  category: PriceItem['category'];
  total: number;
  description: string;
  itemIds: string[];
  itemNames: string[];
};

type CustomItem = PriceItem & {
  isCustomItem: true;
};

type QuickSelectOption = {
  id: string;
  label: string;
  keyword: string;
  suggested: boolean;
  selected: boolean;
  icon?: string;
};

export default function RoofScopeEstimator() {
  const { user, signOut } = useAuth();
  const {
    marginPercent,
    setMarginPercent,
    officeCostPercent,
    setOfficeCostPercent,
    wastePercent,
    setWastePercent,
    sundriesPercent,
    setSundriesPercent,
    showFinancials,
    setShowFinancials,
    markupMultiplier,
  } = useFinancialSettings();
  
  // Core state
  const [step, setStep] = useState('upload');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({ name: '', address: '', phone: '' });

  // Temporary state for useCustomItems - will be set by useEstimateBuilder
  const [tempSelectedItems, setTempSelectedItems] = useState<string[]>([]);
  const [tempItemQuantities, setTempItemQuantities] = useState<Record<string, number>>({});

  const {
    customItems,
    setCustomItems,
    customItemDraft,
    setCustomItemDraft,
    startCustomItem,
    cancelCustomItem,
    addCustomItem,
  } = useCustomItems(setTempSelectedItems, setTempItemQuantities);


  const {
    savedQuotes,
    showSavedQuotes,
    setShowSavedQuotes,
    isLoadingQuotes,
    isSavingQuote,
    fetchSavedQuotes,
    saveCurrentQuote: saveCurrentQuoteHook,
    loadSavedQuote: loadSavedQuoteHook,
    deleteSavedQuote,
  } = useSavedQuotes(user?.id);


  // Placeholder for isTearOff - will be set by useJobDescription
  const isTearOffRef = useRef<boolean>(false);

  // Placeholder for analyzeJobForQuickSelections - will be set by useJobDescription
  let analyzeJobForQuickSelectionsRef: ((m: Measurements, descriptionOverride?: string) => void) | null = null;

  // Placeholder for initializeEstimateItems - will be set by useEstimateBuilder
  let initializeEstimateItemsRef: ((m: Measurements) => void) | null = null;

  const {
    measurements,
    setMeasurements,
    isProcessing,
    setIsProcessing,
    uploadedImages,
    setUploadedImages,
    fileToBase64,
    mergeMeasurements,
    extractSummaryImage,
    extractAnalysisImage,
    extractFromImage: extractFromImageHook,
  } = useMeasurements({
    setCustomerInfo,
    setStep,
    analyzeJobForQuickSelections: (m: Measurements, descriptionOverride?: string) => {
      if (analyzeJobForQuickSelectionsRef) {
        analyzeJobForQuickSelectionsRef(m, descriptionOverride);
      }
    },
    initializeEstimateItems: (m: Measurements) => {
      if (initializeEstimateItemsRef) {
        initializeEstimateItemsRef(m);
      }
    },
  });

  const buildSchaferDefaults = () => {
    const baseItems = [
      { name: 'Schafer Coil 20" 24ga', unit: 'sf', price: 1.70 },
      { name: 'Schafer Coil 48" 24ga Galvanized', unit: 'sf', price: 1.30 },
      { name: 'Schafer Panel Fabrication Steel SS150', unit: 'lf', price: 0.40 },
      { name: 'Schafer Panel Clip Mech 1-1/2" 24ga', unit: 'each', price: 0.25 },
      { name: 'Schafer Panel Clip Mech 1" 24ga', unit: 'each', price: 0.26 },
      { name: 'Schafer Pancake Screw 1" Galv/Zinc', unit: 'each', price: 0.08 },
      { name: 'Schafer Sheet 4x10 24ga', unit: 'sf', price: 68.00 },
      { name: 'Schafer Sheet 4x10 Galv 24ga', unit: 'sf', price: 46.00 },
      { name: 'Schafer Sheet 3x10 Copper 24oz', unit: 'sf', price: 300.00 },
      { name: 'Schafer Fab Eave', unit: 'lf', price: 1.15 },
      { name: 'Schafer Fab Rake', unit: 'lf', price: 1.15 },
      { name: 'Schafer Fab Rake Clip', unit: 'lf', price: 0.66 },
      { name: 'Schafer Fab Ridge', unit: 'lf', price: 0.99 },
      { name: 'Schafer Fab Half Ridge', unit: 'lf', price: 0.99 },
      { name: 'Schafer Fab CZ Flashing', unit: 'lf', price: 0.83 },
      { name: 'Schafer Fab Head Wall', unit: 'lf', price: 0.66 },
      { name: 'Schafer Fab Side Wall', unit: 'lf', price: 0.66 },
      { name: 'Schafer Fab Starter', unit: 'lf', price: 0.66 },
      { name: 'Schafer Fab W Valley', unit: 'lf', price: 1.50 },
      { name: 'Schafer Fab Transition', unit: 'lf', price: 0.51 },
      { name: 'Schafer Fab Drip Edge', unit: 'lf', price: 0.85 },
      { name: 'Schafer Fab Z Flash', unit: 'lf', price: 0.51 },
      { name: 'Schafer Fab Parapet Cap', unit: 'lf', price: 1.50 },
      { name: 'Schafer Fab Parapet Cleat', unit: 'lf', price: 0.50 },
      { name: 'Schafer Fab Line Fabrication', unit: 'each', price: 1.00 },
      { name: 'Schafer Job Site Panel Run (per mile)', unit: 'each', price: 3.00 },
      { name: 'Schafer Job Site Panel Run (base)', unit: 'each', price: 200.00 },
      { name: 'Schafer Retail Delivery Fee', unit: 'each', price: 0.28 },
      { name: 'Schafer Overnight Stay', unit: 'each', price: 500.00 },
      { name: 'Schafer Nova Seal Sealant', unit: 'each', price: 10.00 },
      { name: 'Schafer Pop Rivet 1/8"', unit: 'each', price: 0.12 },
      { name: 'Schafer Pop Rivet 1/8" Stainless', unit: 'each', price: 0.12 },
      { name: 'Schafer Woodgrip 1-1/2" Galv', unit: 'each', price: 0.12 },
    ];
    const timestamp = Date.now();
    let counter = 0;
    return baseItems.map(item => ({
      id: `schafer_${timestamp}_${counter++}`,
      name: item.name,
      unit: item.unit,
      price: item.price,
      coverage: null,
      coverageUnit: null,
      category: 'schafer' as PriceItem['category'],
      proposalDescription: null,
    }));
  };

  // Temporary vendor quote items state for usePriceList dependency
  // This is needed because usePriceList needs vendorItemMap, but useVendorQuotes needs priceItems
  const [tempVendorQuoteItems, setTempVendorQuoteItems] = useState<VendorQuoteItem[]>([]);
  const tempVendorItemMap = useMemo(() => {
    return new Map(tempVendorQuoteItems.map(item => [item.id, item]));
  }, [tempVendorQuoteItems]);

  const {
    priceItems,
    setPriceItems,
    showPrices,
    setShowPrices,
    priceSheetProcessing,
    setPriceSheetProcessing,
    extractedItems,
    setExtractedItems,
    editingItem,
    setEditingItem,
    activeCategory,
    setActiveCategory,
    isLoadingPriceItems,
    isGeneratingDescriptions,
    generationProgress,
    addPriceItem,
    updatePriceItem: updatePriceItemHook,
    deletePriceItem,
    applyExtractedPrices,
    generateAllDescriptions,
    getPriceListItems,
  } = usePriceList(user, buildSchaferDefaults, {
    vendorItemMap: tempVendorItemMap,
    setVendorQuoteItems: setTempVendorQuoteItems,
    setSelectedItems: setTempSelectedItems,
    setItemQuantities: setTempItemQuantities,
  });

  const {
    vendorQuotes,
    setVendorQuotes,
    vendorQuoteItems,
    setVendorQuoteItems,
    isExtractingVendorQuote,
    setIsExtractingVendorQuote,
    showVendorBreakdown,
    setShowVendorBreakdown,
    groupedVendorDescriptions,
    setGroupedVendorDescriptions,
    isGeneratingGroupDescriptions,
    setIsGeneratingGroupDescriptions,
    vendorItemMap,
    vendorQuoteMap,
    vendorQuoteItemSubtotals,
    vendorQuoteTotals,
    vendorOverheadByQuoteId,
    vendorAdjustedPriceMap,
    vendorTaxFeesTotal,
    vendorSelectableItems,
    groupedVendorItems,
    groupedVendorItemsForDescription,
    selectedVendorItemsTotal,
    groupedVendorItemsTotal,
    normalizeVendor,
    formatVendorName,
    findSchaferMatch,
    applySchaferQuoteMatching,
    extractVendorQuoteFromPdf,
    handleVendorQuoteUpload,
    removeVendorQuoteFromState,
    buildGroupedVendorItems,
  } = useVendorQuotes({
    priceItems,
    itemQuantities: tempItemQuantities,
    selectedItems: tempSelectedItems,
    setSelectedItems: setTempSelectedItems,
    setItemQuantities: setTempItemQuantities,
    fileToBase64,
    updatePriceItem: updatePriceItemHook,
  });

  // Sync vendorQuoteItems both ways to handle circular dependency
  useEffect(() => {
    if (JSON.stringify(tempVendorQuoteItems) !== JSON.stringify(vendorQuoteItems)) {
      setTempVendorQuoteItems(vendorQuoteItems);
    }
  }, [vendorQuoteItems, tempVendorQuoteItems]);

  useEffect(() => {
    if (JSON.stringify(vendorQuoteItems) !== JSON.stringify(tempVendorQuoteItems)) {
      setVendorQuoteItems(tempVendorQuoteItems);
    }
  }, [tempVendorQuoteItems, vendorQuoteItems, setVendorQuoteItems]);

  const {
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
  } = useEstimateBuilder({
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
  });

  // Sync temp state for useCustomItems and usePriceList/useVendorQuotes
  useEffect(() => {
    if (JSON.stringify(tempSelectedItems) !== JSON.stringify(selectedItems)) {
      setTempSelectedItems(selectedItems);
    }
  }, [selectedItems, tempSelectedItems]);

  useEffect(() => {
    if (JSON.stringify(selectedItems) !== JSON.stringify(tempSelectedItems)) {
      setSelectedItems(tempSelectedItems);
    }
  }, [tempSelectedItems, selectedItems, setSelectedItems]);

  useEffect(() => {
    if (JSON.stringify(tempItemQuantities) !== JSON.stringify(itemQuantities)) {
      setTempItemQuantities(itemQuantities);
    }
  }, [itemQuantities, tempItemQuantities]);

  useEffect(() => {
    if (JSON.stringify(itemQuantities) !== JSON.stringify(tempItemQuantities)) {
      setItemQuantities(tempItemQuantities);
    }
  }, [tempItemQuantities, itemQuantities, setItemQuantities]);

  const {
    jobDescription,
    setJobDescription,
    smartSelectionReasoning,
    setSmartSelectionReasoning,
    smartSelectionWarnings,
    setSmartSelectionWarnings,
    isGeneratingSelection,
    quickSelections,
    setQuickSelections,
    isTearOff,
    analyzeJobForQuickSelections,
    generateSmartSelection,
    removeKeywordFromDescription,
  } = useJobDescription(measurements, vendorQuotes, {
    measurements,
    allSelectableItems,
    vendorQuoteItems,
    vendorItemMap,
    itemQuantities,
    setItemQuantities,
    setSelectedItems,
  });

  // Update the refs
  analyzeJobForQuickSelectionsRef = analyzeJobForQuickSelections;
  isTearOffRef.current = isTearOff;
  initializeEstimateItemsRef = initializeEstimateItems;

  const vendorItemCount = vendorQuoteItems.length;

  // Extract prices from screenshot using Claude vision
  const extractPricesFromImage = async (file: File) => {
    setPriceSheetProcessing(true);

    try {
      const base64 = await fileToBase64(file);
      const dataUrl = `data:${file.type || 'image/png'};base64,${base64}`;

      const prompt = `You are extracting pricing from a roofing contractor's price sheet.

PRODUCT LINE RULES:
- Brava and DaVinci are DIFFERENT product lines (never mix them on same job)
- Brava products: Field Tile, Starter, H&R, H&R High Slope, Solids
- DaVinci products: Multi-Width Shake, Starter, H&R Hinged
- H&R High Slope / Hinged variants are for steep pitches (8/12 and above)
- Regular H&R is for standard pitches (below 8/12)

LABOR RULES:
- Crew names (Hugo, Alfredo, Chris, Sergio) are labor options
- Only ONE crew works a job - they are alternatives, not additions
- Different prices for different pitch difficulties (12/12 pitch, lower pitch, standard)

CATEGORIES:
- materials: Tiles, shingles, underlayment, flashing, valleys, ice & water
- labor: Crew names with per-square rates
- equipment: Rolloff, porto potty, fuel charges, rentals
- accessories: Boots, vents, snow guards, sealants, caulk, caps

ROOFING KNOWLEDGE:
- 1 square = 100 sq ft of roof area
- Starter is used along eaves and rakes
- H&R (Hip & Ridge) covers the hips and ridges
- High slope products are required for 8/12 pitch and above for safety/warranty
- Valleys need valley metal or ice & water shield
- Penetrations need pipe boots/flashings
- Labor is priced per square, varies by pitch difficulty

Extract each item with: name, category, unit, price, coverage information if available, and proposalDescription if available.

COVERAGE EXTRACTION:
Look for coverage information in the item description or notes:
- "10' length" or "10 ft" → coverage: 10, coverageUnit: "lf"
- "2 sq per roll" or "2 squares" → coverage: 2, coverageUnit: "sq"
- "200 sq ft per roll" or "200 sqft" → coverage: 200, coverageUnit: "sqft"
- "4 linear feet per piece" → coverage: 4, coverageUnit: "lf"
- "14.3 sq ft per bundle" → coverage: 14.3, coverageUnit: "sqft"
- If no coverage info found, use coverage: null, coverageUnit: null

PROPOSAL DESCRIPTION EXTRACTION:
- If the price sheet includes detailed descriptions or installation notes for items, extract them as proposalDescription
- Look for full sentences or detailed descriptions that explain what the item is or how it's installed
- If no description found, use proposalDescription: null

Return ONLY a JSON array like this:
[
  {"name": "Brava Field Tile", "unit": "bundle", "price": 43.25, "coverage": 14.3, "coverageUnit": "sqft", "category": "materials", "proposalDescription": null},
  {"name": "Copper D-Style Eave", "unit": "each", "price": 25.00, "coverage": 10, "coverageUnit": "lf", "category": "materials", "proposalDescription": null},
  {"name": "Hugo (standard)", "unit": "sq", "price": 550, "coverage": null, "coverageUnit": null, "category": "labor", "proposalDescription": null},
  {"name": "Rolloff", "unit": "sq", "price": 48, "coverage": null, "coverageUnit": null, "category": "equipment", "proposalDescription": null},
  {"name": "4\" Boot Galv", "unit": "each", "price": 20, "coverage": null, "coverageUnit": null, "category": "accessories", "proposalDescription": null}
]

Extract EVERY line item you can see. Return only the JSON array, no other text.`;

      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: dataUrl,
          prompt,
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to extract prices');
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || '';

      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const extracted = JSON.parse(jsonMatch[0]);
        setExtractedItems(extracted);
      } else {
        alert('Could not extract prices. Please try a clearer screenshot.');
      }
    } catch (error) {
      console.error('Price extraction error:', error);
      alert('Error processing image. Please try again.');
    }

    setPriceSheetProcessing(false);
  };

  // Merge measurements intelligently
  // Extract roof measurements from summary image (basic measurements)
  // Wrapper for extractFromImage that handles PDF vendor quotes first
  const extractFromImage = async (file: File) => {
    if (file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')) {
      // Create a synthetic event for handleVendorQuoteUpload
      const syntheticEvent = {
        target: { files: [file], value: '' },
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      await handleVendorQuoteUpload(syntheticEvent);
      return;
    }

    // For images, use the hook function
    await extractFromImageHook(file);
  };

  // Global paste handler
  usePasteHandler({
    showPrices,
    step,
    measurements,
    uploadedImages,
    extractFromImage,
    extractPricesFromImage,
  });

  const generateGroupedVendorDescriptions = async (_groups: GroupedVendorItem[]) => {
    return;
  };

  const buildClientViewSections = (estimate: Estimate) => {
    const vendorItemIds = new Set(vendorQuoteItems.map(item => item.id));

    const nonVendorMaterials = estimate.byCategory.materials.filter(item => !vendorItemIds.has(item.id));
    const nonVendorAccessories = estimate.byCategory.accessories.filter(item => !vendorItemIds.has(item.id));
    const nonVendorEquipment = estimate.byCategory.equipment.filter(item => !vendorItemIds.has(item.id));
    const nonVendorLabor = estimate.byCategory.labor.filter(item => !vendorItemIds.has(item.id));

    const groupedMaterials = groupedVendorItems.filter(group => group.category === 'materials' || group.category === 'accessories');
    const groupedEquipment = groupedVendorItems.filter(group => group.category === 'equipment');

    const materials = [
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
      ...groupedMaterials.map(group => ({
        name: group.name,
        description: group.description || group.name,
        total: group.total,
      })),
    ];

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

  const buildEstimateForClientPdf = (estimate: Estimate) => {
    const clientSections = buildClientViewSections(estimate);

    const buildLineItems = (items, category: LineItem['category']) => {
      return items.map((item, idx) => ({
        id: `client_${category}_${idx}`,
        name: item.name,
        unit: 'lot',
        price: item.total,
        coverage: null,
        coverageUnit: null,
        category,
        proposalDescription: item.description,
        baseQuantity: 1,
        quantity: 1,
        total: item.total,
        wasteAdded: 0,
      }));
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

  // Copy client view estimate to clipboard
  const copyClientViewToClipboard = async () => {
    if (!estimate) return;

    let text = `ROOFING ESTIMATE\n`;
    text += `${estimate.customerInfo.name || 'Customer'}\n`;
    text += `${estimate.customerInfo.address || 'Address'}\n`;
    text += `${estimate.generatedAt}\n\n`;

    const clientSections = buildClientViewSections(estimate);

    const sectionConfig = [
      { key: 'materials', label: 'Materials', items: clientSections.materials },
      { key: 'labor', label: 'Labor', items: clientSections.labor },
      { key: 'equipment', label: 'Equipment & Fees', items: clientSections.equipment },
    ];

    sectionConfig.forEach(section => {
      if (!section.items || section.items.length === 0) return;
      text += `${section.label.toUpperCase()}\n`;
      section.items.forEach(item => {
        const clientPrice = Math.round(item.total * markupMultiplier * 100) / 100;
        text += `${item.description}\t${formatCurrency(clientPrice)}\n`;
      });
      const sectionTotal = section.items.reduce((sum, item) => sum + item.total, 0);
      const clientSubtotal = Math.round(sectionTotal * markupMultiplier * 100) / 100;
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

  // Apply extracted prices to price list
  // Wrapper for updatePriceItem that handles vendor items
  const updatePriceItem = async (id: string, updates: Partial<PriceItem>) => {
    const vendorItem = vendorQuoteItems.find(item => item.id === id);
    if (vendorItem) {
      const updatedVendorItem: VendorQuoteItem = {
        ...vendorItem,
        name: updates.name ?? vendorItem.name,
        unit: updates.unit ?? vendorItem.unit,
        price: updates.price ?? vendorItem.price,
        category: (updates.category as VendorQuoteItem['category']) ?? vendorItem.category,
      };

      const recalculated = {
        ...updatedVendorItem,
        extended_price: (updatedVendorItem.quantity || 0) * (updatedVendorItem.price || 0),
      };

      setVendorQuoteItems(prev => prev.map(item => (
        item.id === id ? recalculated : item
      )));
      return;
    }

    await updatePriceItemHook(id, updates);
  };

  // File handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) extractFromImage(file);
  };

  const handlePriceSheetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) extractPricesFromImage(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) extractFromImage(file);
  };



  const resetEstimator = () => {
    setMeasurements(null);
    setEstimate(null);
    setSelectedItems([]);
    setItemQuantities({});
    setStep('upload');
    setCustomerInfo({ name: '', address: '', phone: '' });
    setUploadedImages(new Set());
    setJobDescription('');
    setSmartSelectionReasoning('');
    setSmartSelectionWarnings([]);
    setVendorQuotes([]);
    setVendorQuoteItems([]);
    setShowVendorBreakdown(false);
    setCustomItems([]);
    setCustomItemDraft(null);
  };

  // Wrapper functions that call hook functions with necessary parameters
  const saveCurrentQuote = async () => {
    if (!estimate) return;
    await saveCurrentQuoteHook(estimate, user, vendorQuotes, vendorQuoteItems);
  };

  const loadSavedQuote = async (quoteId: string) => {
    await loadSavedQuoteHook(quoteId, {
      setVendorQuotes,
      setVendorQuoteItems,
      setMeasurements,
      setCustomerInfo,
      setJobDescription,
      setMarginPercent,
      setOfficeCostPercent,
      setSundriesPercent,
      setWastePercent,
      setItemQuantities,
      setSelectedItems,
      setCustomItems,
      setEstimate,
      setStep,
      analyzeJobForQuickSelections,
      jobDescription,
    });
  };

  // Handle PDF download with loading state
  const handleDownloadProposal = async () => {
    if (!estimate) return;
    
    setIsGeneratingPDF(true);
    try {
      const pdfEstimate = groupedVendorItems.length > 0 ? buildEstimateForClientPdf(estimate) : estimate;
      const blob = await generateProposalPDF(pdfEstimate);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Proposal_${estimate.customerInfo.name || 'Customer'}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#00293f] text-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image
                src="/logo-white.png"
                alt="Northstar Roofing"
                width={40}
                height={40}
                className="h-10 w-auto"
              />
              <div>
                <h1 className="text-xl font-bold">Northstar Estimator</h1>
                <p className="text-xs text-gray-300">Roofing Estimate Calculator</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-300 hidden sm:block">
                {user?.email}
              </span>
              <button
                onClick={() => signOut()}
                className="bg-[#B1000F] hover:bg-[#8a000c] px-3 py-1.5 rounded text-sm font-medium transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Navigation Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-[73px] z-10">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPrices(!showPrices)}
                className="flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm"
              >
                <DollarSign className="w-4 h-4" />
                <span className="hidden sm:inline">My Price List</span>
                <span className="sm:hidden">Prices</span>
                ({priceItems.length}{vendorItemCount > 0 ? ` + ${vendorItemCount} vendor` : ''})
                {showPrices ? <ChevronUp className="w-4 h-4 hidden sm:inline" /> : <ChevronDown className="w-4 h-4 hidden sm:inline" />}
              </button>
              <div className="relative saved-quotes-dropdown">
                <button
                  onClick={() => setShowSavedQuotes(!showSavedQuotes)}
                  className={`flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-lg transition-colors text-sm ${showSavedQuotes ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 hover:bg-gray-200'}`}
                >
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">Saved Quotes</span>
                  <span className="sm:hidden">Quotes</span>
                  ({savedQuotes.length})
                  {showSavedQuotes ? <ChevronUp className="w-4 h-4 hidden sm:inline" /> : <ChevronDown className="w-4 h-4 hidden sm:inline" />}
                </button>
                {showSavedQuotes && (
                  <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-96 overflow-auto">
                    <div className="p-3 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-900 text-sm">Saved Quotes</h3>
                    </div>
                    {isLoadingQuotes ? (
                      <div className="p-6 text-center text-gray-500 text-sm">Loading...</div>
                    ) : savedQuotes.length === 0 ? (
                      <div className="p-6 text-center text-gray-500 text-sm">No saved quotes yet</div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {savedQuotes.map((quote) => (
                          <div key={quote.id} className="p-3 hover:bg-gray-50">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm text-gray-900 truncate">{quote.name}</div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {new Date(quote.created_at).toLocaleDateString()} • {formatCurrency(quote.sell_price)}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => loadSavedQuote(quote.id)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Load quote"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => deleteSavedQuote(quote.id, quote.name)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Delete quote"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowFinancials(!showFinancials)}
                className={`flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-lg transition-colors text-sm ${showFinancials ? 'bg-green-100 text-green-700' : 'bg-gray-100 hover:bg-gray-200'}`}
              >
                <Calculator className="w-4 h-4" />
                <span className="hidden sm:inline">Margin & Profit</span>
                <span className="sm:hidden">Margin</span>
              </button>
            </div>
          </div>
        </div>

        {/* Financial Controls */}
        {showFinancials && (
          <div className="border-t border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-3 md:py-4">
            <div className="max-w-5xl mx-auto">
              <div className="flex flex-wrap items-center gap-4 md:gap-8">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Waste</label>
                  <div className="flex items-center bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <input
                      type="number"
                      value={wastePercent}
                      onChange={(e) => setWastePercent(parseFloat(e.target.value) || 0)}
                      className="w-14 md:w-16 px-2 py-1.5 md:py-2 text-center font-semibold outline-none"
                      min="0"
                      max="50"
                    />
                    <span className="px-2 text-gray-400 bg-gray-50 text-sm">%</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Office</label>
                  <div className="flex items-center bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <input
                      type="number"
                      value={officeCostPercent}
                      onChange={(e) => setOfficeCostPercent(parseFloat(e.target.value) || 0)}
                      className="w-14 md:w-16 px-2 py-1.5 md:py-2 text-center font-semibold outline-none"
                      min="0"
                      max="50"
                    />
                    <span className="px-2 text-gray-400 bg-gray-50 text-sm">%</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Margin</label>
                  <div className="flex items-center bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <input
                      type="number"
                      value={marginPercent}
                      onChange={(e) => setMarginPercent(parseFloat(e.target.value) || 0)}
                      className="w-14 md:w-16 px-2 py-1.5 md:py-2 text-center font-semibold outline-none"
                      min="0"
                      max="80"
                    />
                    <span className="px-2 text-gray-400 bg-gray-50 text-sm">%</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Materials Allowance</label>
                  <div className="flex items-center bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <input
                      type="number"
                      value={sundriesPercent}
                      onChange={(e) => setSundriesPercent(parseFloat(e.target.value) || 0)}
                      className="w-14 md:w-16 px-2 py-1.5 md:py-2 text-center font-semibold outline-none"
                      min="0"
                      max="50"
                    />
                    <span className="px-2 text-gray-400 bg-gray-50 text-sm">%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Extracted Items Modal */}
      {extractedItems && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-4 md:p-6 max-h-[85vh] overflow-auto">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              <Check className="w-5 h-5 text-green-600" />
              Found {extractedItems.length} Items!
            </h3>
            <p className="text-sm text-gray-500 mb-4">Review and add to your price list</p>

            <div className="space-y-2 mb-6 max-h-64 md:max-h-96 overflow-auto">
              {extractedItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm block truncate">{item.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      item.category === 'materials' ? 'bg-blue-100 text-blue-700' :
                      item.category === 'labor' ? 'bg-green-100 text-green-700' :
                      item.category === 'equipment' ? 'bg-orange-100 text-orange-700' :
                      item.category === 'schafer' ? 'bg-blue-100 text-blue-700' :
                      'bg-purple-100 text-purple-700'
                    }`}>
                      {item.category}
                    </span>
                  </div>
                  <div className="text-right ml-2">
                    <span className="font-semibold text-sm">${item.price}</span>
                    <span className="text-gray-400 text-xs ml-1">/{item.unit}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setExtractedItems(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={applyExtractedPrices}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm"
              >
                Add All to Price List
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Price List Panel */}
      {showPrices && (
        <div className="border-b border-gray-200 bg-white">
          <div className="max-w-5xl mx-auto px-4 py-4 md:py-6">
            {/* Category Tabs - Scrollable on mobile */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
              {Object.entries(CATEGORIES).map(([key, { label, icon: Icon, color }]) => (
                <button
                  key={key}
                  onClick={() => setActiveCategory(key)}
                  className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-lg font-medium transition-colors whitespace-nowrap text-sm ${
                    activeCategory === key
                      ? key === 'schafer'
                        ? 'bg-red-100 text-red-700 border-2 border-red-300'
                        : `bg-${color}-100 text-${color}-700 border-2 border-${color}-300`
                      : key === 'schafer'
                        ? 'bg-red-50 text-red-700 hover:bg-red-100'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={activeCategory === key ? {
                    backgroundColor: key === 'schafer'
                      ? '#dc2626'
                      : color === 'blue'
                        ? '#dbeafe'
                        : color === 'green'
                          ? '#dcfce7'
                          : color === 'orange'
                            ? '#ffedd5'
                            : '#f3e8ff',
                    color: key === 'schafer'
                      ? '#ffffff'
                      : color === 'blue'
                        ? '#1d4ed8'
                        : color === 'green'
                          ? '#15803d'
                          : color === 'orange'
                            ? '#c2410c'
                            : '#7e22ce',
                  } : {}}
                >
                  <Icon className="w-4 h-4" />
                  {label} ({getPriceListItems(key).length})
                </button>
              ))}
            </div>

            {/* Items List */}
            <div className="bg-gray-50 rounded-xl p-3 md:p-4 max-h-64 overflow-auto">
              {getPriceListItems(activeCategory).length === 0 ? (
                <p className="text-center text-gray-400 py-8 text-sm">No items yet. Paste a price sheet or add manually.</p>
              ) : (
                <div className="space-y-2">
                  {getPriceListItems(activeCategory).map(item => {
                    const isVendorItem = false;
                    return (
                    <div key={item.id} className="flex items-center gap-2 md:gap-3 bg-white rounded-lg p-2 md:p-3 border border-gray-200">
                      {editingItem === item.id ? (
                        <>
                          {/* Desktop edit layout */}
                          <div className="hidden md:flex flex-1 items-center gap-2">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => updatePriceItem(item.id, { name: e.target.value })}
                              className="flex-1 px-2 py-1 border rounded"
                              autoFocus
                            />
                            <select
                              value={item.unit}
                              onChange={(e) => updatePriceItem(item.id, { unit: e.target.value })}
                              className="px-2 py-1 border rounded"
                            >
                              {UNIT_TYPES.map(u => (
                                <option key={u.value} value={u.value}>{u.label}</option>
                              ))}
                            </select>
                            <div className="flex items-center gap-1">
                              <span>$</span>
                              <input
                                type="number"
                                value={item.price}
                                onChange={(e) => updatePriceItem(item.id, { price: parseFloat(e.target.value) || 0 })}
                                className="w-24 px-2 py-1 border rounded"
                              />
                            </div>
                            {!isVendorItem && (
                              <>
                                <input
                                  type="number"
                                  value={item.coverage || ''}
                                  onChange={(e) => updatePriceItem(item.id, { coverage: e.target.value ? parseFloat(e.target.value) : null })}
                                  placeholder="Coverage"
                                  className="w-20 px-2 py-1 border rounded text-sm"
                                />
                                <select
                                  value={item.coverageUnit || ''}
                                  onChange={(e) => updatePriceItem(item.id, { coverageUnit: e.target.value || null })}
                                  className="px-2 py-1 border rounded text-sm"
                                >
                                  <option value="">Unit</option>
                                  <option value="lf">lf</option>
                                  <option value="sqft">sqft</option>
                                  <option value="sq">sq</option>
                                </select>
                              </>
                            )}
                            <button
                              onClick={() => setEditingItem(null)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          </div>
                          {!isVendorItem && (
                            <div className="hidden md:block w-full mt-2">
                              <label className="text-xs text-gray-600 block mb-1">Proposal Description (optional)</label>
                              <textarea
                                value={item.proposalDescription || ''}
                                onChange={(e) => updatePriceItem(item.id, { proposalDescription: e.target.value || null })}
                                placeholder="e.g., Install DaVinci Multi-Width Shake synthetic cedar shake roofing system per manufacturer specifications"
                                className="w-full px-2 py-1 border rounded text-sm"
                                rows={3}
                              />
                            </div>
                          )}
                          {/* Mobile edit layout */}
                          <div className="md:hidden flex-1 flex flex-col gap-2">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => updatePriceItem(item.id, { name: e.target.value })}
                              className="flex-1 px-2 py-1 border rounded text-sm"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <select
                                value={item.unit}
                                onChange={(e) => updatePriceItem(item.id, { unit: e.target.value })}
                                className="px-2 py-1 border rounded text-sm"
                              >
                                {UNIT_TYPES.map(u => (
                                  <option key={u.value} value={u.value}>{u.label}</option>
                                ))}
                              </select>
                              <div className="flex items-center gap-1">
                                <span className="text-sm">$</span>
                                <input
                                  type="number"
                                  value={item.price}
                                  onChange={(e) => updatePriceItem(item.id, { price: parseFloat(e.target.value) || 0 })}
                                  className="w-20 px-2 py-1 border rounded text-sm"
                                />
                              </div>
                              <button
                                onClick={() => setEditingItem(null)}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            </div>
                            {!isVendorItem && (
                              <>
                                <div className="flex gap-2">
                                  <input
                                    type="number"
                                    value={item.coverage || ''}
                                    onChange={(e) => updatePriceItem(item.id, { coverage: e.target.value ? parseFloat(e.target.value) : null })}
                                    placeholder="Coverage"
                                    className="flex-1 px-2 py-1 border rounded text-sm"
                                  />
                                  <select
                                    value={item.coverageUnit || ''}
                                    onChange={(e) => updatePriceItem(item.id, { coverageUnit: e.target.value || null })}
                                    className="px-2 py-1 border rounded text-sm"
                                  >
                                    <option value="">Unit</option>
                                    <option value="lf">lf</option>
                                    <option value="sqft">sqft</option>
                                    <option value="sq">sq</option>
                                  </select>
                                </div>
                                <div className="w-full mt-2">
                                  <label className="text-xs text-gray-600 block mb-1">Proposal Description (optional)</label>
                                  <textarea
                                    value={item.proposalDescription || ''}
                                    onChange={(e) => updatePriceItem(item.id, { proposalDescription: e.target.value || null })}
                                    placeholder="e.g., Install DaVinci Multi-Width Shake synthetic cedar shake roofing system per manufacturer specifications"
                                    className="w-full px-2 py-1 border rounded text-sm"
                                    rows={3}
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-medium text-sm md:text-base truncate">{item.name}</span>
                              {isVendorItem && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">
                                  Vendor
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-gray-400 text-sm hidden md:inline">{item.unit}</span>
                          <span className="font-semibold text-sm md:text-base">{formatCurrency(item.price)}</span>
                          {!isVendorItem && item.coverage && item.coverageUnit && (
                            <span className="text-gray-400 text-xs hidden md:inline">
                              ({item.coverage} {item.coverageUnit})
                            </span>
                          )}
                          <button
                            onClick={() => setEditingItem(item.id)}
                            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {!isVendorItem && (
                            <button
                              onClick={() => deletePriceItem(item.id)}
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4">
              <button
                onClick={addPriceItem}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
              
              <input
                type="file"
                accept="image/*"
                onChange={handlePriceSheetUpload}
                className="hidden"
                id="price-sheet-upload"
              />
              <label
                htmlFor="price-sheet-upload"
                className={`flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium cursor-pointer text-sm ${priceSheetProcessing ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {priceSheetProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Paste or Upload Price Sheet
                  </>
                )}
              </label>

              <button
                onClick={generateAllDescriptions}
                disabled={isGeneratingDescriptions || priceItems.filter(item => !item.proposalDescription?.trim()).length === 0}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors text-sm"
              >
                <Bot className="w-4 h-4" />
                {isGeneratingDescriptions 
                  ? `Generating ${generationProgress?.current || 0} of ${generationProgress?.total || 0}...`
                  : 'Generate Descriptions'
                }
              </button>
            </div>

            <p className="text-xs text-gray-400 mt-3 hidden sm:block">
              💡 Tip: Copy your price sheet and press <kbd className="px-1.5 py-0.5 bg-gray-200 rounded">Ctrl+V</kbd> to auto-extract
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 py-6 md:py-8">
        {/* Upload Step */}
        {step === 'upload' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => document.getElementById('file-upload').click()}
              className="border-2 border-dashed border-gray-300 rounded-2xl p-8 md:p-10 text-center bg-white hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
            >
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <div className="w-14 h-14 md:w-16 md:h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="w-7 h-7 md:w-8 md:h-8 text-blue-600" />
              </div>
              <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-2">
                Upload RoofScope
              </h2>
              <p className="text-gray-500 mb-2 text-sm md:text-base">
                For measurements
              </p>
              <p className="text-xs md:text-sm text-gray-400">
                <kbd className="px-2 py-1 bg-gray-100 rounded text-xs md:text-sm font-mono">Ctrl+V</kbd> to paste, or tap to upload
              </p>
            </div>

            <div
              onClick={() => document.getElementById('vendor-quote-upload').click()}
              className="border-2 border-dashed border-gray-300 rounded-2xl p-8 md:p-10 bg-white hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
            >
              <input
                type="file"
                accept="application/pdf,.pdf"
                multiple
                onChange={handleVendorQuoteUpload}
                className="hidden"
                id="vendor-quote-upload"
              />
              <div className="text-center">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-7 h-7 md:w-8 md:h-8 text-blue-600" />
                </div>
                <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-2">
                  Upload Vendor Quotes
                </h2>
                <p className="text-gray-500 mb-2 text-sm md:text-base">
                  Optional - Schafer, TRA, Rocky Mountain
                </p>
                {isExtractingVendorQuote && (
                  <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    Extracting quote...
                  </div>
                )}
              </div>

              {vendorQuotes.length > 0 && (
                <div className="mt-4 space-y-2">
                  {vendorQuotes.map((quote) => {
                    const itemCount = vendorQuoteItems.filter(item => item.vendor_quote_id === quote.id).length;
                    return (
                      <div key={quote.id} className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="min-w-0">
                          <div className="font-medium text-sm text-gray-900 truncate">
                            {formatVendorName(quote.vendor)} {quote.quote_number ? `• ${quote.quote_number}` : ''}
                          </div>
                          <div className="text-xs text-gray-500">
                            {itemCount} items • {formatCurrency((vendorQuoteTotals.get(quote.id) ?? quote.subtotal ?? 0))}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeVendorQuoteFromState(quote.id);
                          }}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                          title="Remove quote"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Processing */}
        {isProcessing && (
          <div className="bg-white rounded-2xl p-12 text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Reading Measurements...</h2>
            <p className="text-gray-500">Extracting roof data from your image</p>
          </div>
        )}

        {/* Review & Build Estimate */}
        {step === 'extracted' && measurements && (
          <div className="space-y-4 md:space-y-6">
            {/* Measurements Summary */}
            <div className="bg-white rounded-2xl p-4 md:p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="font-semibold text-gray-900">Roof Measurements</h2>
                  {/* Upload indicators */}
                  <div className="flex items-center gap-2">
                    {uploadedImages.has('summary') && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        <Check className="w-3 h-3" />
                        RoofScope Summary
                      </span>
                    )}
                    {uploadedImages.has('analysis') && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        <Check className="w-3 h-3" />
                        Roof Area Analysis
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={resetEstimator} className="text-xs md:text-sm text-gray-500 hover:text-gray-700">
                  Upload Different
                </button>
              </div>

              {/* Hint for additional image */}
              {uploadedImages.has('summary') && !uploadedImages.has('analysis') && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700 flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    <span>Paste your <strong>Roof Area Analysis</strong> image to extract slope breakdown (steep vs standard squares)</span>
                  </p>
                </div>
              )}

              {/* Vendor Quote Upload */}
              <div
                onClick={() => document.getElementById('vendor-quote-upload').click()}
                className="border-2 border-dashed border-gray-200 rounded-2xl p-4 md:p-6 bg-white hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer mb-4"
              >
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  onChange={handleVendorQuoteUpload}
                  className="hidden"
                  id="vendor-quote-upload"
                />
                <div className="text-center">
                  <div className="w-12 h-12 md:w-14 md:h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <FileText className="w-6 h-6 md:w-7 md:h-7 text-blue-600" />
                  </div>
                  <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-1">
                    Upload Vendor Quotes
                  </h3>
                  <p className="text-gray-500 mb-2 text-sm">
                    Optional - Schafer, TRA, Rocky Mountain
                  </p>
                  {isExtractingVendorQuote && (
                    <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      Extracting quote...
                    </div>
                  )}
                </div>

                {vendorQuotes.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {vendorQuotes.map((quote) => {
                      const itemCount = vendorQuoteItems.filter(item => item.vendor_quote_id === quote.id).length;
                      return (
                        <div key={quote.id} className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="min-w-0">
                            <div className="font-medium text-sm text-gray-900 truncate">
                              {formatVendorName(quote.vendor)} {quote.quote_number ? `• ${quote.quote_number}` : ''}
                            </div>
                            <div className="text-xs text-gray-500">
                              {itemCount} items • {formatCurrency((vendorQuoteTotals.get(quote.id) ?? quote.subtotal ?? 0))}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeVendorQuoteFromState(quote.id);
                            }}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                            title="Remove quote"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Customer Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6 p-3 md:p-4 bg-gray-50 rounded-xl">
                <input
                  type="text"
                  value={customerInfo.name}
                  onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Customer Name"
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <input
                  type="text"
                  value={customerInfo.address}
                  onChange={(e) => setCustomerInfo(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Address"
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <input
                  type="text"
                  value={customerInfo.phone}
                  onChange={(e) => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="Phone"
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>

              {/* Quick Selection Options */}
              {measurements && quickSelections.length > 0 && (
                <div className="bg-white rounded-2xl p-4 border border-gray-200 mb-4 md:mb-6">
                  <h3 className="font-medium text-gray-900 mb-3 text-sm">Quick Options</h3>
                  <div className="flex flex-wrap gap-2">
                    {quickSelections.map(option => (
                      <button
                        key={option.id}
                        onClick={() => {
                          const nextSelected = !option.selected;
                          setQuickSelections(prev => prev.map(opt => (
                            opt.id === option.id ? { ...opt, selected: nextSelected } : opt
                          )));

                          setJobDescription(prev => {
                            const hasKeyword = prev.toLowerCase().includes(option.keyword.toLowerCase());
                            if (!nextSelected) {
                              return removeKeywordFromDescription(prev, option.keyword);
                            }
                            if (hasKeyword) return prev;
                            return prev ? `${prev}, ${option.keyword}` : option.keyword;
                          });
                        }}
                        className={`
                          px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                          flex items-center gap-1.5
                          ${option.selected
                            ? 'bg-blue-600 text-white'
                            : option.suggested
                              ? 'bg-amber-50 border-2 border-amber-300 text-amber-800'
                              : 'bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200'
                          }
                        `}
                      >
                        <span>{option.icon}</span>
                        <span>{option.label}</span>
                        {option.suggested && !option.selected && (
                          <span className="text-xs opacity-75">(Suggested)</span>
                        )}
                      </button>
                    ))}
                  </div>
                  {quickSelections.some(option => option.suggested && !option.selected) && (
                    <p className="text-xs text-gray-500 mt-2">
                      💡 Amber buttons are AI suggestions based on job measurements
                    </p>
                  )}
                </div>
              )}

              {/* Measurements Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                {[
                  { key: 'total_squares', label: 'Squares', unit: 'sq' },
                  { key: 'predominant_pitch', label: 'Pitch', unit: '' },
                  { key: 'ridge_length', label: 'Ridge', unit: 'ft' },
                  { key: 'hip_length', label: 'Hips', unit: 'ft' },
                  { key: 'valley_length', label: 'Valleys', unit: 'ft' },
                  { key: 'eave_length', label: 'Eaves', unit: 'ft' },
                  { key: 'rake_length', label: 'Rakes', unit: 'ft' },
                  { key: 'penetrations', label: 'Penetrations', unit: '' },
                ].map(({ key, label, unit }) => (
                  <div key={key} className="bg-gray-50 rounded-lg p-2 md:p-3">
                    <div className="text-xs text-gray-500">{label}</div>
                    <div className="text-lg md:text-xl font-bold">
                      {measurements[key]} <span className="text-xs md:text-sm font-normal text-gray-400">{unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Job Description and Smart Selection */}
            <div className="bg-white rounded-2xl p-4 md:p-6 border border-gray-200">
              <h2 className="font-semibold text-gray-900 mb-4">Job Description</h2>
              <div className="space-y-3">
                <input
                  type="text"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Describe this job (e.g., 'Brava tile, tear-off, Hugo's crew, copper valleys')"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <button
                  onClick={() => generateSmartSelection()}
                  disabled={!jobDescription.trim() || allSelectableItems.length === 0 || isGeneratingSelection}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg flex items-center justify-center gap-2 text-sm"
                >
                  {isGeneratingSelection ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Generating Selection...
                    </>
                  ) : (
                    <>
                      <Calculator className="w-4 h-4" />
                      Generate Smart Selection
                    </>
                  )}
                </button>
                {smartSelectionReasoning && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-medium text-blue-900 mb-1">AI Reasoning:</p>
                    <p className="text-sm text-blue-700">{smartSelectionReasoning}</p>
                  </div>
                )}
                {smartSelectionWarnings.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm font-medium text-amber-900 mb-1">Warnings:</p>
                    <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
                      {smartSelectionWarnings.map((warning, idx) => (
                        <li key={idx}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Line Item Builder */}
            <div className="bg-white rounded-2xl p-4 md:p-6 border border-gray-200">
              <h2 className="font-semibold text-gray-900 mb-4">Build Your Estimate</h2>

              {allSelectableItems.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p className="mb-2 text-sm">No price items or vendor items yet.</p>
                  <button
                    onClick={() => setShowPrices(true)}
                    className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                  >
                    Add your prices first →
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(CATEGORIES).map(([catKey, { label, icon: Icon }]) => {
                    const items = getEstimateCategoryItems(catKey);

                    return (
                      <div key={catKey}>
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            {label}
                          </h3>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => startCustomItem(catKey as PriceItem['category'])}
                              className="p-1 rounded text-gray-500 hover:bg-gray-100"
                              title="Add custom item"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            {(['name', 'price', 'total'] as const).map((key) => {
                              const sortState = sectionSort[catKey];
                              const isActive = sortState?.key === key;
                              const arrow = isActive ? (sortState.direction === 'desc' ? '↓' : '↑') : '';
                              return (
                                <button
                                  key={key}
                                  onClick={() => toggleSectionSort(catKey, key)}
                                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                                    isActive
                                      ? 'bg-blue-500 text-white border-blue-500'
                                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                  }`}
                                >
                                  {key === 'name' ? 'Name' : key === 'price' ? 'Price' : 'Total'} {arrow}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {customItemDraft?.category === catKey && (
                          <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                              <input
                                type="text"
                                value={customItemDraft.name}
                                onChange={(e) => setCustomItemDraft(prev => prev ? { ...prev, name: e.target.value } : prev)}
                                placeholder="Item name"
                                className="px-2 py-1 border border-gray-200 rounded text-sm"
                              />
                              <input
                                type="number"
                                value={customItemDraft.quantity}
                                onChange={(e) => setCustomItemDraft(prev => prev ? { ...prev, quantity: parseFloat(e.target.value) || 0 } : prev)}
                                placeholder="Qty"
                                className="px-2 py-1 border border-gray-200 rounded text-sm"
                              />
                              <input
                                type="text"
                                value={customItemDraft.unit}
                                onChange={(e) => setCustomItemDraft(prev => prev ? { ...prev, unit: e.target.value } : prev)}
                                placeholder="Unit"
                                className="px-2 py-1 border border-gray-200 rounded text-sm"
                              />
                              <input
                                type="number"
                                value={customItemDraft.price}
                                onChange={(e) => setCustomItemDraft(prev => prev ? { ...prev, price: parseFloat(e.target.value) || 0 } : prev)}
                                placeholder="Unit price"
                                className="px-2 py-1 border border-gray-200 rounded text-sm"
                              />
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <button
                                onClick={addCustomItem}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm"
                              >
                                Add
                              </button>
                              <button
                                onClick={cancelCustomItem}
                                className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                        {items.length === 0 ? (
                          <div className="text-sm text-gray-400 py-3">
                            No items yet for this section.
                          </div>
                        ) : (
                        <div className="space-y-2">
                          {items.map(item => {
                            const isVendorItem = item.isVendorItem === true;
                            const isCustomItem = item.isCustomItem === true;
                            const isSchaferItem = item.category === 'schafer' && !isVendorItem;
                            const isSelected = selectedItems.includes(item.id);
                            const qty = itemQuantities[item.id] ?? (isVendorItem ? (vendorItemMap.get(item.id)?.quantity ?? 0) : 0);

                            return (
                              <div
                                key={item.id}
                                className={`p-3 rounded-lg border-2 transition-colors ${
                                  isSelected ? 'border-blue-300 bg-blue-50' : 'border-gray-100 bg-gray-50'
                                }`}
                              >
                                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedItems(prev => [...prev, item.id]);
                                        if (isVendorItem) {
                                          const vendorItem = vendorItemMap.get(item.id);
                                          setItemQuantities(prev => ({
                                            ...prev,
                                            [item.id]: prev[item.id] ?? vendorItem?.quantity ?? 0,
                                          }));
                                        }
                                      } else {
                                        setSelectedItems(prev => prev.filter(id => id !== item.id));
                                      }
                                    }}
                                    className="w-5 h-5 rounded flex-shrink-0"
                                  />
                                  <div className="flex-1 min-w-[120px]">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{item.name}</span>
                                      {isVendorItem && (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                          Vendor
                                        </span>
                                      )}
                                    {isSchaferItem && (
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                        Schafer
                                      </span>
                                    )}
                                    {isCustomItem && (
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                                        Custom
                                      </span>
                                    )}
                                    </div>
                                  </div>
                                  <input
                                    type="number"
                                    value={qty}
                                    onChange={(e) => setItemQuantities(prev => ({ ...prev, [item.id]: parseFloat(e.target.value) || 0 }))}
                                    className="w-20 px-2 py-1 border border-gray-200 rounded text-center"
                                  />
                                  <span className="text-gray-400 text-sm w-14">{item.unit}</span>
                                  <span className="text-gray-400">×</span>
                                  <span className="w-24 text-right">{formatCurrency(item.price)}</span>
                                  <span className="text-gray-400">=</span>
                                  <span className="w-28 text-right font-semibold text-blue-600">
                                    {formatCurrency(qty * item.price)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Generate Button */}
            {allSelectableItems.length > 0 && (
              <button
                onClick={calculateEstimate}
                disabled={selectedItems.length === 0}
                className="w-full py-3 md:py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Calculator className="w-5 h-5" />
                Generate Estimate ({selectedItems.length} items)
              </button>
            )}
          </div>
        )}

        {/* Final Estimate */}
        {step === 'estimate' && estimate && (
          <div className="space-y-4 md:space-y-6">
            {/* View Mode Toggle */}
            <div className="flex gap-2 mb-4 items-center">
              <button 
                onClick={() => setViewMode('internal')}
                className={viewMode === 'internal' ? 'bg-blue-500 text-white px-4 py-2 rounded' : 'bg-gray-200 px-4 py-2 rounded'}
              >
                Internal View
              </button>
              <button 
                onClick={() => setViewMode('client')}
                className={viewMode === 'client' ? 'bg-blue-500 text-white px-4 py-2 rounded' : 'bg-gray-200 px-4 py-2 rounded'}
              >
                Client View
              </button>
              {viewMode === 'client' && (
                <button
                  onClick={handleDownloadProposal}
                  disabled={isGeneratingPDF}
                  className={`ml-auto flex items-center gap-2 px-4 py-2 rounded text-white transition-colors ${
                    isGeneratingPDF 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {isGeneratingPDF ? 'Generating Proposal...' : '📄 Download Proposal PDF'}
                </button>
              )}
            </div>

            {/* Profit Summary Card - Internal View Only */}
            {viewMode === 'internal' && (
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-4 md:p-6 text-white">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                  <div>
                    <p className="text-green-100 text-xs md:text-sm">Total Cost</p>
                    <p className="text-lg md:text-2xl font-bold">{formatCurrency(estimate.totalCost)}</p>
                  </div>
                  <div>
                    <p className="text-green-100 text-xs md:text-sm">Sell Price</p>
                    <p className="text-lg md:text-2xl font-bold">{formatCurrency(estimate.sellPrice)}</p>
                  </div>
                  <div>
                    <p className="text-green-100 text-xs md:text-sm">Net Profit</p>
                    <p className="text-lg md:text-2xl font-bold">{formatCurrency(estimate.grossProfit)}</p>
                  </div>
                  <div>
                    <p className="text-green-100 text-xs md:text-sm">Profit Margin</p>
                    <p className="text-lg md:text-2xl font-bold">{estimate.profitMargin.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            )}

            {viewMode === 'internal' && vendorQuotes.length > 0 && (
              <div className="bg-white rounded-2xl p-4 md:p-6 border border-gray-200">
                <button
                  onClick={() => setShowVendorBreakdown(prev => !prev)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div>
                    <h3 className="text-sm md:text-base font-semibold text-gray-900">Vendor Breakdown</h3>
                    <p className="text-xs md:text-sm text-gray-500">Quote details and vendor totals</p>
                  </div>
                  {showVendorBreakdown ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </button>
                {showVendorBreakdown && (
                  <div className="mt-4 space-y-2">
                    {vendorQuotes.map(quote => (
                      <div key={quote.id} className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-lg">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {formatVendorName(quote.vendor)} {quote.quote_number ? `• ${quote.quote_number}` : ''}
                          </div>
                          <div className="text-xs text-gray-500">
                            {quote.quote_date || 'Date unknown'}
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-gray-900">
                          {formatCurrency((vendorQuoteTotals.get(quote.id) ?? quote.total ?? quote.subtotal ?? 0))}
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200 text-sm font-semibold">
                      <span>Total Vendor Cost</span>
                      <span>
                        {formatCurrency(
                          vendorQuotes.reduce((sum, quote) => sum + (vendorQuoteTotals.get(quote.id) ?? quote.total ?? quote.subtotal ?? 0), 0)
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="bg-white rounded-2xl p-4 md:p-6 border border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900">Roofing Estimate</h2>
                  <p className="text-gray-500 text-sm">
                    {estimate.customerInfo.name || 'Customer'} • {estimate.customerInfo.address || 'Address'}
                  </p>
                  <p className="text-xs md:text-sm text-gray-400">{estimate.generatedAt}</p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-xs md:text-sm text-gray-500">Quote to Customer</p>
                  <p className="text-2xl md:text-4xl font-bold text-gray-900">{formatCurrency(estimate.sellPrice)}</p>
                </div>
              </div>

              {/* Line Items by Category */}
              {viewMode === 'client' ? (
                <>
                  {(() => {
                    const clientSections = buildClientViewSections(estimate);
                    const sections = [
                      { label: 'Materials', items: clientSections.materials },
                      { label: CATEGORIES.labor.label, items: clientSections.labor },
                      { label: CATEGORIES.equipment.label, items: clientSections.equipment },
                    ];

                    return sections.map(section => {
                      if (!section.items || section.items.length === 0) return null;
                      const sectionTotal = section.items.reduce((sum, item) => sum + item.total, 0);

                      return (
                        <div key={section.label} className="mb-4 md:mb-6">
                          <h3 className="text-xs md:text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 md:mb-3">{section.label}</h3>
                          <div className="space-y-2">
                            {section.items.map((item, idx) => {
                              const clientPrice = Math.round(item.total * markupMultiplier * 100) / 100;
                              return (
                                <div key={idx} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                                  <div className="flex-1 min-w-0">
                                    <span className="font-medium text-sm block truncate">{item.description}</span>
                                  </div>
                                  <span className="font-semibold text-sm ml-2">{formatCurrency(clientPrice)}</span>
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex justify-between mt-2 pt-2 border-t border-gray-200 text-sm">
                            <span className="text-gray-600">{section.label} Subtotal</span>
                            <span className="font-bold">
                              {formatCurrency(Math.round(sectionTotal * markupMultiplier * 100) / 100)}
                            </span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </>
              ) : (
                /* Internal View: Show all categories separately */
                Object.entries(CATEGORIES).map(([catKey, { label }]) => {
                  const items = estimate.byCategory[catKey];
                  if (!items || items.length === 0) return null;

                  return (
                    <div key={catKey} className="mb-4 md:mb-6">
                      <h3 className="text-xs md:text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 md:mb-3">{label}</h3>
                      <div className="space-y-2">
                        {items.map((item, idx) => {
                          const vendorItem = vendorItemMap.get(item.id);
                          const vendorQuote = vendorItem ? vendorQuoteMap.get(vendorItem.vendor_quote_id) : null;
                          const displayPrice = vendorItem ? (vendorItem.price || 0) : item.price;
                          const displayTotal = vendorItem ? (item.quantity * displayPrice) : item.total;

                          return (
                            <div key={idx} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm block truncate">{item.name}</span>
                                  {vendorItem && vendorQuote && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">
                                      {formatVendorName(vendorQuote.vendor)} Vendor
                                    </span>
                                  )}
                                </div>
                                <span className="text-gray-400 text-xs">
                                  {item.quantity} {item.unit} × {formatCurrency(displayPrice)}
                                  {item.wasteAdded > 0 && (
                                    <span className="text-orange-500 ml-1">(+{item.wasteAdded} waste)</span>
                                  )}
                                </span>
                              </div>
                              <span className="font-semibold text-sm ml-2">{formatCurrency(displayTotal)}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-between mt-2 pt-2 border-t border-gray-200 text-sm">
                        <span className="text-gray-600">{label} Subtotal</span>
                        <span className="font-bold">
                          {formatCurrency(estimate.totals[catKey])}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Financial Summary */}
              <div className="border-t-2 border-gray-200 pt-4 mt-4 md:mt-6 space-y-2 md:space-y-3 text-sm">
                {viewMode === 'internal' ? (
                  <>
                    <div className="flex justify-between text-gray-600">
                      <span>Materials Subtotal ({estimate.wastePercent}% waste)</span>
                      <span>{formatCurrency(estimate.totals.materials)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Labor Subtotal</span>
                      <span>{formatCurrency(estimate.totals.labor)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Equipment Subtotal</span>
                      <span>{formatCurrency(estimate.totals.equipment)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Accessories Subtotal</span>
                      <span>{formatCurrency(estimate.totals.accessories)}</span>
                    </div>
                    {vendorTaxFeesTotal > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>Vendor Tax & Fees (included)</span>
                        <span>{formatCurrency(vendorTaxFeesTotal)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-gray-600">
                      <span>Materials Allowance ({estimate.sundriesPercent}%)</span>
                      <span>{formatCurrency(estimate.sundriesAmount)}</span>
                    </div>
                    <div className="flex justify-between font-medium border-t border-gray-200 pt-2 md:pt-3">
                      <span>Base Cost</span>
                      <span>{formatCurrency(estimate.baseCost)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Office ({estimate.officeCostPercent}%)</span>
                      <span>+{formatCurrency(estimate.officeAllocation)}</span>
                    </div>
                    <div className="flex justify-between font-medium border-t border-gray-200 pt-2 md:pt-3">
                      <span>Total Cost</span>
                      <span>{formatCurrency(estimate.totalCost)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Margin ({estimate.marginPercent}%)</span>
                      <span>+{formatCurrency(estimate.grossProfit)}</span>
                    </div>
                    <div className="flex justify-between items-center border-t-2 border-gray-900 pt-3 md:pt-4">
                      <div>
                        <p className="text-lg md:text-xl font-bold">Customer Price</p>
                        <p className="text-xs md:text-sm text-gray-500">
                          {estimate.measurements.total_squares} sq • {estimate.measurements.predominant_pitch}
                        </p>
                      </div>
                      <p className="text-2xl md:text-3xl font-bold">{formatCurrency(estimate.sellPrice)}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-gray-600">
                      <span>Materials Subtotal</span>
                      <span>{formatCurrency(Math.round((estimate.totals.materials + estimate.totals.accessories) * markupMultiplier * 100) / 100)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Labor Subtotal</span>
                      <span>{formatCurrency(Math.round(estimate.totals.labor * markupMultiplier * 100) / 100)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Equipment Subtotal</span>
                      <span>{formatCurrency(Math.round(estimate.totals.equipment * markupMultiplier * 100) / 100)}</span>
                    </div>
                    <div className="flex justify-between items-center border-t-2 border-gray-900 pt-3 md:pt-4">
                      <div>
                        <p className="text-lg md:text-xl font-bold">TOTAL</p>
                      </div>
                      <p className="text-2xl md:text-3xl font-bold">{formatCurrency(estimate.sellPrice)}</p>
                    </div>
                  </>
                )}
              </div>

              {/* Profit Breakdown (Internal Only) */}
              {viewMode === 'internal' && (
                <div className="mt-4 md:mt-6 p-3 md:p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-center gap-2 text-amber-800 mb-2">
                    <AlertCircle className="w-4 h-4" />
                    <span className="font-semibold text-xs md:text-sm">Internal Only</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 md:gap-4 text-xs md:text-sm">
                    <div>
                      <span className="text-amber-700 block">Cost</span>
                      <span className="font-bold text-amber-900">{formatCurrency(estimate.totalCost)}</span>
                    </div>
                    <div>
                      <span className="text-amber-700 block">Profit</span>
                      <span className="font-bold text-green-700">{formatCurrency(estimate.grossProfit)}</span>
                    </div>
                    <div>
                      <span className="text-amber-700 block">Margin</span>
                      <span className="font-bold text-green-700">{estimate.profitMargin.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
              {viewMode === 'client' && (
                <button
                  onClick={copyClientViewToClipboard}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 text-sm md:text-base"
                >
                  <Copy className="w-4 h-4" />
                  Copy for Proposal
                </button>
              )}
              <button
                onClick={() => setStep('extracted')}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm md:text-base"
              >
                Edit Estimate
              </button>
              <button
                onClick={saveCurrentQuote}
                disabled={isSavingQuote}
                className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold rounded-xl flex items-center justify-center gap-2 text-sm md:text-base"
              >
                {isSavingQuote ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5" />
                    Save Quote
                  </>
                )}
              </button>
              <button
                onClick={resetEstimator}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 text-sm md:text-base"
              >
                <Upload className="w-5 h-5" />
                New Estimate
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
