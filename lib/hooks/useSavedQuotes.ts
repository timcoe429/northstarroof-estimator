import { useState, useEffect } from 'react';
import { loadQuotes, loadQuote, deleteQuote, saveQuote, saveVendorQuotes, loadVendorQuotes } from '@/lib/supabase';
import type { SavedQuote, Estimate, VendorQuote, VendorQuoteItem, Measurements, CustomerInfo, PriceItem } from '@/types';

type CustomItem = PriceItem & {
  isCustomItem: true;
};

type LoadQuoteCallbacks = {
  setVendorQuotes: React.Dispatch<React.SetStateAction<VendorQuote[]>>;
  setVendorQuoteItems: React.Dispatch<React.SetStateAction<VendorQuoteItem[]>>;
  setMeasurements: React.Dispatch<React.SetStateAction<Measurements | null>>;
  setCustomerInfo: React.Dispatch<React.SetStateAction<CustomerInfo>>;
  setJobDescription: React.Dispatch<React.SetStateAction<string>>;
  setMarginPercent: React.Dispatch<React.SetStateAction<number>>;
  setOfficeCostPercent: React.Dispatch<React.SetStateAction<number>>;
  setSundriesPercent: React.Dispatch<React.SetStateAction<number>>;
  setWastePercent: React.Dispatch<React.SetStateAction<number>>;
  setItemQuantities: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setSelectedItems: React.Dispatch<React.SetStateAction<string[]>>;
  setCustomItems: React.Dispatch<React.SetStateAction<CustomItem[]>>;
  setEstimate: React.Dispatch<React.SetStateAction<Estimate | null>>;
  setStep: React.Dispatch<React.SetStateAction<string>>;
  analyzeJobForQuickSelections: (m: Measurements, descriptionOverride?: string) => void;
  jobDescription: string;
};

