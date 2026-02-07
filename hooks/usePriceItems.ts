import { useState, useEffect } from 'react';
import type { PriceItem } from '@/types';
import { loadPriceItems, savePriceItem, savePriceItemsBulk, deletePriceItemFromDB } from '@/lib/supabase';

interface UsePriceItemsProps {
  userId: string | undefined;
  vendorQuoteItems: any[]; // Will be properly typed when useVendorQuotes is created
  vendorQuoteMap: Map<string, any>;
  onUpdateVendorItem?: (id: string, updates: Partial<PriceItem>) => void;
  onDeleteVendorItem?: (id: string) => void;
  onSetEditingItem?: (itemId: string | null) => void;
}

export const usePriceItems = ({
  userId,
  vendorQuoteItems,
  vendorQuoteMap,
  onUpdateVendorItem,
  onDeleteVendorItem,
  onSetEditingItem,
}: UsePriceItemsProps) => {
  const [priceItems, setPriceItems] = useState<PriceItem[]>([]);
  const [showPrices, setShowPrices] = useState(false);
  const [priceSheetProcessing, setPriceSheetProcessing] = useState(false);
  const [extractedItems, setExtractedItems] = useState<PriceItem[] | null>(null);
  const [activeCategory, setActiveCategory] = useState('materials');
  const [isLoadingPriceItems, setIsLoadingPriceItems] = useState(false);

  // Load price items from Supabase when user is available
  useEffect(() => {
    if (!userId) return;

    const loadItems = async () => {
      setIsLoadingPriceItems(true);
      try {
        const items = await loadPriceItems(userId);
        setPriceItems(items);
      } catch (error) {
        console.error('Failed to load price items:', error);
        alert('Failed to load price items. Please refresh the page.');
      } finally {
        setIsLoadingPriceItems(false);
      }
    };

    loadItems();
  }, [userId]);

  // Apply extracted prices to price list
  const applyExtractedPrices = async () => {
    if (!extractedItems) return;
    
    if (!userId) {
      alert('You must be logged in to add price items');
      return;
    }

    const newItems = extractedItems.map((item, idx) => ({
      id: `item_${Date.now()}_${idx}`,
      name: item.name,
      unit: item.unit || 'each',
      price: item.price || 0,
      coverage: item.coverage,
      coverageUnit: item.coverageUnit,
      category: item.category || 'materials',
    }));

    // Update local state immediately
    setPriceItems(prev => [...prev, ...newItems]);
    setExtractedItems(null);

    // Bulk save to Supabase
    try {
      await savePriceItemsBulk(newItems, userId);
    } catch (error) {
      console.error('Failed to save extracted price items:', error);
      alert('Failed to save extracted price items. Please try again.');
      // Revert local state on error
      setPriceItems(prev => prev.filter(item => !newItems.some(newItem => newItem.id === item.id)));
      setExtractedItems(extractedItems);
    }
  };

  // Price item management
  const addPriceItem = async (category?: string) => {
    if (!userId) {
      alert('You must be logged in to add price items');
      return;
    }

    // Use passed category or fall back to internal activeCategory state
    const itemCategory = (category || activeCategory) as PriceItem['category'];

    const newItem: PriceItem = {
      id: `item_${Date.now()}`,
      name: 'New Item',
      unit: 'each',
      price: 0,
      coverage: null,
      coverageUnit: null,
      category: itemCategory,
    };
    
    // Update local state immediately
    setPriceItems(prev => [...prev, newItem]);
    
    // Set editing mode via UI state callback
    if (onSetEditingItem) {
      onSetEditingItem(newItem.id);
    }

    // DO NOT save to database yet - wait for user to edit and click save
    // The item will be saved when updatePriceItem is called (via save button)
  };

  const updatePriceItem = async (id: string, updates: Partial<PriceItem>) => {
    if (!userId) {
      alert('You must be logged in to update price items');
      return;
    }

    const vendorItem = vendorQuoteItems.find(item => item.id === id);
    if (vendorItem) {
      // Prevent editing Schafer vendor quote items - they are the source of truth
      const vendorQuote = vendorQuoteMap.get(vendorItem.vendor_quote_id);
      if (vendorQuote?.vendor === 'schafer') {
        console.warn('Cannot edit Schafer vendor quote items - quote is source of truth');
        return;
      }
      
      // Call parent handler for vendor items
      if (onUpdateVendorItem) {
        onUpdateVendorItem(id, updates);
      }
      return;
    }

    // Find the item to update
    const currentItem = priceItems.find(item => item.id === id);
    if (!currentItem) return;

    // Create updated item
    const updatedItem = { ...currentItem, ...updates };

    // Update local state immediately
    setPriceItems(prev => prev.map(item => 
      item.id === id ? updatedItem : item
    ));

    // Save to Supabase
    try {
      await savePriceItem(updatedItem, userId);
    } catch (error) {
      console.error('Failed to update price item:', error);
      alert('Failed to update price item. Please try again.');
      // Revert local state on error
      setPriceItems(prev => prev.map(item => 
        item.id === id ? currentItem : item
      ));
    }
  };

  const deletePriceItem = async (id: string) => {
    if (!userId) {
      alert('You must be logged in to delete price items');
      return;
    }

    // Check if it's a vendor item
    const vendorItem = vendorQuoteItems.find(item => item.id === id);
    if (vendorItem) {
      if (onDeleteVendorItem) {
        onDeleteVendorItem(id);
      }
      return;
    }

    // Store item for potential rollback
    const itemToDelete = priceItems.find(item => item.id === id);
    if (!itemToDelete) return;

    // Remove from local state immediately (optimistic update)
    setPriceItems(prev => prev.filter(item => item.id !== id));
    
    // Clear editing state if this item was being edited
    if (onSetEditingItem) {
      onSetEditingItem(null);
    }

    // Try to delete from Supabase (may fail if item was never saved)
    try {
      await deletePriceItemFromDB(id, userId);
    } catch (error) {
      // If item doesn't exist in database (e.g., new item that wasn't saved yet),
      // that's fine - we already removed it from local state
      // Only show error if it's a different kind of error
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('not found') && !errorMessage.includes('does not exist')) {
        console.error('Failed to delete price item:', error);
        alert('Failed to delete price item. Please try again.');
        // Revert local state on unexpected error
        setPriceItems(prev => [...prev, itemToDelete]);
      }
    }
  };

  return {
    priceItems,
    setPriceItems,
    showPrices,
    setShowPrices,
    priceSheetProcessing,
    setPriceSheetProcessing,
    extractedItems,
    setExtractedItems,
    activeCategory,
    setActiveCategory,
    isLoadingPriceItems,
    applyExtractedPrices,
    addPriceItem,
    updatePriceItem,
    deletePriceItem,
  };
};
