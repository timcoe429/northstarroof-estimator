import { useState, useEffect } from 'react';
import type { Estimate, VendorQuote, VendorQuoteItem } from '@/types';
import type { CustomItem } from '@/types/estimator';
import { loadQuotes, saveQuote, loadQuote, deleteQuote, saveVendorQuotes, loadVendorQuotes } from '@/lib/supabase';

interface UseSavedQuotesProps {
  userId: string | undefined;
  estimate: Estimate | null;
  vendorQuotes: VendorQuote[];
  vendorQuoteItems: VendorQuoteItem[];
  onSetVendorQuotes: (quotes: VendorQuote[] | ((prev: VendorQuote[]) => VendorQuote[])) => void;
  onSetVendorQuoteItems: (items: VendorQuoteItem[] | ((prev: VendorQuoteItem[]) => VendorQuoteItem[])) => void;
  onSetMeasurements: (measurements: any | null) => void;
  onSetCustomerInfo: (info: any) => void;
  onSetJobDescription: (description: string) => void;
  onSetMarginPercent: (percent: number) => void;
  onSetOfficeCostPercent: (percent: number) => void;
  onSetSundriesPercent: (percent: number) => void;
  onSetWastePercent: (percent: number) => void;
  onSetItemQuantities: (quantities: Record<string, number>) => void;
  onSetSelectedItems: (items: string[]) => void;
  onSetCustomItems: (items: CustomItem[]) => void;
  onSetEstimate: (estimate: Estimate | null) => void;
  onSetStep: (step: string) => void;
  onSetShowVendorBreakdown: (show: boolean) => void;
  onAnalyzeJobForQuickSelections: (m: any, descriptionOverride?: string) => void;
  onCalculateEstimate: () => void;
  onSetIsLoadingQuote: (loading: boolean) => void;
  jobDescription: string;
}

