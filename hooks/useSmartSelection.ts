import { useState, useMemo } from 'react';
import type { Measurements, PriceItem } from '@/types';
import type { QuickSelectOption, SelectableItem } from '@/types/estimator';
import { calculateItemQuantitiesFromMeasurements } from '@/lib/calculateItemQuantities';

interface UseSmartSelectionProps {
  measurements: Measurements | null;
  roofSystem: string;
  vendorQuotes: any[];
  allSelectableItems: SelectableItem[];
  vendorQuoteItems: any[];
  vendorItemMap: Map<string, any>;
  itemQuantities: Record<string, number>;
  isTearOff: boolean;
  priceItems: PriceItem[];
  onSetItemQuantities: (quantities: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void;
  onSetSelectedItems: (items: string[] | ((prev: string[]) => string[])) => void;
  onSetJobDescription: (description: string | ((prev: string) => string)) => void;
}

export const useSmartSelection = ({
  measurements,
  roofSystem,
  vendorQuotes,
  allSelectableItems,
  vendorQuoteItems,
  vendorItemMap,
  itemQuantities,
  isTearOff,
  priceItems,
  onSetItemQuantities,
  onSetSelectedItems,
  onSetJobDescription,
}: UseSmartSelectionProps) => {
  const [jobDescription, setJobDescription] = useState('');
  const [smartSelectionReasoning, setSmartSelectionReasoning] = useState('');
  const [smartSelectionWarnings, setSmartSelectionWarnings] = useState<string[]>([]);
  const [isGeneratingSelection, setIsGeneratingSelection] = useState(false);
  const [quickSelections, setQuickSelections] = useState<QuickSelectOption[]>([]);

  const isTearOffMemo = useMemo(() => {
    const desc = jobDescription.toLowerCase();
    const quickTearOff = quickSelections.find(option => option.id === 'tear-off')?.selected ?? false;
    return desc.includes('tear-off') || quickTearOff;
  }, [jobDescription, quickSelections]);

  const analyzeJobForQuickSelections = (m: Measurements, descriptionOverride?: string) => {
    const totalSquares = m.total_squares || 0;
    const pitch = m.predominant_pitch || '';
    const pitchNum = parseInt(pitch.split(/[/:]/)[0], 10) || 0;
    const complexity = (m.complexity || '').toLowerCase();
    const descriptionText = (descriptionOverride ?? jobDescription).toLowerCase();
    const hasSchaferQuote = vendorQuotes.some(quote => quote.vendor === 'schafer');

    const options: QuickSelectOption[] = [
      {
        id: 'metal',
        label: 'Metal Roof',
        keyword: 'metal roof',
        suggested: hasSchaferQuote,
        selected: hasSchaferQuote,
        icon: '🔩',
      },
      {
        id: 'tear-off',
        label: 'Tear-Off',
        keyword: 'tear-off',
        suggested: false,
        selected: false,
        icon: '🗑️',
      },
      {
        id: 'overnights',
        label: 'Overnights',
        keyword: 'overnights',
        suggested: totalSquares > 25,
        selected: false,
        icon: '🌙',
      },
      {
        id: 'multi-day',
        label: 'Multi-Day',
        keyword: 'multi-day job',
        suggested: totalSquares > 15,
        selected: false,
        icon: '📅',
      },
      {
        id: 'steep',
        label: 'Steep Pitch',
        keyword: 'steep pitch high-slope products',
        suggested: pitchNum >= 8,
        selected: pitchNum >= 8,
        icon: '⛰️',
      },
      {
        id: 'complex',
        label: 'Complex Roof',
        keyword: 'complex roof',
        suggested: complexity === 'complex',
        selected: false,
        icon: '🔷',
      },
    ];

    const normalizedOptions = options.map(option => {
      const hasKeyword = descriptionText.includes(option.keyword.toLowerCase());
      return { ...option, selected: option.selected || hasKeyword };
    });

    setQuickSelections(normalizedOptions);

    if (pitchNum >= 8 && descriptionOverride === undefined) {
      onSetJobDescription(prev => {
        if (prev.toLowerCase().includes('steep')) return prev;
        return prev ? `${prev}, steep pitch` : 'steep pitch';
      });
    }

    if (hasSchaferQuote && descriptionOverride === undefined) {
      onSetJobDescription(prev => {
        if (prev.toLowerCase().includes('metal roof')) return prev;
        return prev ? `${prev}, metal roof` : 'metal roof';
      });
    }
  };

  // Generate smart selection based on job description and roof system
  const generateSmartSelection = async () => {
    if (!roofSystem) {
      alert('Select a roof system first.');
      return;
    }
    if (!measurements || allSelectableItems.length === 0) {
      alert('Ensure measurements exist and you have price items or vendor items.');
      return;
    }

    setIsGeneratingSelection(true);
    setSmartSelectionReasoning('');
    setSmartSelectionWarnings([]);

    try {
      const selectionItems = allSelectableItems.map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        unit: item.unit,
        price: item.price,
        source: item.isVendorItem ? 'vendor' : 'price-list',
      }));

