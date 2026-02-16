import { useState, useMemo } from 'react';
import type { Measurements } from '@/types';
import type { QuickSelectOption, SelectableItem } from '@/types/estimator';
import { removeKeywordFromDescription } from '@/lib/estimatorUtils';

interface UseSmartSelectionProps {
  measurements: Measurements | null;
  vendorQuotes: any[];
  allSelectableItems: SelectableItem[];
  vendorQuoteItems: any[];
  vendorItemMap: Map<string, any>;
  itemQuantities: Record<string, number>;
  isTearOff: boolean;
  onSetItemQuantities: (quantities: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void;
  onSetSelectedItems: (items: string[] | ((prev: string[]) => string[])) => void;
  onSetJobDescription: (description: string | ((prev: string) => string)) => void;
}

export const useSmartSelection = ({
  measurements,
  vendorQuotes,
  allSelectableItems,
  vendorQuoteItems,
  vendorItemMap,
  itemQuantities,
  isTearOff,
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

  // Generate smart selection based on job description
  const generateSmartSelection = async () => {
    if (!jobDescription.trim() || !measurements || allSelectableItems.length === 0) {
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
${JSON.stringify(measurements, null, 2)}

PRICE LIST:
${JSON.stringify(selectionItems, null, 2)}

RULES:
1. METAL ROOF: If the job description mentions "metal roof", do NOT select Brava or DaVinci products.
2. PRODUCT LINES: Only select ONE system (Brava OR DaVinci, never both)
3. LABOR: Only select ONE crew (Hugo/Alfredo/Chris/Sergio). Pick the right Hugo rate based on pitch if Hugo is chosen.
4. SLOPE-AWARE: If pitch >= 8/12, use High Slope/Hinged H&R variants. If < 8/12, use regular H&R.
5. TEAR-OFF: If mentioned, include Landfill Charge (NOT "Rolloff") and OSB. Calculate OSB as (total_squares * 3) sheets. Landfill Charge quantity = Math.ceil(total_squares / 15).
6. DELIVERY: If Brava selected, include Brava Delivery ($5,000 flat fee).
7. UNDERLAYMENT — CRITICAL RULES:
   a) OC Titanium PSU 30 — ALWAYS select on EVERY roof (metal and non-metal), no exceptions
   b) For NON-METAL roofs (Brava, DaVinci, asphalt, cedar): ALSO select SolarHide Radiant Barrier IN ADDITION to PSU 30
   c) For METAL roofs (with Schafer vendor quote): ALSO select GAF VersaShield IN ADDITION to PSU 30
   d) NEVER select Sharkskin (replaced by SolarHide)
   e) NEVER select Grace Ice & Water High Temp as primary underlayment (it is supplemental only for valleys/eaves)
8. FLASHING — CRITICAL RULES:
   a) For NON-METAL roofs (Brava, DaVinci, asphalt, cedar): DEFAULT to standard aluminum flashing (D-Style Eave, D-Style Rake, Valley, Step Flash, Headwall or Pitch Change, Flat Sheet, Hip & Ridge)
   b) NEVER auto-select copper flashing UNLESS user explicitly says "copper" in job description
   c) For METAL roofs (with Schafer vendor quote): Do NOT select ANY flashing from price list — all flashing comes from Schafer vendor quote
9. FASTENERS — CRITICAL RULES:
   a) Synthetic systems (Brava, DaVinci): select 1 3/4" ringshank nails (look for "1.75" or "1 3/4"" with "ringshank" or "RS" or "HDG")
   b) Presidential asphalt: select 1 3/4" non-ringshank nails
   c) Basic/standard asphalt: select 1 1/2" non-ringshank nails
   d) Metal roofs (with Schafer vendor quote): Do NOT select nails from price list — fasteners come from Schafer vendor quote
   e) ALL systems: select 1.25" Plasticap Pail for underlayment attachment
10. EQUIPMENT & FEES — Use exact names:
   a) Landfill Charge (NOT "Rolloff") — $750, quantity 1 per job
   b) Porto Potty — $600, quantity 1 per job
   c) Fuel Charge — $194, quantity 1 per job
   d) Overnight Charge — $387/night, auto-include when Hugo or Sergio labor crew is selected
11. OPTIONAL ITEMS — Do NOT auto-select these (user adds manually via Calculated Accessories):
   a) Heat Tape (material and labor)
   b) Snow Guards (material and install)
   c) Snow Fence / ColorGard (material and install)
   d) Skylights
12. ACCESSORIES/CONSUMABLES: Do NOT select items like caulk, sealant, spray paint unless:
   a) Explicitly mentioned in job description (e.g., "need 5 tubes of sealant")
   b) Part of a vendor quote (vendor items always get selected)
   These are covered by the Sundries/Misc Materials percentage.
13. ZERO QUANTITY RULE: Do NOT select any item that would result in 0 quantity. If you can't calculate a quantity for an item and it's not a flat-fee item (delivery, landfill), don't select it.
14. SPECIAL REQUESTS: If user mentions specific items (copper valleys, specific accessories), select those even if they override defaults.
15. VENDOR ITEMS: Vendor items already have quantities from the quote. Do NOT infer quantities unless explicitly stated.

EXPLICIT QUANTITIES:
If the job description specifies an exact quantity for an item, extract it in the "explicitQuantities" object.
- Look for patterns like "250 snowguards", "3 rolloffs", "2 dumpsters", "3 porto potties", "need 2 rolloffs"
- Only extract when a NUMBER is directly stated with an item name
- Use a partial item name as the key (e.g., "snowguard" for "Snowguard Install", "rolloff" or "dumpster" for "Rolloff", "porto" for "Porto Potty")
- Do NOT guess quantities - only extract when explicitly stated
- Handle synonyms: "dumpster" and "rolloff" refer to the same item, "porto" and "porto potty" refer to the same item
- Examples:
  * "Also give us 250 snowguards" → {"snowguard": 250}
  * "add 2 dumpsters" → {"rolloff": 2} or {"dumpster": 2} (both work)
  * "need 2 rolloffs" → {"rolloff": 2}
  * "3 porto potties" → {"porto": 3} or {"porto potty": 3}
  * "add snowguards" → NO explicit quantity (don't include in explicitQuantities)
  * "Brava tile" → NO explicit quantity

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
    analyzeJobForQuickSelections,
  };
};