export function useSavedQuotes(userId: string | undefined) {
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([]);
  const [showSavedQuotes, setShowSavedQuotes] = useState(false);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
  const [isSavingQuote, setIsSavingQuote] = useState(false);

  // Load quotes on mount
  useEffect(() => {
    fetchSavedQuotes();
  }, []);

  // Close saved quotes dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showSavedQuotes && !target.closest('.saved-quotes-dropdown')) {
        setShowSavedQuotes(false);
      }
    };

    if (showSavedQuotes) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSavedQuotes]);

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
  const saveCurrentQuote = async (
    estimate: Estimate,
    user: { id: string } | null,
    vendorQuotes: VendorQuote[],
    vendorQuoteItems: VendorQuoteItem[]
  ) => {
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
      console.log('Saving quote with user ID:', user?.id);
      console.log('Full user object:', user);
      console.log('User ID type:', typeof user?.id);
      
      // Validate user ID format
      if (!user?.id) {
        throw new Error('User is not authenticated. Please log in to save quotes.');
      }
      
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isValidUUID = uuidRegex.test(user.id);
      console.log('User ID format check:', isValidUUID ? 'Valid UUID' : 'Invalid format');
      
      if (!isValidUUID) {
        console.error('Invalid user ID format:', user.id);
        throw new Error('Invalid user ID format. Please log out and log back in.');
      }
      
      const savedQuote = await saveQuote(estimateWithCustomerInfo, quoteName.trim(), user.id);

      if (vendorQuotes.length > 0) {
        await saveVendorQuotes(savedQuote.id, vendorQuotes, vendorQuoteItems);
      }
      alert('Quote saved successfully!');
      await fetchSavedQuotes();
    } catch (error) {
      console.error('Failed to save quote:', error);
      alert(`Failed to save quote: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSavingQuote(false);
    }
  };

  // Load a saved quote
  const loadSavedQuote = async (quoteId: string, callbacks: LoadQuoteCallbacks) => {
    const {
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
    } = callbacks;

    try {
      const savedQuote = await loadQuote(quoteId, userId);

      setVendorQuotes([]);
      setVendorQuoteItems([]);
      
      // Extract customer info from measurements if stored there
      const measurements = savedQuote.measurements as any;
      const customerInfo = measurements.customerInfo || {
        name: measurements.fileName?.replace('Pasted image', '') || '',
        address: '',
        phone: '',
      };
      
      // Restore measurements (without customerInfo)
      const { customerInfo: _, ...cleanMeasurements } = measurements;
      setMeasurements(cleanMeasurements);
      
      // Restore customer info
      setCustomerInfo(customerInfo);

      const restoredJobDescription = (savedQuote as any).job_description || (savedQuote as any).jobDescription || '';
      if (restoredJobDescription) {
        setJobDescription(restoredJobDescription);
      }
      analyzeJobForQuickSelections(cleanMeasurements, restoredJobDescription || jobDescription);

      // Load vendor quotes tied to this estimate
      try {
        const { quotes, items } = await loadVendorQuotes(savedQuote.id);
        setVendorQuotes(quotes);
        setVendorQuoteItems(items);
      } catch (error) {
        console.error('Failed to load vendor quotes:', error);
      }
      
      // Restore financial settings
      setMarginPercent(savedQuote.margin_percent);
      setOfficeCostPercent(savedQuote.office_percent);
      
      // Restore sundries percent (calculate from saved estimate if available, otherwise use default)
      const restoredEstimateData = savedQuote as any;
      if (restoredEstimateData.sundries_percent !== undefined) {
        setSundriesPercent(restoredEstimateData.sundries_percent);
      }
      
      // Calculate waste percent from line items (materials waste)
      const materialsItems = savedQuote.line_items.filter(item => item.category === 'materials' || item.category === 'schafer');
      let wastePercent = 10; // default
      if (materialsItems.length > 0) {
        const totalBaseQty = materialsItems.reduce((sum, item) => sum + (item.baseQuantity || item.quantity), 0);
        const totalQty = materialsItems.reduce((sum, item) => sum + item.quantity, 0);
        if (totalBaseQty > 0) {
          wastePercent = ((totalQty - totalBaseQty) / totalBaseQty) * 100;
        }
      }
      setWastePercent(wastePercent);
      
      // Restore line items and quantities
      const restoredLineItems = savedQuote.line_items;
      const restoredQuantities: Record<string, number> = {};
      const restoredSelectedItems: string[] = [];
      const restoredCustomItems: CustomItem[] = [];
      
      restoredLineItems.forEach(item => {
        restoredQuantities[item.id] = item.quantity;
        restoredSelectedItems.push(item.id);
        if ((item as any).isCustomItem) {
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
      
      setItemQuantities(restoredQuantities);
      setSelectedItems(restoredSelectedItems);
      setCustomItems(restoredCustomItems);
      
      // Reconstruct estimate object
      const byCategory = {
        materials: restoredLineItems.filter(item => item.category === 'materials'),
        labor: restoredLineItems.filter(item => item.category === 'labor'),
        equipment: restoredLineItems.filter(item => item.category === 'equipment'),
        accessories: restoredLineItems.filter(item => item.category === 'accessories'),
        schafer: restoredLineItems.filter(item => item.category === 'schafer'),
      };
      
      const totals = {
        materials: byCategory.materials.reduce((sum, item) => sum + item.total, 0),
        labor: byCategory.labor.reduce((sum, item) => sum + item.total, 0),
        equipment: byCategory.equipment.reduce((sum, item) => sum + item.total, 0),
        accessories: byCategory.accessories.reduce((sum, item) => sum + item.total, 0),
        schafer: byCategory.schafer.reduce((sum, item) => sum + item.total, 0),
      };
      
      const restoredEstimate: Estimate = {
        lineItems: restoredLineItems,
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
      
      setEstimate(restoredEstimate);
      setStep('estimate');
      setShowSavedQuotes(false);
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
    showSavedQuotes,
    setShowSavedQuotes,
    isLoadingQuotes,
    isSavingQuote,
    fetchSavedQuotes,
    saveCurrentQuote,
    loadSavedQuote,
    deleteSavedQuote,
  };
}