      const response = await fetch('/api/smart-selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roofSystem,
          jobDescription: jobDescription.trim() || '',
          measurements,
          selectionItems,
          vendorQuoteItems,
          itemQuantities,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate smart selection');
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || '';

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        
        const vendorItemIds = vendorQuoteItems.map(item => item.id);
        const selectedFromAI = Array.isArray(result.selectedItemIds) ? result.selectedItemIds : [];
        const mergedSelection = Array.from(new Set([...selectedFromAI, ...vendorItemIds]));
        const updatedQuantities = { ...itemQuantities };

        // Apply explicit quantities if provided
        if (result.explicitQuantities && typeof result.explicitQuantities === 'object') {
          // Synonym mapping for better matching
          const synonymMap: Record<string, string[]> = {
            'dumpster': ['rolloff', 'dumpster'],
            'rolloff': ['rolloff', 'dumpster'],
            'porto': ['porto', 'porto potty', 'portable'],
            'porto potty': ['porto', 'porto potty', 'portable'],
            'portable': ['porto', 'porto potty', 'portable'],
          };

          // Iterate through explicit quantities
          Object.entries(result.explicitQuantities).forEach(([key, value]) => {
            const quantity = typeof value === 'number' ? value : parseFloat(value as string);
            if (isNaN(quantity) || quantity <= 0) return;

            const keyLower = key.toLowerCase();
            // Get synonyms for this key, or use the key itself
            const searchTerms = synonymMap[keyLower] || [keyLower];

            // Find items whose name matches any of the search terms (case-insensitive)
            allSelectableItems.forEach(item => {
              const itemNameLower = item.name.toLowerCase();
              // Check if item name contains any of the search terms
              const matches = searchTerms.some(term => itemNameLower.includes(term));
              
              if (matches) {
                // If multiple items match, prefer exact match or longest match
                // For now, set quantity for all matches (user can adjust if needed)
                updatedQuantities[item.id] = quantity;
              }
            });
          });
        }

        // Ensure vendor item quantities are always set
        mergedSelection.forEach(id => {
          if (updatedQuantities[id] === undefined) {
            const vendorItem = vendorItemMap.get(id);
            if (vendorItem) {
              updatedQuantities[id] = vendorItem.quantity || 0;
            }
          }
        });

        // Merge measurement-based quantities for selected items that lack explicit/vendor quantities
        if (priceItems.length > 0 && measurements) {
          const measuredQuantities = calculateItemQuantitiesFromMeasurements(
            measurements,
            priceItems,
            isTearOffMemo
          );
          mergedSelection.forEach((id) => {
            if ((updatedQuantities[id] ?? 0) === 0) {
              const measured = measuredQuantities[id];
              if (measured !== undefined && measured > 0) {
                updatedQuantities[id] = measured;
              }
            }
          });
        }

        // Remove zero-quantity items (keep vendor + flat-fee)
        const cleanedSelection = mergedSelection.filter(id => {
          const item = allSelectableItems.find(i => i.id === id);
          const qty = updatedQuantities[id] ?? 0;
          if (item?.isVendorItem) return true;
          const name = item?.name?.toLowerCase() || '';
          if (name.includes('delivery') || name.includes('rolloff') || name.includes('dumpster')) return true;
          return qty > 0;
        });

        onSetItemQuantities(updatedQuantities);
        onSetSelectedItems(cleanedSelection);
        
        // Show reasoning and warnings
        if (result.reasoning) {
          setSmartSelectionReasoning(result.reasoning);
        }
        if (Array.isArray(result.warnings)) {
          const warnings = [...result.warnings];
          if (isTearOff && measurements) {
            const rolloffQty = Math.ceil((measurements.total_squares || 0) / 15);
            warnings.push(`Rolloff quantity calculated as ${rolloffQty} based on ${measurements.total_squares || 0} squares tear-off`);
          }
          setSmartSelectionWarnings(warnings);
        } else if (isTearOff && measurements) {
          const rolloffQty = Math.ceil((measurements.total_squares || 0) / 15);
          setSmartSelectionWarnings([`Rolloff quantity calculated as ${rolloffQty} based on ${measurements.total_squares || 0} squares tear-off`]);
        }
      } else {
        throw new Error('Could not parse smart selection response');
      }
    } catch (error) {
      console.error('Smart selection error:', error);
      alert('Error generating smart selection. Please try again.');
    } finally {
      setIsGeneratingSelection(false);
    }
  };

  /**
   * Run Smart Selection for a specific building (used by "Generate for All Buildings").
   * Does not update global state — returns selectedItems and itemQuantities for the caller to store on that building.
   */
  const runSmartSelectionForBuilding = async (params: {
    roofSystem: string;
    measurements: Measurements;
    itemQuantities: Record<string, number>;
    vendorQuoteItemIds: string[];
    priceItems: PriceItem[];
    isTearOff: boolean;
  }): Promise<{ selectedItems: string[]; itemQuantities: Record<string, number> }> => {
    const { roofSystem: rs, measurements: m, itemQuantities: iq, vendorQuoteItemIds, priceItems: items, isTearOff: tearOff } = params;
    if (!rs || !m || allSelectableItems.length === 0) {
      throw new Error(rs ? 'Missing measurements or price items' : 'Roof system required');
    }

    const selectionItems = allSelectableItems.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      unit: item.unit,
      price: item.price,
      source: item.isVendorItem ? 'vendor' : 'price-list',
    }));

    const response = await fetch('/api/smart-selection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roofSystem: rs,
        jobDescription: jobDescription.trim() || '',
        measurements: m,
        selectionItems,
        vendorQuoteItems,
        itemQuantities: iq,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate smart selection');
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse smart selection response');
    }

    const result = JSON.parse(jsonMatch[0]);
    const selectedFromAI = Array.isArray(result.selectedItemIds) ? result.selectedItemIds : [];
    const mergedSelection = Array.from(new Set([...selectedFromAI, ...vendorQuoteItemIds]));
    const updatedQuantities = { ...iq };

    if (result.explicitQuantities && typeof result.explicitQuantities === 'object') {
      const synonymMap: Record<string, string[]> = {
        dumpster: ['rolloff', 'dumpster'],
        rolloff: ['rolloff', 'dumpster'],
        porto: ['porto', 'porto potty', 'portable'],
        'porto potty': ['porto', 'porto potty', 'portable'],
        portable: ['porto', 'porto potty', 'portable'],
      };
      Object.entries(result.explicitQuantities).forEach(([key, value]) => {
        const quantity = typeof value === 'number' ? value : parseFloat(value as string);
        if (isNaN(quantity) || quantity <= 0) return;
        const keyLower = key.toLowerCase();
        const searchTerms = synonymMap[keyLower] || [keyLower];
        allSelectableItems.forEach((item) => {
          const itemNameLower = item.name.toLowerCase();
          if (searchTerms.some((term) => itemNameLower.includes(term))) {
            updatedQuantities[item.id] = quantity;
          }
        });
      });
    }

    mergedSelection.forEach((id) => {
      if (updatedQuantities[id] === undefined) {
        const vendorItem = vendorItemMap.get(id);
        if (vendorItem) updatedQuantities[id] = vendorItem.quantity || 0;
      }
    });

    // Calculate measured quantities BEFORE filtering (Fix for Issue 1 & 2)
    // This ensures items have quantities before the cleanedSelection filter runs
    if (items.length > 0 && m) {
      const measuredQuantities = calculateItemQuantitiesFromMeasurements(m, items, tearOff);
      mergedSelection.forEach((id) => {
        // Only apply measured quantities if item doesn't already have a quantity
        if ((updatedQuantities[id] ?? 0) === 0) {
          const measured = measuredQuantities[id];
          if (measured !== undefined && measured > 0) {
            updatedQuantities[id] = measured;
          }
        }
      });
    }

    const cleanedSelection = mergedSelection.filter((id) => {
      const item = allSelectableItems.find((i) => i.id === id);
      const qty = updatedQuantities[id] ?? 0;
      if (item?.isVendorItem) return true;
      const name = item?.name?.toLowerCase() || '';
      if (name.includes('delivery') || name.includes('rolloff') || name.includes('dumpster')) return true;
      return qty > 0;
    });

    return { selectedItems: cleanedSelection, itemQuantities: updatedQuantities };
  };

  return {
    jobDescription,
    setJobDescription,
    smartSelectionReasoning,
    smartSelectionWarnings,
    isGeneratingSelection,
    quickSelections,
    setQuickSelections,
    isTearOff: isTearOffMemo,
    generateSmartSelection,
    runSmartSelectionForBuilding,
    analyzeJobForQuickSelections,
  };
};
