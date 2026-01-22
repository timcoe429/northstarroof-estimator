import { useState, useEffect } from 'react';
import { loadPriceItems, savePriceItem, savePriceItemsBulk, deletePriceItemFromDB } from '@/lib/supabase';
import type { PriceItem } from '@/types';

type DeletePriceItemCallbacks = {
  vendorItemMap: Map<string, any>;
  setVendorQuoteItems: React.Dispatch<React.SetStateAction<any[]>>;
  setSelectedItems: React.Dispatch<React.SetStateAction<string[]>>;
  setItemQuantities: React.Dispatch<React.SetStateAction<Record<string, number>>>;
};

type BuildSchaferDefaultsFn = () => PriceItem[];

export function usePriceList(
  user: { id: string } | null,
  buildSchaferDefaults: BuildSchaferDefaultsFn,
  deleteCallbacks?: DeletePriceItemCallbacks
) {
  const [priceItems, setPriceItems] = useState<PriceItem[]>([]);
  const [showPrices, setShowPrices] = useState(false);
  const [priceSheetProcessing, setPriceSheetProcessing] = useState(false);
  const [extractedItems, setExtractedItems] = useState<PriceItem[] | null>(null);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('materials');
  const [isLoadingPriceItems, setIsLoadingPriceItems] = useState(false);
  const [isGeneratingDescriptions, setIsGeneratingDescriptions] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number } | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load price items from Supabase when user is available
  useEffect(() => {
    if (!user?.id) {
      setIsLoaded(false); // Reset when user logs out
      return;
    }

    if (isLoaded) return; // Prevent re-running if already loaded

    const loadItems = async () => {
      setIsLoadingPriceItems(true);
      try {
        const items = await loadPriceItems(user.id);
        const hasSchaferItems = items.some(item => item.category === 'schafer');
        if (!hasSchaferItems) {
          const defaults = buildSchaferDefaults();
          try {
            await savePriceItemsBulk(defaults, user.id);
            setPriceItems([...items, ...defaults]);
          } catch (seedError) {
            console.error('Failed to seed Schafer items:', seedError);
            setPriceItems(items);
          }
        } else {
          setPriceItems(items);
        }
        setIsLoaded(true); // Mark as loaded after success
      } catch (error) {
        console.error('Failed to load price items:', error);
        alert('Failed to load price items. Please refresh the page.');
      } finally {
        setIsLoadingPriceItems(false);
      }
    };

    loadItems();
  }, [user?.id]);

  const applyExtractedPrices = async () => {
    if (!extractedItems) return;
    
    if (!user?.id) {
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
      proposalDescription: item.proposalDescription || null,
    }));

    // Update local state immediately
    setPriceItems(prev => [...prev, ...newItems]);
    setExtractedItems(null);

    // Bulk save to Supabase
    try {
      await savePriceItemsBulk(newItems, user.id);
    } catch (error) {
      console.error('Failed to save extracted price items:', error);
      alert('Failed to save extracted price items. Please try again.');
      // Revert local state on error
      setPriceItems(prev => prev.filter(item => !newItems.some(newItem => newItem.id === item.id)));
      setExtractedItems(extractedItems);
    }
  };

  const addPriceItem = async () => {
    if (!user?.id) {
      alert('You must be logged in to add price items');
      return;
    }

    const newItem: PriceItem = {
      id: `item_${Date.now()}`,
      name: 'New Item',
      unit: 'each',
      price: 0,
      coverage: null,
      coverageUnit: null,
      category: activeCategory as PriceItem['category'],
      proposalDescription: null,
    };
    
    // Update local state immediately
    setPriceItems(prev => [...prev, newItem]);
    setEditingItem(newItem.id);

    // Save to Supabase
    try {
      await savePriceItem(newItem, user.id);
    } catch (error) {
      console.error('Failed to save price item:', error);
      alert('Failed to save price item. Please try again.');
      // Revert local state on error
      setPriceItems(prev => prev.filter(item => item.id !== newItem.id));
    }
  };

  const updatePriceItem = async (id: string, updates: Partial<PriceItem>) => {
    if (!user?.id) {
      alert('You must be logged in to update price items');
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
      await savePriceItem(updatedItem, user.id);
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
    if (!user?.id) {
      alert('You must be logged in to delete price items');
      return;
    }

    if (deleteCallbacks?.vendorItemMap.has(id)) {
      deleteCallbacks.setVendorQuoteItems(prev => prev.filter((item: any) => item.id !== id));
      deleteCallbacks.setSelectedItems(prev => prev.filter(itemId => itemId !== id));
      deleteCallbacks.setItemQuantities(prev => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
      return;
    }

    // Store item for potential rollback
    const itemToDelete = priceItems.find(item => item.id === id);
    if (!itemToDelete) return;

    try {
      // Delete from Supabase first
      await deletePriceItemFromDB(id, user.id);
      
      // Only update local state if delete succeeds
      setPriceItems(prev => prev.filter(item => item.id !== id));
      if (deleteCallbacks) {
        deleteCallbacks.setSelectedItems(prev => prev.filter(itemId => itemId !== id));
      }
    } catch (error) {
      console.error('Failed to delete price item:', error);
      alert('Failed to delete price item. Please try again.');
    }
  };

  const generateAllDescriptions = async () => {
    const itemsToGenerate = priceItems.filter(item => !item.proposalDescription || !item.proposalDescription.trim());
    
    if (itemsToGenerate.length === 0) {
      return;
    }

    setIsGeneratingDescriptions(true);
    setGenerationProgress({ current: 0, total: itemsToGenerate.length });

    for (let i = 0; i < itemsToGenerate.length; i++) {
      const item = itemsToGenerate[i];
      
      try {
        const response = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: `You are a professional roofing contractor writing proposal descriptions for a client-facing estimate.

Write a SHORT, professional description for this roofing item in this EXACT format:

Format: Product Name - 6-13 word description

The description must:
- Start with the product name (bold/emphasized conceptually), followed by a dash
- Be exactly 6-13 words after the dash
- Be concise and informative, not salesy
- Focus on key features or purpose

Item name: ${item.name}
Category: ${item.category}
Unit: ${item.unit}

Examples of CORRECT format:
- "Copper Valley - premium copper flashing for lifetime leak protection in roof valleys"
- "Titanium PSU 30 - high-temperature synthetic underlayment with superior tear strength"
- "Brava Field Tile - durable lightweight synthetic slate with authentic appearance"
- "Complete Roof Labor - includes tear-off deck prep underlayment and finish roofing"
- "Rolloff Dumpster - 30-yard container for roofing debris removal and disposal"

Examples of INCORRECT format (do NOT write like this):
- "Premium copper valley flashing providing superior water channeling and leak protection with natural antimicrobial properties and lifetime durability." (too long, no product name format)
- "Install Brava Field Tile per manufacturer specifications." (starts with Install, not in required format)
- "Roofing labor." (too short, not descriptive enough, missing format)

For LABOR items: Use format "Labor Name - brief description of work included"
For MATERIALS: Use format "Product Name - key features or specifications"
For EQUIPMENT/FEES: Use format "Item Name - what is being provided"

CRITICAL: Return ONLY the description in the format "Product Name - 6-13 word description". Do not include any other text.`,
            max_tokens: 100,
          }),
        });

        const data = await response.json();
        const text = data.content?.[0]?.text || '';
        const description = text.trim();
        
        if (description) {
          updatePriceItem(item.id, { proposalDescription: description });
        }
      } catch (error) {
        console.error(`Error generating description for ${item.name}:`, error);
        // Continue to next item even if this one fails
      }

      // Update progress
      setGenerationProgress({ current: i + 1, total: itemsToGenerate.length });
    }

    // Reset state when complete
    setIsGeneratingDescriptions(false);
    setGenerationProgress(null);
  };

  const getPriceListItems = (category: string) =>
    priceItems
      .filter(item => item.category === category)
      .sort((a, b) => a.name.localeCompare(b.name));

  return {
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
    updatePriceItem,
    deletePriceItem,
    applyExtractedPrices,
    generateAllDescriptions,
    getPriceListItems,
  };
}
