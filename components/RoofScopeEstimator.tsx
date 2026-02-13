'use client'

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Upload, DollarSign, Calculator, Settings, ChevronDown, ChevronUp, ChevronRight, AlertCircle, Check, X, Edit2, Plus, Trash2, Package, Users, Truck, Wrench, FileText, Copy, Bot } from 'lucide-react';
import Image from 'next/image';
import type { Measurements, PriceItem, LineItem, CustomerInfo, Estimate, SavedQuote, VendorQuote, VendorQuoteItem, AIDetectedStructure } from '@/types';
import { saveQuote, loadQuotes, loadQuote, deleteQuote, loadPriceItems, savePriceItem, savePriceItemsBulk, deletePriceItemFromDB, saveVendorQuotes, loadVendorQuotes, updateShareSettings } from '@/lib/supabase';
import { generateProposalPDF } from '@/lib/generateProposal';
import { useAuth } from '@/lib/AuthContext';
import { CATEGORIES, UNIT_TYPES, CALC_MAPPINGS, descriptionMap } from '@/lib/constants';
import type { SelectableItem, GroupedVendorItem, CustomItem, QuickSelectOption, ValidationWarning } from '@/types/estimator';
import { fileToBase64, generateId, normalizeVendor, formatVendorName, toNumber, escapeRegExp, removeKeywordFromDescription, formatCurrency, mergeMeasurements } from '@/lib/estimatorUtils';
import { matchSchaferDescription } from '@/lib/schaferMatching';
import { useEstimateCalculation } from '@/hooks/useEstimateCalculation';
import { buildClientViewSections, buildEstimateForClientPdf, copyClientViewToClipboard as copyClientViewToClipboardUtil } from '@/lib/clientViewBuilder';
import { organizeProposal, type OrganizedProposal } from '@/lib/proposalOrganizer';
import { applyAutoSelectionRules } from '@/lib/autoSelectionRules';
import { usePriceItems } from '@/hooks/usePriceItems';
import { useVendorQuotes } from '@/hooks/useVendorQuotes';
import { useImageExtraction } from '@/hooks/useImageExtraction';
import { useSmartSelection } from '@/hooks/useSmartSelection';
import { useSavedQuotes } from '@/hooks/useSavedQuotes';
import { useFinancialControls } from '@/hooks/useFinancialControls';
import { useUIState } from '@/hooks/useUIState';
import { useCustomItems } from '@/hooks/useCustomItems';
import { useProjectManager } from '@/hooks/useProjectManager';
import { PriceListPanel, EstimateBuilder, FinancialSummary, UploadStep, ReviewStep, EstimateView, CalculatedAccessories } from '@/components/estimator';