export const useSavedQuotes = ({
  userId,
  estimate,
  vendorQuotes,
  vendorQuoteItems,
  onSetVendorQuotes,
  onSetVendorQuoteItems,
  onSetMeasurements,
  onSetCustomerInfo,
  onSetJobDescription,
  onSetMarginPercent,
  onSetOfficeCostPercent,
  onSetSundriesPercent,
  onSetWastePercent,
  onSetItemQuantities,
  onSetSelectedItems,
  onSetCustomItems,
  onSetEstimate,
  onSetStep,
  onSetShowVendorBreakdown,
  onAnalyzeJobForQuickSelections,
  onCalculateEstimate,
  onSetIsLoadingQuote,
  jobDescription,
}: UseSavedQuotesProps) => {
  const [savedQuotes, setSavedQuotes] = useState<any[]>([]);
  const [showSavedQuotes, setShowSavedQuotes] = useState(false);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
  const [isSavingQuote, setIsSavingQuote] = useState(false);

  const fetchSavedQuotes = async () => {
    setIsLoadingQuotes(true);
    try {
      const quotes = await loadQuotes(userId);
      setSavedQuotes(quotes);
    } catch (error) {
      console.error('Failed to load quotes:', error);
      // Don't show alert on mount, only on user action
    } finally {
      setIsLoadingQuotes(false);
    }
  };

  // Save current quote
  const saveCurrentQuote = async (): Promise<string | undefined> => {
    if (!estimate) return;

    const defaultName = `Quote #${savedQuotes.length + 1} - ${estimate.customerInfo.name || 'Customer'}`;
    const quoteName = prompt('Enter quote name:', defaultName);
    
    if (!quoteName || quoteName.trim() === '') {
      return;
    }

    setIsSavingQuote(true);
    try {
      // Include customer info in measurements for storage
      const measurementsWithCustomer = {
        ...estimate.measurements,
        customerInfo: estimate.customerInfo,
      };
      
      const estimateWithCustomerInfo = {
        ...estimate,
        measurements: measurementsWithCustomer,
      };
      
      // Debug logging
      console.log('Saving quote with user ID:', userId);
      console.log('User ID type:', typeof userId);
      
      // Validate user ID format
      if (!userId) {
        throw new Error('User is not authenticated. Please log in to save quotes.');
      }
      
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isValidUUID = uuidRegex.test(userId);
      console.log('User ID format check:', isValidUUID ? 'Valid UUID' : 'Invalid format');
      
      if (!isValidUUID) {
        console.error('Invalid user ID format:', userId);
        throw new Error('Invalid user ID format. Please log out and log back in.');
      }
      
      const savedQuote = await saveQuote(estimateWithCustomerInfo, quoteName.trim(), userId, jobDescription);

      if (vendorQuotes.length > 0) {
        await saveVendorQuotes(savedQuote.id, vendorQuotes, vendorQuoteItems);
      }
      
      // Return saved quote ID for share functionality
      alert('Quote saved successfully!');
      await fetchSavedQuotes();
      return savedQuote.id;
    } catch (error) {
      console.error('Failed to save quote:', error);
      alert(`Failed to save quote: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return undefined;
    } finally {
      setIsSavingQuote(false);
    }
  };

  // Load a saved quote
  const loadSavedQuote = async (quoteId: string): Promise<{ estimateId: string; shareToken: string | null; shareEnabled: boolean } | undefined> => {
    try {
      // Set loading flag to prevent quantity recalculation from overwriting restored data
      onSetIsLoadingQuote(true);
      
      const savedQuote = await loadQuote(quoteId, userId);

      onSetVendorQuotes([]);
      onSetVendorQuoteItems([]);
      
      // Extract customer info from measurements if stored there
      const measurements = savedQuote.measurements as any;
      const customerInfo = measurements.customerInfo || {
        name: measurements.fileName?.replace('Pasted image', '') || '',
        address: '',
        phone: '',
      };
      
      // Restore measurements (without customerInfo)
      const { customerInfo: _, ...cleanMeasurements } = measurements;
      onSetMeasurements(cleanMeasurements);
      
      // Restore customer info
      onSetCustomerInfo(customerInfo);

      // Restore job description from database (now saved explicitly)
      const restoredJobDescription = (savedQuote as any).job_description || (savedQuote as any).jobDescription || '';
      if (restoredJobDescription) {
        onSetJobDescription(restoredJobDescription);
      }
      onAnalyzeJobForQuickSelections(cleanMeasurements, restoredJobDescription || jobDescription);

      // Load vendor quotes tied to this estimate
      let loadedVendorItems: VendorQuoteItem[] = [];
      try {
        const { quotes, items } = await loadVendorQuotes(savedQuote.id);
        onSetVendorQuotes(quotes);
        onSetVendorQuoteItems(items);
        loadedVendorItems = items;
        onSetShowVendorBreakdown(false);
      } catch (error) {
        console.error('Failed to load vendor quotes:', error);
      }
      
      // Restore financial settings
      onSetMarginPercent(savedQuote.margin_percent);
      onSetOfficeCostPercent(savedQuote.office_percent);
      
      // Restore sundries percent from database (now saved explicitly)
      const restoredEstimateData = savedQuote as any;
      if (restoredEstimateData.sundries_percent !== undefined && restoredEstimateData.sundries_percent !== null) {
        onSetSundriesPercent(restoredEstimateData.sundries_percent);
      } else {
        // Fallback to default if not saved
        onSetSundriesPercent(10);
      }
      
      // Restore waste percent from database (now saved explicitly)
      let wastePercent = 10; // default
      if (restoredEstimateData.waste_percent !== undefined && restoredEstimateData.waste_percent !== null) {
        wastePercent = restoredEstimateData.waste_percent;
      } else {
        // Fallback: Calculate waste percent from line items (materials waste)
        const materialsItems = savedQuote.line_items.filter((item: any) => item.category === 'materials' || item.category === 'schafer');
        if (materialsItems.length > 0) {
          const totalBaseQty = materialsItems.reduce((sum: number, item: any) => sum + (item.baseQuantity ?? item.quantity ?? 0), 0);
          const totalQty = materialsItems.reduce((sum: number, item: any) => sum + (item.quantity ?? 0), 0);
          if (totalBaseQty > 0) {
            wastePercent = ((totalQty - totalBaseQty) / totalBaseQty) * 100;
          }
        }
      }
      onSetWastePercent(wastePercent);
      
      // Restore line items and quantities
      const allRestoredLineItems = savedQuote.line_items;
      // Separate optional items from regular items
      const restoredLineItems = allRestoredLineItems.filter((item: any) => !item.isOptional);
      const restoredOptionalItems = allRestoredLineItems.filter((item: any) => item.isOptional === true);
      const restoredQuantities: Record<string, number> = {};
      const restoredSelectedItems: string[] = [];
      const restoredCustomItems: CustomItem[] = [];
      
      allRestoredLineItems.forEach((item: any) => {
        // Use nullish coalescing to handle baseQuantity: 0 correctly
        // Vendor items legitimately have baseQuantity: 0 (no waste applied)
        restoredQuantities[item.id] = item.baseQuantity ?? item.quantity ?? 0;
        restoredSelectedItems.push(item.id);
        if (item.isCustomItem) {
          restoredCustomItems.push({
            id: item.id,
            name: item.name,
            unit: item.unit,
            price: item.price,
            coverage: null,
            coverageUnit: null,
            category: item.category,
            proposalDescription: item.proposalDescription ?? null,
            isCustomItem: true,
          });
        }
      });
      
      // Merge vendor item quantities from vendor_quote_items table
      // This ensures vendor items have correct quantities even if they weren't in line_items
      if (loadedVendorItems && loadedVendorItems.length > 0) {
        loadedVendorItems.forEach(vendorItem => {
          restoredQuantities[vendorItem.id] = vendorItem.quantity ?? 0;
          
          if (!restoredSelectedItems.includes(vendorItem.id)) {
            restoredSelectedItems.push(vendorItem.id);
          }
        });
      }
      
      onSetItemQuantities(restoredQuantities);
      onSetSelectedItems(restoredSelectedItems);
      onSetCustomItems(restoredCustomItems);
      
      // Reconstruct estimate object
      const byCategory = {
        materials: restoredLineItems.filter((item: any) => item.category === 'materials'),
        labor: restoredLineItems.filter((item: any) => item.category === 'labor'),
        equipment: restoredLineItems.filter((item: any) => item.category === 'equipment'),
        accessories: restoredLineItems.filter((item: any) => item.category === 'accessories'),
        schafer: restoredLineItems.filter((item: any) => item.category === 'schafer'),
      };
      
      const totals = {
        materials: byCategory.materials.reduce((sum: number, item: any) => sum + item.total, 0),
        labor: byCategory.labor.reduce((sum: number, item: any) => sum + item.total, 0),
        equipment: byCategory.equipment.reduce((sum: number, item: any) => sum + item.total, 0),
        accessories: byCategory.accessories.reduce((sum: number, item: any) => sum + item.total, 0),
        schafer: byCategory.schafer.reduce((sum: number, item: any) => sum + item.total, 0),
      };
      
      const restoredEstimate: Estimate = {
        lineItems: restoredLineItems,
        optionalItems: restoredOptionalItems,
        byCategory,
        totals,
        baseCost: savedQuote.base_cost,
        officeCostPercent: savedQuote.office_percent,
        officeAllocation: savedQuote.office_amount,
        totalCost: savedQuote.total_cost,
        marginPercent: savedQuote.margin_percent,
        wastePercent: wastePercent,
        sundriesPercent: restoredEstimateData.sundries_percent !== undefined ? restoredEstimateData.sundries_percent : 10,
        sundriesAmount: restoredEstimateData.sundries_amount !== undefined ? restoredEstimateData.sundries_amount : (totals.materials * 0.1),
        sellPrice: savedQuote.sell_price,
        grossProfit: savedQuote.gross_profit,
        profitMargin: savedQuote.sell_price > 0 ? (savedQuote.gross_profit / savedQuote.sell_price) * 100 : 0,
        measurements: cleanMeasurements,
        customerInfo: customerInfo,
        generatedAt: new Date(savedQuote.created_at).toLocaleString(),
      };
      
      onSetEstimate(restoredEstimate);
      onSetStep('estimate');
      setShowSavedQuotes(false);
      
      // Return saved quote ID and share settings for share functionality
      const shareData = {
        estimateId: savedQuote.id,
        shareToken: (savedQuote as any).share_token || null,
        shareEnabled: (savedQuote as any).share_enabled || false,
      };
      
      // Clear loading flag now that all state is restored
      onSetIsLoadingQuote(false);
      
      return shareData;
      
      // Trigger recalculation after all state is set to ensure waste % is applied correctly
      // Increased timeout to ensure all state updates have propagated
      setTimeout(() => {
        onCalculateEstimate();
      }, 500);
    } catch (error) {
      console.error('Failed to load quote:', error);
      alert(`Failed to load quote: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Delete a saved quote
  const deleteSavedQuote = async (quoteId: string, quoteName: string) => {
    if (!confirm(`Are you sure you want to delete "${quoteName}"?`)) {
      return;
    }

    try {
      await deleteQuote(quoteId, userId);
      await fetchSavedQuotes();
    } catch (error) {
      console.error('Failed to delete quote:', error);
      alert(`Failed to delete quote: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return {
    savedQuotes,
    setSavedQuotes,
    showSavedQuotes,
    setShowSavedQuotes,
    isLoadingQuotes,
    isSavingQuote,
    fetchSavedQuotes,
    saveCurrentQuote,
    loadSavedQuote,
    deleteSavedQuote,
  };
};
