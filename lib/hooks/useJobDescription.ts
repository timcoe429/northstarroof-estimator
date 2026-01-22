import { useState, useMemo, useEffect, useCallback } from 'react';
import { escapeRegExp } from '@/lib/utils/helpers';
import type { Measurements, VendorQuote, VendorQuoteItem, PriceItem } from '@/types';

type QuickSelectOption = {
  id: string;
  label: string;
  keyword: string;
  suggested: boolean;
  selected: boolean;
  icon?: string;
};

type SelectableItem = PriceItem & {
  isVendorItem?: boolean;
  vendorQuoteId?: string;
  vendorCategory?: VendorQuoteItem['vendor_category'];
  isCustomItem?: boolean;
};

type GenerateSmartSelectionCallbacks = {
  measurements: Measurements | null;
  allSelectableItems: SelectableItem[];
  vendorQuoteItems: VendorQuoteItem[];
  vendorItemMap: Map<string, VendorQuoteItem>;
  itemQuantities: Record<string, number>;
  setItemQuantities: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setSelectedItems: React.Dispatch<React.SetStateAction<string[]>>;
};

export function useJobDescription(
  measurements: Measurements | null,
  vendorQuotes: VendorQuote[],
  callbacks: GenerateSmartSelectionCallbacks
) {
  const [jobDescription, setJobDescription] = useState('');
  const [smartSelectionReasoning, setSmartSelectionReasoning] = useState('');
  const [smartSelectionWarnings, setSmartSelectionWarnings] = useState<string[]>([]);
  const [isGeneratingSelection, setIsGeneratingSelection] = useState(false);
  const [quickSelections, setQuickSelections] = useState<QuickSelectOption[]>([]);

  const isTearOff = useMemo(() => {
    const desc = jobDescription.toLowerCase();
    const quickTearOff = quickSelections.find(option => option.id === 'tear-off')?.selected ?? false;
    return desc.includes('tear-off') || quickTearOff;
  }, [jobDescription, quickSelections]);

  const analyzeJobForQuickSelections = useCallback((m: Measurements, descriptionOverride?: string) => {
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
      setJobDescription(prev => {
        if (prev.toLowerCase().includes('steep')) return prev;
        return prev ? `${prev}, steep pitch` : 'steep pitch';
      });
    }

    if (hasSchaferQuote && descriptionOverride === undefined) {
      setJobDescription(prev => {
        if (prev.toLowerCase().includes('metal roof')) return prev;
        return prev ? `${prev}, metal roof` : 'metal roof';
      });
    }
  }, [jobDescription, vendorQuotes]);

  useEffect(() => {
    if (measurements) {
      analyzeJobForQuickSelections(measurements);
    }
  }, [vendorQuotes, measurements, analyzeJobForQuickSelections]);

  const removeKeywordFromDescription = (description: string, keyword: string) => {
    if (!description) return '';
    const escaped = escapeRegExp(keyword);
    const withCommas = new RegExp(`(^|,\\s*)${escaped}(?=\\s*,|$)`, 'i');
    let updated = description;
    if (withCommas.test(updated)) {
      updated = updated.replace(withCommas, '');
    } else {
      updated = updated.replace(new RegExp(escaped, 'i'), '');
    }
    return updated
      .replace(/\s*,\s*,\s*/g, ', ')
      .replace(/^,\s*/g, '')
      .replace(/\s*,\s*$/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };

  const generateSmartSelection = async () => {
    const {
      measurements: measurementsValue,
      allSelectableItems,
      vendorQuoteItems,
      vendorItemMap,
      itemQuantities,
      setItemQuantities,
      setSelectedItems,
    } = callbacks;

    if (!jobDescription.trim() || !measurementsValue || allSelectableItems.length === 0) {
      alert('Please provide a job description and ensure you have price items or vendor items.');
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

      const prompt = `You are a roofing estimator assistant. Based on the job description and measurements, select the appropriate items from the price list.

JOB DESCRIPTION:
${jobDescription}

MEASUREMENTS:
${JSON.stringify(measurementsValue, null, 2)}

PRICE LIST:
${JSON.stringify(selectionItems, null, 2)}

RULES:
1. METAL ROOF: If the job description mentions "metal roof", do NOT select Brava or DaVinci products.
2. PRODUCT LINES: Only select ONE system (Brava OR DaVinci, never both)
3. LABOR: Only select ONE crew (Hugo/Alfredo/Chris/Sergio). Pick the right Hugo rate based on pitch if Hugo is chosen.
4. SLOPE-AWARE: If pitch >= 8/12, use High Slope/Hinged H&R variants. If < 8/12, use regular H&R.
5. TEAR-OFF: If mentioned, include Rolloff and OSB. Calculate OSB as (total_squares * 3) sheets.
6. DELIVERY: If Brava selected, include Brava Delivery.
7. UNDERLAYMENT: Select appropriate underlayment (Ice & Water for valleys/eaves, synthetic for field)
8. ACCESSORIES/CONSUMABLES: Do NOT select items like caulk, sealant, spray paint, nails, screws unless they are:
   a) Explicitly mentioned in job description (e.g., "need 5 tubes of sealant")
   b) Part of a vendor quote (vendor items always get selected)
   These items are typically covered by the Sundries/Misc Materials percentage.
9. ZERO QUANTITY RULE: Do NOT select any item that would result in 0 quantity. If you can't calculate a quantity for an item and it's not a flat-fee item (delivery, rolloff), don't select it.
10. SPECIAL REQUESTS: If user mentions specific items (copper valleys, snowguards, skylights), select those.
11. VENDOR ITEMS: Vendor items already have quantities from the quote. Do NOT infer quantities unless explicitly stated.

EXPLICIT QUANTITIES:
If the job description specifies an exact quantity for an item, extract it in the "explicitQuantities" object.
- Look for patterns like "250 snowguards", "3 rolloffs", "2 dumpsters", "100 snowguards"
- Only extract when a NUMBER is directly stated with an item name
- Use a partial item name as the key (e.g., "snowguard" for "Snowguard Install")
- Do NOT guess quantities - only extract when explicitly stated
- Examples:
  * "Also give us 250 snowguards" → {"snowguard": 250}
  * "add snowguards" → NO explicit quantity (don't include in explicitQuantities)
  * "Brava tile" → NO explicit quantity
  * "3 rolloffs" → {"rolloff": 3}

Return ONLY JSON:
{
  "selectedItemIds": ["id1", "id2", ...],
  "explicitQuantities": {
    "item_name_partial": quantity_number
  },
  "reasoning": "Brief explanation of why you selected these items",
  "warnings": ["Any concerns or things to double-check"]
}

The "explicitQuantities" object should only contain items where a NUMBER was explicitly stated in the job description.
If no explicit quantities are found, use an empty object: "explicitQuantities": {}

Only return the JSON, no other text.`;

      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          max_tokens: 2000,
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
          // Iterate through explicit quantities
          Object.entries(result.explicitQuantities).forEach(([key, value]) => {
            const quantity = typeof value === 'number' ? value : parseFloat(value as string);
            if (isNaN(quantity)) return;

            // Find items whose name contains the key (case-insensitive)
            const keyLower = key.toLowerCase();
            allSelectableItems.forEach(item => {
              if (item.name.toLowerCase().includes(keyLower)) {
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

        // Remove zero-quantity items (keep vendor + flat-fee)
        const cleanedSelection = mergedSelection.filter(id => {
          const item = allSelectableItems.find(i => i.id === id);
          const qty = updatedQuantities[id] ?? 0;
          if (item?.isVendorItem) return true;
          const name = item?.name?.toLowerCase() || '';
          if (name.includes('delivery') || name.includes('rolloff') || name.includes('dumpster')) return true;
          return qty > 0;
        });

        setItemQuantities(updatedQuantities);
        setSelectedItems(cleanedSelection);
        
        // Show reasoning and warnings
        if (result.reasoning) {
          setSmartSelectionReasoning(result.reasoning);
        }
        if (Array.isArray(result.warnings)) {
          const warnings = [...result.warnings];
          if (isTearOff && measurementsValue) {
            const rolloffQty = Math.ceil((measurementsValue.total_squares || 0) / 15);
            warnings.push(`Rolloff quantity calculated as ${rolloffQty} based on ${measurementsValue.total_squares || 0} squares tear-off`);
          }
          setSmartSelectionWarnings(warnings);
        } else if (isTearOff && measurementsValue) {
          const rolloffQty = Math.ceil((measurementsValue.total_squares || 0) / 15);
          setSmartSelectionWarnings([`Rolloff quantity calculated as ${rolloffQty} based on ${measurementsValue.total_squares || 0} squares tear-off`]);
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

  return {
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
  };
}