export default function RoofScopeEstimator() {
  const { user, companyId, signOut } = useAuth();
  
  // Debug: Log when companyId changes
  useEffect(() => {
    console.log('[RoofScopeEstimator] companyId from useAuth:', companyId, 'type:', typeof companyId);
  }, [companyId]);

  // Core state that must remain in main component
  const [step, setStep] = useState('upload');
  const [measurements, setMeasurements] = useState<Measurements | null>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({ name: '', address: '', phone: '' });
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [uploadedImages, setUploadedImages] = useState<Set<string>>(new Set());
  const [validationWarnings, setValidationWarnings] = useState<ValidationWarning[]>([]);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [skylightCount, setSkylightCount] = useState(0);
  const [missingAccessoryItems, setMissingAccessoryItems] = useState<string[]>([]);
  const [savedEstimateId, setSavedEstimateId] = useState<string | undefined>(undefined);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareEnabled, setShareEnabled] = useState(false);
  const [sectionHeaders, setSectionHeaders] = useState<Estimate['sectionHeaders']>({
    materials: 'Materials',
    labor: 'Labor',
    equipment: 'Equipment & Fees',
    accessories: 'Accessories',
    schafer: 'Vendor Quote',
  });
  const [manualOverrides, setManualOverrides] = useState<Record<string, { quantity?: boolean; price?: boolean; name?: boolean }>>({});
  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>({});
  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>({});
  const [organizedProposal, setOrganizedProposal] = useState<OrganizedProposal | null>(null);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [roofScopeImages, setRoofScopeImages] = useState<string[]>([]);
  const [lastDetection, setLastDetection] = useState<{ structures: AIDetectedStructure[]; summary: string; confidence: string } | null>(null);
  const [aiStatus, setAiStatus] = useState<string | null>(null);

  // Initialize AI Project Manager
  const projectManager = useProjectManager(savedEstimateId ?? null);
  const structuresForValidation = projectManager.aiContext?.structures ?? lastDetection?.structures ?? [];

  // Initialize hooks
  const financialControls = useFinancialControls();
  const uiState = useUIState();
  const customItems = useCustomItems({
    onItemAdded: (itemId, quantity) => {
      setSelectedItems(prev => [...prev, itemId]);
      setItemQuantities(prev => ({ ...prev, [itemId]: quantity }));
    },
  });

  // Initialize vendor quotes hook
  const vendorQuotes = useVendorQuotes({
    selectedItems,
    itemQuantities,
    priceItems: [], // Will be set after priceItems hook is initialized
    onSetSelectedItems: setSelectedItems,
    onSetItemQuantities: setItemQuantities,
  });

  // Initialize price items hook
  const priceItems = usePriceItems({
    companyId: companyId ?? undefined,
    vendorQuoteItems: vendorQuotes.vendorQuoteItems,
    vendorQuoteMap: vendorQuotes.vendorQuoteMap,
    onSetEditingItem: uiState.setEditingItem,
    onUpdateVendorItem: (id, updates) => {
      const item = vendorQuotes.vendorQuoteItems.find(i => i.id === id);
      if (!item) return;
      vendorQuotes.setVendorQuoteItems(prev =>
        prev.map(i => i.id === id ? { ...i, ...updates } as VendorQuoteItem : i)
      );
    },
    onDeleteVendorItem: (id) => {
      vendorQuotes.setVendorQuoteItems(prev => prev.filter(i => i.id !== id));
      setSelectedItems(prev => prev.filter(itemId => itemId !== id));
      setItemQuantities(prev => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
    },
  });

  // Update vendorQuotes hook with priceItems (needed for dependency)
  useEffect(() => {
    // This is a workaround since we can't pass priceItems directly during initialization
    // The hook will work with the priceItems from the usePriceItems hook
  }, [priceItems.priceItems]);

  // All selectable items (price list + vendor items + custom items) with overrides applied
  const allSelectableItems: SelectableItem[] = useMemo(() => {
    const items = [...priceItems.priceItems, ...vendorQuotes.vendorSelectableItems, ...customItems.customItems];
    // Apply price and name overrides
    return items.map(item => {
      const overriddenItem = { ...item };
      if (priceOverrides[item.id] !== undefined) {
        overriddenItem.price = priceOverrides[item.id];
      }
      if (nameOverrides[item.id] !== undefined) {
        overriddenItem.name = nameOverrides[item.id];
      }
      return overriddenItem;
    });
  }, [priceItems.priceItems, vendorQuotes.vendorSelectableItems, customItems.customItems, priceOverrides, nameOverrides]);

  // Detect metal roof (Schafer vendor quote present)
  const isMetalRoof = useMemo(() => {
    return vendorQuotes.vendorQuotes.some(q => q.vendor === 'schafer');
  }, [vendorQuotes.vendorQuotes]);

  const vendorItemCount = vendorQuotes.vendorQuoteItems.length;

  // Initialize smart selection hook
  const smartSelection = useSmartSelection({
    measurements,
    vendorQuotes: vendorQuotes.vendorQuotes,
    allSelectableItems,
    vendorQuoteItems: vendorQuotes.vendorQuoteItems,
    vendorItemMap: vendorQuotes.vendorItemMap,
    itemQuantities,
    isTearOff: false, // Will be overridden by hook's internal calculation
    onSetItemQuantities: setItemQuantities,
    onSetSelectedItems: setSelectedItems,
    onSetJobDescription: (desc) => {
      if (typeof desc === 'function') {
        smartSelection.setJobDescription(desc);
      } else {
        smartSelection.setJobDescription(desc);
      }
    },
  });

  // Auto-selection callback - triggers after RoofScope upload
  const handleApplyAutoSelection = useCallback((m: Measurements) => {
    // Only auto-select if we have price items available
    if (allSelectableItems.length === 0) {
      return;
    }

    try {
      const result = applyAutoSelectionRules({
        jobDescription: smartSelection.jobDescription,
        availablePriceItems: allSelectableItems,
        vendorQuotes: vendorQuotes.vendorQuotes,
        vendorQuoteItems: vendorQuotes.vendorQuoteItems,
        selectedLaborItems: selectedItems.filter(id => {
          const item = allSelectableItems.find(i => i.id === id);
          return item?.category === 'labor';
        }),
      });

      // Calculate quantities for auto-selected items
      const autoSelectedQuantities: Record<string, number> = {};
      result.autoSelectedItemIds.forEach(itemId => {
        const item = allSelectableItems.find(i => i.id === itemId);
        if (!item) return;

        const itemName = item.name.toLowerCase();
        let qty = 0;

        // Equipment items: Porto Potty, Rolloff/Dumpster = 1
        if (itemName.includes('porto') || itemName.includes('porta potty') ||
            itemName.includes('rolloff') || itemName.includes('dumpster') ||
            itemName.includes('landfill') || itemName.includes('overnights')) {
          qty = 1;
        }
        // Materials with coverage: calculate based on roof size
        else if (item.coverage && item.coverageUnit) {
          const coverage = typeof item.coverage === 'string' ? parseFloat(item.coverage) : item.coverage;
          const coverageUnit = item.coverageUnit.toLowerCase();

          if (coverageUnit === 'sq') {
            // Coverage in squares
            qty = Math.ceil(m.total_squares / coverage);
          } else if (coverageUnit === 'sqft') {
            // Coverage in square feet
            qty = Math.ceil((m.total_squares * 100) / coverage);
          } else if (coverageUnit === 'lf') {
            // Linear coverage - use perimeter as default
            const perimeter = (m.eave_length || 0) + (m.rake_length || 0);
            qty = Math.ceil(perimeter / coverage);
          }
        }
        // Default to 1 for other items
        else {
          qty = 1;
        }

        autoSelectedQuantities[itemId] = qty;
      });

      // Merge auto-selected items with any existing selections (e.g., from vendor quotes)
      setSelectedItems(prev => {
        const combined = [...prev, ...result.autoSelectedItemIds];
        return Array.from(new Set(combined)); // Remove duplicates
      });

      // Merge auto-selected quantities with existing quantities
      setItemQuantities(prev => ({
        ...prev,
        ...autoSelectedQuantities,
      }));

      console.log('Auto-selection applied:', result.appliedRules);
      console.log('Auto-selected quantities:', autoSelectedQuantities);
    } catch (error) {
      console.error('Auto-selection error:', error);
      // Don't alert user - auto-selection is optional enhancement
    }
  }, [allSelectableItems, smartSelection.jobDescription, vendorQuotes.vendorQuotes, vendorQuotes.vendorQuoteItems, selectedItems]);

  // Callback when RoofScope image is extracted - run AI structure detection
  const handleRoofScopeImageExtracted = useCallback(
    (dataUrls: string | string[]) => {
      const newImages = Array.isArray(dataUrls) ? dataUrls : [dataUrls];
      const updatedImages = [...roofScopeImages, ...newImages];
      setRoofScopeImages(updatedImages);
      setAiStatus('Analyzing document structure...');
      projectManager
        .detectStructures(updatedImages)
        .then((result) => {
          if (result.structures.length !== (lastDetection?.structures.length ?? 0)) {
            console.log(
              `Structure count changed: ${lastDetection?.structures.length ?? 0} → ${result.structures.length}`
            );
          }
          if (!savedEstimateId) setLastDetection(result);
        })
        .catch((err) => {
          console.error('AI structure detection failed:', err);
          setAiStatus('AI detection failed');
        })
        .finally(() => setAiStatus(null));
    },
    [roofScopeImages, savedEstimateId, projectManager, lastDetection?.structures.length]
  );

  // Initialize image extraction hook
  const imageExtraction = useImageExtraction({
    measurements,
    uploadedImages,
    onSetMeasurements: setMeasurements,
    onSetCustomerInfo: setCustomerInfo,
    onSetUploadedImages: setUploadedImages,
    onSetStep: setStep,
    onSetExtractedItems: priceItems.setExtractedItems,
    onSetPriceSheetProcessing: priceItems.setPriceSheetProcessing,
    onAnalyzeJobForQuickSelections: smartSelection.analyzeJobForQuickSelections,
    onApplyAutoSelection: handleApplyAutoSelection,
    onExtractVendorQuoteFromPdf: vendorQuotes.extractVendorQuoteFromPdf,
    onSetVendorQuotes: vendorQuotes.setVendorQuotes,
    onSetVendorQuoteItems: vendorQuotes.setVendorQuoteItems,
    onSetIsExtractingVendorQuote: (extracting) => {}, // Managed by vendorQuotes hook
    onSetSelectedItems: setSelectedItems,
    onSetItemQuantities: setItemQuantities,
    onRoofScopeImageExtracted: handleRoofScopeImageExtracted,
  });

  // Auto-select Overnights when Sergio or Hugo labor is selected
  useEffect(() => {
    // Check if Sergio or Hugo labor is currently selected
    const hasSergio = selectedItems.some(itemId => {
      const item = allSelectableItems.find(i => i.id === itemId);
      return item?.category === 'labor' && item.name.toLowerCase().includes('sergio');
    });

    const hasHugo = selectedItems.some(itemId => {
      const item = allSelectableItems.find(i => i.id === itemId);
      return item?.category === 'labor' && item.name.toLowerCase().includes('hugo');
    });

    if (hasSergio || hasHugo) {
      // Find Overnights item
      const overnightsItem = allSelectableItems.find(item =>
        item.name.toLowerCase().includes('overnight')
      );

      // Only add if Overnights exists and isn't already selected
      if (overnightsItem && !selectedItems.includes(overnightsItem.id)) {
        setSelectedItems(prev => [...prev, overnightsItem.id]);
        console.log('Auto-selected Overnights for', hasSergio ? 'Sergio' : 'Hugo');
      }
    }
  }, [selectedItems, allSelectableItems]);

  // Initialize estimate calculation hook
  const {
    calculateEstimate: calculateEstimateHook,
    calculateItemQuantities: calculateItemQuantitiesHook,
    validationWarnings: calcValidationWarnings,
  } = useEstimateCalculation({
    measurements,
    priceItems: priceItems.priceItems,
    allSelectableItems,
    selectedItems,
    itemQuantities,
    marginPercent: financialControls.marginPercent,
    officeCostPercent: financialControls.officeCostPercent,
    wastePercent: financialControls.wastePercent,
    sundriesPercent: financialControls.sundriesPercent,
    salesTaxPercent: financialControls.salesTaxPercent,
    customerInfo,
    vendorAdjustedPriceMap: vendorQuotes.vendorAdjustedPriceMap,
    isTearOff: smartSelection.isTearOff,
  });

  const calculateItemQuantities = calculateItemQuantitiesHook;

  // Manual organization trigger with guard against concurrent calls
  const organizingRef = useRef(false);

  const triggerOrganization = useCallback(async (est: Estimate) => {
    if (organizingRef.current) return;
    organizingRef.current = true;
    setIsOrganizing(true);
    
    try {
      const result = await organizeProposal(
        est,
        manualOverrides,
        vendorQuotes.vendorQuoteItems,
        vendorQuotes.groupedVendorItems
      );
      setOrganizedProposal(result);
    } catch (error) {
      console.error('Error organizing proposal:', error);
    } finally {
      setIsOrganizing(false);
      organizingRef.current = false;
    }
  }, [manualOverrides, vendorQuotes.vendorQuoteItems, vendorQuotes.groupedVendorItems]);

  // Wrapper for calculateEstimate that updates local state
  const calculateEstimate = useCallback(() => {
    const result = calculateEstimateHook();
    if (result) {
      // Preserve section headers and manual overrides from line items
      const updatedEstimate: Estimate = {
        ...result,
        sectionHeaders: sectionHeaders,
        lineItems: result.lineItems.map(item => ({
          ...item,
          manualOverrides: manualOverrides[item.id],
        })),
        optionalItems: result.optionalItems.map(item => ({
          ...item,
          manualOverrides: manualOverrides[item.id],
        })),
      };
      setEstimate(updatedEstimate);
      setValidationWarnings(calcValidationWarnings);
      setStep('estimate');
      // Trigger organization after estimate is calculated
      if (updatedEstimate) {
        triggerOrganization(updatedEstimate);
      }
    }
  }, [calculateEstimateHook, calcValidationWarnings, sectionHeaders, manualOverrides, triggerOrganization]);

  // Calculate quantities for ALL items when measurements change
  // Skip recalculation when loading a saved quote to prevent overwriting restored quantities
  useEffect(() => {
    if (isLoadingQuote) return; // Skip during quote load
    if (measurements && priceItems.priceItems.length > 0) {
      const calculatedQtys = calculateItemQuantities(measurements);
      setItemQuantities(prev => {
        // Merge calculated quantities with existing quantities
        // Preserve any manually set quantities or vendor item quantities
        const merged = { ...calculatedQtys };
        // Override with any existing non-zero quantities (user may have manually adjusted)
        Object.keys(prev).forEach(key => {
          if (prev[key] !== undefined && prev[key] !== calculatedQtys[key]) {
            // Keep the existing value if it differs (user likely set it manually)
            merged[key] = prev[key];
          }
        });
        return merged;
      });
      console.log('Calculated quantities for all items after measurements changed');
    }
  }, [measurements, priceItems.priceItems, calculateItemQuantities, isLoadingQuote]);

  // Initialize saved quotes hook
  const savedQuotes = useSavedQuotes({
    userId: user?.id,
    companyId: companyId ?? undefined,
    estimate,
    vendorQuotes: vendorQuotes.vendorQuotes,
    vendorQuoteItems: vendorQuotes.vendorQuoteItems,
    onSetVendorQuotes: vendorQuotes.setVendorQuotes,
    onSetVendorQuoteItems: vendorQuotes.setVendorQuoteItems,
    onSetMeasurements: setMeasurements,
    onSetCustomerInfo: setCustomerInfo,
    onSetJobDescription: smartSelection.setJobDescription,
    onSetMarginPercent: financialControls.setMarginPercent,
    onSetOfficeCostPercent: financialControls.setOfficeCostPercent,
    onSetSundriesPercent: financialControls.setSundriesPercent,
    onSetWastePercent: financialControls.setWastePercent,
    onSetSalesTaxPercent: financialControls.setSalesTaxPercent,
    onSetItemQuantities: setItemQuantities,
    onSetSelectedItems: setSelectedItems,
    onSetCustomItems: (items) => {
      // Restore custom items when loading a saved quote
      customItems.setCustomItems(items);
    },
    onSetEstimate: (est: Estimate | null) => {
      setEstimate(est);
      if (est?.sectionHeaders) {
        setSectionHeaders(est.sectionHeaders);
      }
      if (est?.lineItems) {
        // Extract manual overrides, price overrides, and name overrides from line items
        const overrides: Record<string, { quantity?: boolean; price?: boolean; name?: boolean }> = {};
        const prices: Record<string, number> = {};
        const names: Record<string, string> = {};
        est.lineItems.forEach(item => {
          if (item.manualOverrides) {
            overrides[item.id] = item.manualOverrides;
            if (item.manualOverrides.price) {
              prices[item.id] = item.price;
            }
            if (item.manualOverrides.name) {
              names[item.id] = item.name;
            }
          }
        });
        setManualOverrides(overrides);
        setPriceOverrides(prices);
        setNameOverrides(names);
      }
    },
    onSetStep: setStep,
    onSetShowVendorBreakdown: vendorQuotes.setShowVendorBreakdown,
    onAnalyzeJobForQuickSelections: smartSelection.analyzeJobForQuickSelections,
    onCalculateEstimate: calculateEstimate,
    onSetIsLoadingQuote: setIsLoadingQuote,
    jobDescription: smartSelection.jobDescription,
  });

  // Handle inline item updates
  const handleUpdateItem = useCallback((itemId: string, field: 'name' | 'quantity' | 'price' | 'unit', value: string | number) => {
    if (field === 'quantity') {
      setItemQuantities(prev => ({ ...prev, [itemId]: value as number }));
      setManualOverrides(prev => ({
        ...prev,
        [itemId]: { ...prev[itemId], quantity: true },
      }));
      setOrganizedProposal(null); // Invalidate organization when items change
    } else if (field === 'price') {
      // Update price in priceItems or vendor items
      const item = allSelectableItems.find(i => i.id === itemId);
      if (item) {
        if (item.isVendorItem) {
          vendorQuotes.setVendorQuoteItems(prev =>
            prev.map(i => i.id === itemId ? { ...i, price: value as number } : i)
          );
        } else {
          // Store price override for non-vendor items
          setPriceOverrides(prev => ({ ...prev, [itemId]: value as number }));
        }
        setManualOverrides(prev => ({
          ...prev,
          [itemId]: { ...prev[itemId], price: true },
        }));
        setOrganizedProposal(null); // Invalidate organization when items change
        // Trigger recalculation for price changes
        if (estimate && step === 'estimate') {
          setTimeout(() => calculateEstimate(), 100);
        }
      }
    } else if (field === 'name') {
      // Store name override
      setNameOverrides(prev => ({ ...prev, [itemId]: value as string }));
      setManualOverrides(prev => ({
        ...prev,
        [itemId]: { ...prev[itemId], name: true },
      }));
      setOrganizedProposal(null); // Invalidate organization when items change
      // Name change doesn't require recalculation, just re-render
    } else if (field === 'unit') {
      // Unit change - update itemQuantities might be needed
      setManualOverrides(prev => ({
        ...prev,
        [itemId]: { ...prev[itemId], quantity: true },
      }));
      setOrganizedProposal(null); // Invalidate organization when items change
      // Trigger recalculation for unit changes
      if (estimate && step === 'estimate') {
        setTimeout(() => calculateEstimate(), 100);
      }
    }
    // Trigger recalculation for quantity changes
    if (field === 'quantity' && estimate && step === 'estimate') {
      setTimeout(() => calculateEstimate(), 100);
    }
  }, [allSelectableItems, vendorQuotes, estimate, step, calculateEstimate]);

  // Handle reset override
  const handleResetOverride = useCallback((itemId: string, field: 'quantity' | 'price' | 'name') => {
    setManualOverrides(prev => {
      const updated = { ...prev };
      if (updated[itemId]) {
        updated[itemId] = { ...updated[itemId], [field]: false };
        if (!updated[itemId].quantity && !updated[itemId].price && !updated[itemId].name) {
          delete updated[itemId];
        }
      }
      return updated;
    });
    setOrganizedProposal(null); // Invalidate organization when items change
    // Clear overrides
    if (field === 'price') {
      setPriceOverrides(prev => {
        const updated = { ...prev };
        delete updated[itemId];
        return updated;
      });
      // Trigger recalculation to restore original price
      if (estimate && step === 'estimate') {
        setTimeout(() => calculateEstimate(), 100);
      }
    } else if (field === 'name') {
      setNameOverrides(prev => {
        const updated = { ...prev };
        delete updated[itemId];
        return updated;
      });
      // Name change doesn't require recalculation, just re-render
    } else if (field === 'quantity' && measurements) {
      // Recalculate quantities if resetting quantity override
      const calculatedQtys = calculateItemQuantities(measurements);
      setItemQuantities(prev => ({ ...prev, [itemId]: calculatedQtys[itemId] ?? 0 }));
      // Trigger recalculation
      if (estimate && step === 'estimate') {
        setTimeout(() => calculateEstimate(), 100);
      }
    }
  }, [measurements, calculateItemQuantities, estimate, step, calculateEstimate]);

  // Handle section header update
  const handleUpdateSectionHeader = useCallback((category: string, header: string) => {
    setSectionHeaders(prev => ({
      ...prev,
      [category]: header,
    }));
    // Update estimate if it exists
    if (estimate) {
      setEstimate(prev => prev ? { ...prev, sectionHeaders: { ...sectionHeaders, [category]: header } } : null);
    }
  }, [estimate, sectionHeaders]);

  // Auto-recalculate estimate when financial controls change (if estimate already exists)
  useEffect(() => {
    if (estimate && step === 'estimate' && measurements && selectedItems.length > 0) {
      calculateEstimate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [financialControls.wastePercent, financialControls.marginPercent, financialControls.officeCostPercent, financialControls.sundriesPercent, financialControls.salesTaxPercent]);

  // Debounced material validation when structures and line items change
  useEffect(() => {
    if (!savedEstimateId || structuresForValidation.length === 0 || !estimate) return;

    const lineItems = [...estimate.lineItems, ...(estimate.optionalItems ?? [])];
    if (lineItems.length === 0) return;

    const timeoutId = setTimeout(() => {
      setAiStatus('Validating material compatibility...');
      projectManager
        .validateMaterials(structuresForValidation, lineItems)
        .catch((err) => console.error('Material validation failed:', err))
        .finally(() => setAiStatus(null));
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [savedEstimateId, structuresForValidation, estimate, selectedItems, itemQuantities, projectManager]);

  // Auto-select rolloffs for tear-off jobs
  useEffect(() => {
    if (!measurements || !smartSelection.isTearOff) return;
    const rolloffIds = priceItems.priceItems
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
  }, [measurements, smartSelection.isTearOff, priceItems.priceItems]);

  // Global paste handler for images and PDFs
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const itemsArray = Array.from(items);
      for (const item of itemsArray) {
        if (item.type === 'application/pdf') {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) return;

          if (step === 'upload' || step === 'extracted') {
            imageExtraction.extractFromImage(file);
          }
          break;
        }

        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) return;

          if (uiState.showPrices) {
            imageExtraction.extractPricesFromImage(file);
          } else if (step === 'upload' || step === 'extracted') {
            // Allow pasting in 'extracted' step to add analysis image
            imageExtraction.extractFromImage(file);
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [uiState.showPrices, step, measurements, uploadedImages, imageExtraction]);

  // Build client view sections wrapper
  const buildClientViewSectionsWrapper = (estimate: Estimate) => {
    return buildClientViewSections({
      estimate,
      vendorQuoteItems: vendorQuotes.vendorQuoteItems,
      groupedVendorItems: vendorQuotes.groupedVendorItems,
      organizedProposal: organizedProposal || undefined,
    });
  };

  const buildEstimateForClientPdfWrapper = (estimate: Estimate) => {
    return buildEstimateForClientPdf(
      estimate,
      vendorQuotes.vendorQuoteItems,
      vendorQuotes.groupedVendorItems,
      organizedProposal || undefined
    );
  };

  const copyClientViewToClipboard = async () => {
    if (!estimate) return;
    await copyClientViewToClipboardUtil(
      estimate,
      vendorQuotes.vendorQuoteItems,
      vendorQuotes.groupedVendorItems,
      organizedProposal || undefined
    );
  };

  // Reset estimator
  const resetEstimator = () => {
    setStep('upload');
    setMeasurements(null);
    setEstimate(null);
    setCustomerInfo({ name: '', address: '', phone: '' });
    setSelectedItems([]);
    setItemQuantities({});
    setUploadedImages(new Set());
    setRoofScopeImages([]);
    setLastDetection(null);
    setSavedEstimateId(undefined);
    setShareToken(null);
    setShareEnabled(false);
    vendorQuotes.setVendorQuotes([]);
    vendorQuotes.setVendorQuoteItems([]);
    smartSelection.setJobDescription('');
    smartSelection.setQuickSelections([]);
    setValidationWarnings([]);
    setSkylightCount(0);
  };

  // Helper functions for child components
  const getPriceListItems = (category: string) => {
    const items = category === 'schafer'
      ? priceItems.priceItems.filter(item => item.category === 'schafer')
      : priceItems.priceItems.filter(item => item.category === category && item.category !== 'schafer');

    // Apply sorting
    const sort = uiState.sectionSort[category];
    if (!sort) return items;

    return [...items].sort((a, b) => {
      if (sort.key === 'name') {
        return sort.direction === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
      if (sort.key === 'price') {
        const aPrice = a.price || 0;
        const bPrice = b.price || 0;
        return sort.direction === 'asc' ? aPrice - bPrice : bPrice - aPrice;
      }
      return 0;
    });
  };

  const getItemQuantity = (item: SelectableItem) => {
    if (itemQuantities[item.id] !== undefined) {
      return itemQuantities[item.id];
    }
    if (item.isVendorItem) {
      const vendorItem = vendorQuotes.vendorItemMap.get(item.id);
      return vendorItem?.quantity || 0;
    }
    return 0;
  };

  const toggleSectionSort = (category: string, key: 'name' | 'price' | 'total') => {
    uiState.setSectionSort(prev => {
      const current = prev[category];
      const newDirection = current?.key === key && current?.direction === 'asc' ? 'desc' : 'asc';
      return {
        ...prev,
        [category]: { key, direction: newDirection },
      };
    });
  };

  const getEstimateCategoryItems = (category: string) => {
    return allSelectableItems.filter(item => {
      if (category === 'schafer') {
        return item.category === 'schafer' || (item.isVendorItem && vendorQuotes.vendorQuoteMap.get((item as any).vendorQuoteId)?.vendor === 'schafer');
      }
      return item.category === category && item.category !== 'schafer';
    });
  };

  const toggleSection = (sectionKey: string) => {
    uiState.setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionKey)) {
        next.delete(sectionKey);
      } else {
        next.add(sectionKey);
      }
      return next;
    });
  };

  // Handle PDF download with loading state
  const handleDownloadProposal = async () => {
    if (!estimate) return;

    setIsGeneratingPDF(true);
    try {
      let aiSuggestions: string | undefined;

      // Run preflight check if we have saved estimate (don't block PDF on failure)
      if (savedEstimateId) {
        try {
          setAiStatus('Running final validation...');
          const preflight = await projectManager.runPreflightCheck(estimate);
          if (!preflight.ready) {
            console.warn('Preflight check warnings:', preflight.warnings);
          }
          if (preflight.introLetterSuggestions) {
            aiSuggestions = preflight.introLetterSuggestions;
          }
        } catch (err) {
          console.error('Preflight check failed:', err);
        } finally {
          setAiStatus(null);
        }
      }

      // If organized proposal doesn't exist, organize first
      if (!organizedProposal) {
        await triggerOrganization(estimate);
      }

      const pdfEstimate = vendorQuotes.groupedVendorItems.length > 0 || organizedProposal 
        ? buildEstimateForClientPdfWrapper(estimate) 
        : estimate;
      const blob = await generateProposalPDF(pdfEstimate, aiSuggestions);
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

  // Load quotes on mount
  useEffect(() => {
    savedQuotes.fetchSavedQuotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close saved quotes dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (uiState.showSavedQuotes && !target.closest('.saved-quotes-dropdown')) {
        uiState.setShowSavedQuotes(false);
      }
    };

    if (uiState.showSavedQuotes) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [uiState.showSavedQuotes]);

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
                onClick={() => uiState.setShowPrices(!uiState.showPrices)}
                className="flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm"
              >
                <DollarSign className="w-4 h-4" />
                <span className="hidden sm:inline">My Price List</span>
                <span className="sm:hidden">Prices</span>
                ({priceItems.priceItems.length}{vendorItemCount > 0 ? ` + ${vendorItemCount} vendor` : ''})
                {uiState.showPrices ? <ChevronUp className="w-4 h-4 hidden sm:inline" /> : <ChevronDown className="w-4 h-4 hidden sm:inline" />}
              </button>
              <div className="relative saved-quotes-dropdown">
                <button
                  onClick={() => uiState.setShowSavedQuotes(!uiState.showSavedQuotes)}
                  className={`flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-lg transition-colors text-sm ${uiState.showSavedQuotes ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 hover:bg-gray-200'}`}
                >
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">Saved Quotes</span>
                  <span className="sm:hidden">Quotes</span>
                  ({savedQuotes.savedQuotes.length})
                  {uiState.showSavedQuotes ? <ChevronUp className="w-4 h-4 hidden sm:inline" /> : <ChevronDown className="w-4 h-4 hidden sm:inline" />}
                </button>
                {uiState.showSavedQuotes && (
                  <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-96 overflow-auto">
                    <div className="p-3 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-900 text-sm">Saved Quotes</h3>
                    </div>
                    {savedQuotes.isLoadingQuotes ? (
                      <div className="p-6 text-center text-gray-500 text-sm">Loading...</div>
                    ) : savedQuotes.savedQuotes.length === 0 ? (
                      <div className="p-6 text-center text-gray-500 text-sm">No saved quotes yet</div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {savedQuotes.savedQuotes.map((quote) => (
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
                                  onClick={async () => {
                                    const shareData = await savedQuotes.loadSavedQuote(quote.id);
                                    if (shareData) {
                                      setRoofScopeImages([]);
                                      setLastDetection(null);
                                      setSavedEstimateId(shareData.estimateId);
                                      setShareToken(shareData.shareToken);
                                      setShareEnabled(shareData.shareEnabled);
                                    }
                                  }}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Load quote"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => savedQuotes.deleteSavedQuote(quote.id, quote.name)}
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
                onClick={() => uiState.setShowFinancials(!uiState.showFinancials)}
                className={`flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-lg transition-colors text-sm ${uiState.showFinancials ? 'bg-green-100 text-green-700' : 'bg-gray-100 hover:bg-gray-200'}`}
              >
                <Calculator className="w-4 h-4" />
                <span className="hidden sm:inline">Margin & Profit</span>
                <span className="sm:hidden">Margin</span>
              </button>
            </div>
          </div>
        </div>

        {/* Financial Controls */}
        {uiState.showFinancials && (
          <div className="border-t border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-3 md:py-4">
            <div className="max-w-5xl mx-auto">
              <div className="flex flex-wrap items-center gap-4 md:gap-8">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Waste</label>
                  <div className="flex items-center bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <input
                      type="number"
                      value={financialControls.wastePercent}
                      onChange={(e) => financialControls.setWastePercent(parseFloat(e.target.value) || 0)}
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
                      value={financialControls.officeCostPercent}
                      onChange={(e) => financialControls.setOfficeCostPercent(parseFloat(e.target.value) || 0)}
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
                      value={financialControls.marginPercent}
                      onChange={(e) => financialControls.setMarginPercent(parseFloat(e.target.value) || 0)}
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
                      value={financialControls.sundriesPercent}
                      onChange={(e) => financialControls.setSundriesPercent(parseFloat(e.target.value) || 0)}
                      className="w-14 md:w-16 px-2 py-1.5 md:py-2 text-center font-semibold outline-none"
                      min="0"
                      max="50"
                    />
                    <span className="px-2 text-gray-400 bg-gray-50 text-sm">%</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Sales Tax</label>
                  <div className="flex items-center bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <input
                      type="number"
                      value={financialControls.salesTaxPercent}
                      onChange={(e) => financialControls.setSalesTaxPercent(parseFloat(e.target.value) || 0)}
                      className="w-14 md:w-16 px-2 py-1.5 md:py-2 text-center font-semibold outline-none"
                      min="0"
                      max="20"
                    />
                    <span className="px-2 text-gray-400 bg-gray-50 text-sm">%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* AI Status Banner */}
      {aiStatus && (
        <div className="fixed top-20 right-4 z-50 max-w-sm">
          <div
            className={`px-4 py-3 rounded-lg shadow-lg flex items-center space-x-3 ${
              aiStatus.toLowerCase().includes('failed')
                ? 'bg-red-600 text-white'
                : 'bg-blue-600 text-white'
            }`}
          >
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent flex-shrink-0" />
            <div>
              <p className="font-medium">
                {aiStatus.toLowerCase().includes('failed') ? 'AI Error' : 'AI Working'}
              </p>
              <p className={`text-sm ${aiStatus.toLowerCase().includes('failed') ? 'text-red-100' : 'text-blue-100'}`}>
                {aiStatus}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Extracted Items Modal */}
      {priceItems.extractedItems && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-4 md:p-6 max-h-[85vh] overflow-auto">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              <Check className="w-5 h-5 text-green-600" />
              Found {priceItems.extractedItems.length} Items!
            </h3>
            <p className="text-sm text-gray-500 mb-4">Review and add to your price list</p>

            <div className="space-y-2 mb-6 max-h-64 md:max-h-96 overflow-auto">
              {priceItems.extractedItems.map((item, idx) => (
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
                onClick={() => priceItems.setExtractedItems(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={priceItems.applyExtractedPrices}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm"
              >
                Add All to Price List
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Price List Panel */}
      {uiState.showPrices && (
        <PriceListPanel
          activeCategory={uiState.activeCategory}
          editingItem={uiState.editingItem}
          priceSheetProcessing={priceItems.priceSheetProcessing}
          onCategoryChange={uiState.setActiveCategory}
          onEditItem={uiState.setEditingItem}
          onSaveItem={() => uiState.setEditingItem(null)}
          onAddItem={() => priceItems.addPriceItem(uiState.activeCategory)}
          onDeleteItem={priceItems.deletePriceItem}
          onUpdateItem={priceItems.updatePriceItem}
          onPriceSheetUpload={imageExtraction.handlePriceSheetUpload}
          getPriceListItems={getPriceListItems}
        />
      )}

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 py-6 md:py-8">
        {/* AI Validation Warnings */}
        {(step === 'extracted' || step === 'estimate') && projectManager.aiContext && projectManager.aiContext.warnings.filter((w) => !w.dismissed).length > 0 && (
          <div className="mb-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">AI Validation Warnings</h3>
            {projectManager.aiContext.warnings
              .filter((w) => !w.dismissed)
              .map((warning) => (
                <div
                  key={warning.id}
                  className={`p-3 rounded-lg border ${
                    warning.severity === 'error'
                      ? 'bg-red-50 border-red-200'
                      : warning.severity === 'warning'
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{warning.message}</p>
                      {warning.suggestion && (
                        <p className="text-sm text-gray-600 mt-1">💡 {warning.suggestion}</p>
                      )}
                    </div>
                    <button
                      onClick={() => projectManager.dismissWarning(warning.id)}
                      className="ml-2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Upload Step */}
        {(step === 'upload' || imageExtraction.isProcessing) && (
          <UploadStep
            vendorQuotes={vendorQuotes.vendorQuotes}
            vendorQuoteItems={vendorQuotes.vendorQuoteItems}
            isExtractingVendorQuote={vendorQuotes.isExtractingVendorQuote}
            isProcessing={imageExtraction.isProcessing}
            onFileUpload={imageExtraction.handleFileUpload}
            onDrop={imageExtraction.handleDrop}
            onVendorQuoteUpload={vendorQuotes.handleVendorQuoteUpload}
            onRemoveVendorQuote={vendorQuotes.removeVendorQuoteFromState}
          />
        )}

        {/* Review & Build Estimate */}
        {step === 'extracted' && measurements && (
          <div className="space-y-4 md:space-y-6">
            {/* Structure Detection Loading */}
            {projectManager.isLoading && structuresForValidation.length === 0 && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">AI analyzing RoofScope...</p>
                    <p className="text-xs text-blue-700">Detecting structures and extracting measurements</p>
                  </div>
                </div>
              </div>
            )}

            {/* Material Validation Loading */}
            {projectManager.isLoading &&
              structuresForValidation.length > 0 &&
              estimate &&
              [...(estimate.lineItems ?? []), ...(estimate.optionalItems ?? [])].length > 0 && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600 flex-shrink-0" />
                    <p className="text-sm text-yellow-900">Validating material compatibility...</p>
                  </div>
                </div>
              )}

            {/* Multi-Structure Overview Panel */}
            {structuresForValidation.length > 1 && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Multi-Structure Property Detected
                </h3>
                <p className="text-sm text-gray-700 mb-4">
                  AI detected {structuresForValidation.length} structures. Review each building below.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {structuresForValidation.map((structure) => (
                    <div
                      key={structure.id}
                      className="p-3 bg-white border border-gray-200 rounded-lg"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-gray-900">{structure.name}</h4>
                          <p className="text-sm text-gray-600">
                            Type: {structure.type} • {structure.measurements.total_squares.toFixed(1)} SQ
                          </p>
                        </div>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${
                            structure.hasAnalysisPage ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {structure.hasAnalysisPage ? 'Detailed' : 'Estimated'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 space-y-1">
                        <div>Pitch: {structure.measurements.predominant_pitch || 'N/A'}</div>
                        <div>Eave: {structure.measurements.eave_length} LF</div>
                        <div>Valley: {structure.measurements.valley_length} LF</div>
                        {!structure.hasAnalysisPage && (
                          <p className="text-yellow-700 mt-2">
                            No analysis page - measurements estimated
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-white border border-gray-300 rounded">
                  <p className="text-sm text-gray-700">
                    <strong>Total Combined:</strong>{' '}
                    {structuresForValidation
                      .reduce((sum, s) => sum + s.measurements.total_squares, 0)
                      .toFixed(1)}{' '}
                    SQ across {structuresForValidation.length} buildings
                  </p>
                </div>
              </div>
            )}

            {/* AI Detection Confidence */}
            {lastDetection && (
              <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded">
                <p className="text-sm text-gray-700">
                  <strong>AI Detection Summary:</strong> {lastDetection.summary}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Confidence:{' '}
                  {lastDetection.confidence === 'high'
                    ? 'High'
                    : lastDetection.confidence === 'medium'
                      ? 'Medium'
                      : 'Low'}
                </p>
                {lastDetection.confidence === 'low' && (
                  <p className="text-xs text-yellow-700 mt-1">
                    Low confidence - recommend uploading analysis pages for accurate measurements
                  </p>
                )}
              </div>
            )}

            <ReviewStep
              measurements={measurements}
              customerInfo={customerInfo}
              uploadedImages={uploadedImages}
              structureCount={structuresForValidation.length}
              vendorQuotes={vendorQuotes.vendorQuotes}
              vendorQuoteItems={vendorQuotes.vendorQuoteItems}
              isExtractingVendorQuote={vendorQuotes.isExtractingVendorQuote}
              jobDescription={smartSelection.jobDescription}
              quickSelections={smartSelection.quickSelections}
              smartSelectionReasoning={smartSelection.smartSelectionReasoning}
              smartSelectionWarnings={smartSelection.smartSelectionWarnings}
              isGeneratingSelection={smartSelection.isGeneratingSelection}
              allSelectableItemsLength={allSelectableItems.length}
              onCustomerInfoChange={(field, value) => {
                setCustomerInfo(prev => ({ ...prev, [field]: value }));
              }}
              onReset={resetEstimator}
              onVendorQuoteUpload={vendorQuotes.handleVendorQuoteUpload}
              onRemoveVendorQuote={vendorQuotes.removeVendorQuoteFromState}
              onJobDescriptionChange={smartSelection.setJobDescription}
              onToggleQuickSelection={(optionId) => {
                smartSelection.setQuickSelections(prev => prev.map(opt => {
                  if (opt.id === optionId) {
                    const nextSelected = !opt.selected;
                    smartSelection.setJobDescription(prevDesc => {
                      const hasKeyword = prevDesc.toLowerCase().includes(opt.keyword.toLowerCase());
                      if (!nextSelected) {
                        return removeKeywordFromDescription(prevDesc, opt.keyword);
                      }
                      if (hasKeyword) return prevDesc;
                      return prevDesc ? `${prevDesc}, ${opt.keyword}` : opt.keyword;
                    });
                    return { ...opt, selected: nextSelected };
                  }
                  return opt;
                }));
              }}
              onGenerateSmartSelection={smartSelection.generateSmartSelection}
            />


            {/* Line Item Builder */}
            <div className="bg-white rounded-2xl p-4 md:p-6 border border-gray-200">
              <h2 className="font-semibold text-gray-900 mb-4">Build Your Estimate</h2>

              {allSelectableItems.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p className="mb-2 text-sm">No price items or vendor items yet.</p>
                  <button
                    onClick={() => uiState.setShowPrices(true)}
                    className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                  >
                    Add your prices first →
                  </button>
                </div>
              ) : (
                <EstimateBuilder
                  allSelectableItems={allSelectableItems}
                  selectedItems={selectedItems}
                  itemQuantities={itemQuantities}
                  collapsedSections={uiState.collapsedSections}
                  customItemDraft={customItems.customItemDraft}
                  sectionSort={uiState.sectionSort}
                  vendorItemMap={vendorQuotes.vendorItemMap}
                  vendorQuoteMap={vendorQuotes.vendorQuoteMap}
                  missingAccessoryItems={missingAccessoryItems}
                  sectionHeaders={sectionHeaders}
                  manualOverrides={manualOverrides}
                  onUpdateItem={handleUpdateItem}
                  onResetOverride={handleResetOverride}
                  onUpdateSectionHeader={handleUpdateSectionHeader}
                  onToggleSelection={(itemId, selected) => {
                    if (selected) {
                      setSelectedItems(prev => [...prev, itemId]);
                      const isVendorItem = vendorQuotes.vendorItemMap.has(itemId);
                      if (isVendorItem) {
                        const vendorItem = vendorQuotes.vendorItemMap.get(itemId);
                        setItemQuantities(prev => ({
                          ...prev,
                          [itemId]: prev[itemId] ?? vendorItem?.quantity ?? 0,
                        }));
                      }
                    } else {
                      setSelectedItems(prev => prev.filter(id => id !== itemId));
                    }
                  }}
                  onQuantityChange={(itemId, quantity) => {
                    setItemQuantities(prev => ({ ...prev, [itemId]: quantity }));
                  }}
                  onToggleCollapse={(sectionKey) => {
                    uiState.setCollapsedSections(prev => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
                  }}
                  onStartCustomItem={customItems.startCustomItem}
                  onCancelCustomItem={customItems.cancelCustomItem}
                  onAddCustomItem={customItems.addCustomItem}
                  onUpdateCustomItemDraft={(updates) => {
                    customItems.setCustomItemDraft(prev => prev ? { ...prev, ...updates } : prev);
                  }}
                  onToggleSectionSort={toggleSectionSort}
                  onCalculateEstimate={calculateEstimate}
                  getEstimateCategoryItems={getEstimateCategoryItems}
                  calculatedAccessories={
                    measurements && measurements.eave_length ? (
                      <CalculatedAccessories
                        measurements={measurements}
                        isMetalRoof={isMetalRoof}
                        priceItems={priceItems.priceItems}
                        selectedItems={selectedItems}
                        onAddToEstimate={(materialItemId, laborItemId, materialQty, laborQty) => {
                          // Add material item
                          setSelectedItems(prev => {
                            if (!prev.includes(materialItemId)) {
                              return [...prev, materialItemId];
                            }
                            return prev;
                          });
                          setItemQuantities(prev => ({ ...prev, [materialItemId]: materialQty }));
                          
                          // Add labor item
                          setSelectedItems(prev => {
                            if (!prev.includes(laborItemId)) {
                              return [...prev, laborItemId];
                            }
                            return prev;
                          });
                          setItemQuantities(prev => ({ ...prev, [laborItemId]: laborQty }));
                        }}
                        skylightCount={skylightCount}
                        onAddSkylight={() => setSkylightCount(prev => prev + 1)}
                        onRemoveSkylight={() => setSkylightCount(prev => Math.max(0, prev - 1))}
                        onAddSkylightsToEstimate={(skylightItemId, quantity) => {
                          setSelectedItems(prev => {
                            if (!prev.includes(skylightItemId)) {
                              return [...prev, skylightItemId];
                            }
                            return prev;
                          });
                          setItemQuantities(prev => ({ ...prev, [skylightItemId]: quantity }));
                        }}
                        onMissingItemsChange={setMissingAccessoryItems}
                      />
                    ) : undefined
                  }
                />
              )}
            </div>
          </div>
        )}

        {/* Final Estimate */}
        {step === 'estimate' && estimate && (
          <EstimateView
            estimate={estimate}
            validationWarnings={validationWarnings}
            isGeneratingPDF={isGeneratingPDF}
            isSavingQuote={savedQuotes.isSavingQuote}
            isOrganizing={isOrganizing}
            expandedSections={uiState.expandedSections}
            showVendorBreakdown={vendorQuotes.showVendorBreakdown}
            vendorQuotes={vendorQuotes.vendorQuotes}
            vendorQuoteItems={vendorQuotes.vendorQuoteItems}
            vendorItemMap={vendorQuotes.vendorItemMap}
            vendorQuoteMap={vendorQuotes.vendorQuoteMap}
            vendorTaxFeesTotal={vendorQuotes.vendorTaxFeesTotal}
            onDismissWarnings={() => setValidationWarnings([])}
            onDownloadProposal={handleDownloadProposal}
            onToggleSection={toggleSection}
            onToggleVendorBreakdown={() => vendorQuotes.setShowVendorBreakdown(prev => !prev)}
            onEditEstimate={() => {
              setStep('extracted');
              setValidationWarnings([]);
            }}
            onSaveQuote={async () => {
              if (savedEstimateId && estimate) {
                try {
                  setAiStatus('Checking estimate completeness...');
                  const validation = await projectManager.validateCompleteness(estimate);
                  if (!validation.valid) {
                    console.warn('Estimate has validation issues:', validation.warnings);
                  }
                } catch (err) {
                  console.error('Completeness validation failed:', err);
                } finally {
                  setAiStatus(null);
                }
              }
              const savedId = await savedQuotes.saveCurrentQuote();
              if (savedId) {
                setSavedEstimateId(savedId);
              }
            }}
            estimateId={savedEstimateId}
            shareToken={shareToken}
            shareEnabled={shareEnabled}
            onUpdateShareSettings={async (enabled: boolean, token: string | null) => {
              if (!savedEstimateId || !user?.id) return;
              
              try {
                await updateShareSettings(savedEstimateId, enabled, token, user.id);
                setShareEnabled(enabled);
                setShareToken(token);
              } catch (error) {
                console.error('Failed to update share settings:', error);
                alert('Failed to update share settings. Please try again.');
              }
            }}
            onReset={resetEstimator}
            onToggleItemSelection={(itemId, selected) => {
              if (!selected) {
                // Remove item from selectedItems
                setSelectedItems(prev => prev.filter(id => id !== itemId));
                // Clear quantity for this item
                setItemQuantities(prev => {
                  const updated = { ...prev };
                  delete updated[itemId];
                  return updated;
                });
                // Trigger recalculation
                if (estimate && step === 'estimate') {
                  setTimeout(() => calculateEstimate(), 100);
                }
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
