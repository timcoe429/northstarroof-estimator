import { useState, useMemo, useCallback, useEffect } from 'react';
import type { VendorQuote, VendorQuoteItem, PriceItem } from '@/types';
import type { GroupedVendorItem, SelectableItem } from '@/types/estimator';
import { generateId, normalizeVendor, formatVendorName, toNumber, fileToBase64 } from '@/lib/estimatorUtils';

interface UseVendorQuotesProps {
  selectedItems: string[];
  itemQuantities: Record<string, number>;
  priceItems: PriceItem[];
  onSetSelectedItems: (items: string[] | ((prev: string[]) => string[])) => void;
  onSetItemQuantities: (quantities: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void;
}

export const useVendorQuotes = ({
  selectedItems,
  itemQuantities,
  priceItems,
  onSetSelectedItems,
  onSetItemQuantities,
}: UseVendorQuotesProps) => {
  const [vendorQuotes, setVendorQuotes] = useState<VendorQuote[]>([]);
  const [vendorQuoteItems, setVendorQuoteItems] = useState<VendorQuoteItem[]>([]);
  const [isExtractingVendorQuote, setIsExtractingVendorQuote] = useState(false);
  const [showVendorBreakdown, setShowVendorBreakdown] = useState(false);
  const [groupedVendorDescriptions, setGroupedVendorDescriptions] = useState<Record<string, string>>({});
  const [isGeneratingGroupDescriptions, setIsGeneratingGroupDescriptions] = useState(false);

  const vendorItemMap = useMemo(() => {
    return new Map(vendorQuoteItems.map(item => [item.id, item]));
  }, [vendorQuoteItems]);

  const vendorQuoteMap = useMemo(() => {
    return new Map(vendorQuotes.map(quote => [quote.id, quote]));
  }, [vendorQuotes]);

  const vendorQuoteItemSubtotals = useMemo(() => {
    const totals = new Map<string, number>();
    vendorQuoteItems.forEach(item => {
      const itemTotal = item.extended_price || (item.quantity || 0) * (item.price || 0);
      totals.set(item.vendor_quote_id, (totals.get(item.vendor_quote_id) || 0) + itemTotal);
    });
    return totals;
  }, [vendorQuoteItems]);

  const vendorOverheadByQuoteId = useMemo(() => {
    const factors = new Map<string, number>();
    vendorQuotes.forEach(quote => {
      const itemSubtotal = vendorQuoteItemSubtotals.get(quote.id) || 0;
      const subtotal = quote.subtotal > 0 ? quote.subtotal : itemSubtotal;
      const total = quote.total > 0 ? quote.total : subtotal;
      const factor = subtotal > 0 ? total / subtotal : 1;
      factors.set(quote.id, factor);
    });
    return factors;
  }, [vendorQuotes, vendorQuoteItemSubtotals]);

  const vendorAdjustedPriceMap = useMemo(() => {
    const adjusted = new Map<string, number>();
    vendorQuoteItems.forEach(item => {
      const factor = vendorOverheadByQuoteId.get(item.vendor_quote_id) ?? 1;
      adjusted.set(item.id, (item.price || 0) * factor);
    });
    return adjusted;
  }, [vendorQuoteItems, vendorOverheadByQuoteId]);

  const vendorTaxFeesTotal = useMemo(() => {
    return vendorQuotes.reduce((sum, quote) => {
      const itemSubtotal = vendorQuoteItemSubtotals.get(quote.id) || 0;
      const subtotal = quote.subtotal > 0 ? quote.subtotal : itemSubtotal;
      const total = quote.total > 0 ? quote.total : subtotal;
      return sum + (total - subtotal);
    }, 0);
  }, [vendorQuotes, vendorQuoteItemSubtotals]);

  const vendorSelectableItems: SelectableItem[] = useMemo(() => {
    return vendorQuoteItems.map(item => {
      return {
        id: item.id,
        name: item.name,
        unit: item.unit || 'each',
        price: item.price || 0,
        coverage: null,
        coverageUnit: null,
        category: item.category,
        isVendorItem: true,
        vendorQuoteId: item.vendor_quote_id,
        vendorCategory: item.vendor_category,
      };
    });
  }, [vendorQuoteItems, vendorQuoteMap]);

  const buildGroupedVendorItems = useCallback((_descriptions: Record<string, string>) => {
    const groups = new Map<string, GroupedVendorItem>();
    const includeMatch = (itemName: string, patterns: string[]) => {
      const name = itemName.toUpperCase();
      return patterns.some(pattern => name.includes(pattern));
    };

    const vendorKits: Record<VendorQuote['vendor'], Array<{
      name: string;
      description: string;
      category: PriceItem['category'];
      patterns: string[];
    }>> = {
      schafer: [
        {
          name: 'Schafer Panel System',
          description: 'Standing seam metal panels including coil, fabrication, clips, and fasteners',
          category: 'materials',
          patterns: [
            'COIL',
            'PANEL FABRICATION',
            'FAB-PANEL',
            'PANEL CLIP',
            'PCMECH',
            'PANCAKESCREW',
            'PCSCGA',
          ],
        },
        {
          name: 'Schafer Flashing Kit',
          description: 'Custom fabricated metal flashing including eave, rake, ridge, valley, sidewall, headwall, starter, and trim pieces',
          category: 'materials',
          patterns: [
            'FAB EAVE',
            'FAB-EAVE',
            'FAB RAKE',
            'FAB-RAKE',
            'FAB RIDGE',
            'FAB-HIPRDGE',
            'HALF RIDGE',
            'FAB CZ',
            'FAB-CZFLSHNG',
            'FAB HEAD WALL',
            'FAB-HEADWALL',
            'FAB SIDE WALL',
            'FAB-SIDEWALL',
            'FAB STARTER',
            'FAB-STRTR',
            'FAB VALLEY',
            'FAB-WVALLEY',
            'FAB TRANSITION',
            'FAB-TRANSITION',
            'FAB DRIP EDGE',
            'FAB-DRIPEDGE',
            'FAB Z',
            'FAB-ZFLASH',
            'FAB PARAPET',
            'FAB-PARAPET',
            'FAB RAKE CLIP',
            'FAB-RAKECLP',
            'SHEET 4X10',
            'SHEET 3X10',
            'SCSH',
            'LINE FABRICATION',
            'FABTRIMSCHA',
          ],
        },
        {
          name: 'Schafer Delivery',
          description: 'Delivery and travel charges',
          category: 'equipment',
          patterns: [
            'FABCHOPDROP',
            'JOB SITE PANEL',
            'TRAVEL',
            'DELFEE',
            'DELIVERY FEE',
            'OVERNIGHT STAY',
          ],
        },
        {
          name: 'Schafer Accessories',
          description: 'Sealants, rivets, and finishing materials',
          category: 'accessories',
          patterns: [
            'SEALANT',
            'NOVA SEAL',
            'POPRIVET',
            'POP RIVET',
            'WOODGRIP',
          ],
        },
      ],
      tra: [
        {
          name: 'TRA Snow Retention System',
          description: 'Engineered snow retention including clamps, tubes, collars, and end caps',
          category: 'accessories',
          patterns: ['C22Z', 'CLAMP', 'SNOW FENCE TUBE', 'SNOW FENCE COLLAR', 'SNOW FENCE END CAP'],
        },
        {
          name: 'TRA Freight',
          description: 'Shipping and freight charges',
          category: 'equipment',
          patterns: ['FREIGHT'],
        },
      ],
      'rocky-mountain': [
        {
          name: 'Rocky Mountain Snow Guards',
          description: 'Everest Guard snow retention system for reliable snow management',
          category: 'accessories',
          patterns: ['EVEREST GUARD', 'EG10', 'SNOW GUARD'],
        },
      ],
    };

    type GroupedSourceItem = {
      id: string;
      name: string;
      category: PriceItem['category'];
      quantity: number;
      price: number;
      vendor: VendorQuote['vendor'];
      isVendorQuoteItem: boolean;
    };

    const addGroupItem = (
      groupId: string,
      groupName: string,
      description: string,
      category: PriceItem['category'],
      item: GroupedSourceItem,
      total: number,
    ) => {
      if (!groups.has(groupId)) {
        groups.set(groupId, {
          id: groupId,
          name: groupName,
          category,
          total: 0,
          description: description ? `${groupName} - ${description}` : '',
          itemIds: [],
          itemNames: [],
        });
      }
      const group = groups.get(groupId);
      if (!group) return;
      group.total += total;
      group.itemIds.push(item.id);
      group.itemNames.push(item.name);
    };

    const sourceItems: GroupedSourceItem[] = [];
    vendorQuoteItems.forEach(item => {
      if (!selectedItems.includes(item.id)) return;
      const quote = vendorQuoteMap.get(item.vendor_quote_id);
      if (!quote) return;
      sourceItems.push({
        id: item.id,
        name: item.name,
        category: item.category,
        quantity: itemQuantities[item.id] ?? item.quantity ?? 0,
        price: item.price ?? 0,
        vendor: quote.vendor,
        isVendorQuoteItem: true,
      });
    });

    priceItems.forEach(item => {
      if (item.category !== 'schafer') return;
      if (!selectedItems.includes(item.id)) return;
      sourceItems.push({
        id: item.id,
        name: item.name,
        category: item.category,
        quantity: itemQuantities[item.id] ?? 0,
        price: item.price ?? 0,
        vendor: 'schafer',
        isVendorQuoteItem: false,
      });
    });

    const itemsByVendor = new Map<VendorQuote['vendor'], GroupedSourceItem[]>();
    sourceItems.forEach(item => {
      const list = itemsByVendor.get(item.vendor) || [];
      list.push(item);
      itemsByVendor.set(item.vendor, list);
    });

    itemsByVendor.forEach((items, vendor) => {
      let remaining = [...items];
      const kits = vendorKits[vendor] || [];

      kits.forEach(kit => {
        const matched = remaining.filter(item => includeMatch(item.name, kit.patterns));
        if (matched.length === 0) return;
        matched.forEach(item => {
          const itemPrice = item.isVendorQuoteItem
            ? (vendorAdjustedPriceMap.get(item.id) ?? item.price ?? 0)
            : item.price;
          const total = itemPrice * (item.quantity || 0);
          const groupId = `${vendor}:${kit.name}`;
          addGroupItem(groupId, kit.name, kit.description, kit.category, item, total);
        });
        const matchedIds = new Set(matched.map(item => item.id));
        remaining = remaining.filter(item => !matchedIds.has(item.id));
      });

      if (remaining.length > 0) {
        const vendorName = formatVendorName(vendor);
        const groupName = `${vendorName} Additional Items`;
        remaining.forEach(item => {
          const itemPrice = item.isVendorQuoteItem
            ? (vendorAdjustedPriceMap.get(item.id) ?? item.price ?? 0)
            : item.price;
          const total = itemPrice * (item.quantity || 0);
          const groupId = `${vendor}:${groupName}`;
          const category = item.category === 'schafer' ? 'materials' : item.category || 'materials';
          addGroupItem(groupId, groupName, 'Additional materials and supplies', category, item, total);
        });
      }
    });

    return Array.from(groups.values()).filter(group => group.total > 0);
  }, [vendorQuoteItems, vendorQuoteMap, vendorAdjustedPriceMap, itemQuantities, selectedItems, priceItems]);

  const groupedVendorItems = useMemo(() => {
    return buildGroupedVendorItems(groupedVendorDescriptions);
  }, [buildGroupedVendorItems, groupedVendorDescriptions]);

  const groupedVendorItemsForDescription = useMemo(() => {
    return buildGroupedVendorItems({});
  }, [buildGroupedVendorItems]);

  const selectedVendorItemsTotal = useMemo(() => {
    const vendorTotal = vendorQuoteItems.reduce((sum, item) => {
      if (!selectedItems.includes(item.id)) return sum;
      const quantity = itemQuantities[item.id] ?? item.quantity ?? 0;
      const adjustedPrice = vendorAdjustedPriceMap.get(item.id) ?? item.price ?? 0;
      return sum + quantity * adjustedPrice;
    }, 0);
    const schaferTotal = priceItems.reduce((sum, item) => {
      if (item.category !== 'schafer') return sum;
      if (!selectedItems.includes(item.id)) return sum;
      const quantity = itemQuantities[item.id] ?? 0;
      return sum + quantity * (item.price || 0);
    }, 0);
    return vendorTotal + schaferTotal;
  }, [vendorQuoteItems, selectedItems, itemQuantities, vendorAdjustedPriceMap, priceItems]);

  const groupedVendorItemsTotal = useMemo(() => {
    return groupedVendorItems.reduce((sum, group) => sum + group.total, 0);
  }, [groupedVendorItems]);

  useEffect(() => {
    if (groupedVendorItems.length === 0) return;
    const diff = Math.abs(groupedVendorItemsTotal - selectedVendorItemsTotal);
    if (diff > 0.01) {
      console.warn('Grouped vendor totals mismatch', {
        groupedVendorItemsTotal,
        selectedVendorItemsTotal,
        diff,
      });
    }
  }, [groupedVendorItems, groupedVendorItemsTotal, selectedVendorItemsTotal]);

  useEffect(() => {
    setGroupedVendorDescriptions(prev => {
      const missing = groupedVendorItemsForDescription.filter(group => !prev[group.id]);
      if (missing.length === 0) return prev; // Return same reference — no update, no re-render
      
      const updated = { ...prev };
      const templateDescriptions: Record<string, string> = {
        Panels: 'Standing seam metal panels with clips and fasteners',
        Flashing: 'Custom fabricated metal flashing including eave, rake, ridge, and trim pieces',
        Delivery: 'Delivery and travel charges',
      };
      missing.forEach(group => {
        const template = templateDescriptions[group.name];
        if (template) {
          updated[group.id] = `${group.name} - ${template}`;
        }
      });
      return updated;
    });
  }, [groupedVendorItemsForDescription]); // ONLY depend on groupedVendorItemsForDescription

  const generateGroupedVendorDescriptions = async (_groups: GroupedVendorItem[]) => {
    return;
  };

  const extractVendorQuoteFromPdf = async (file: File) => {
    const base64 = await fileToBase64(file);
    const prompt = `You are extracting a roofing vendor quote PDF. Extract metadata and line items.

VENDOR DETECTION:
- "Schafer & Co" or "Schafer" → vendor: "schafer"
- "TRA Snow" or "TRA Snow & Sun" → vendor: "tra"
- "Rocky Mountain Snow Guards" → vendor: "rocky-mountain"

CATEGORY MAPPING:
- panels → category: materials (coil, panel fabrication, panel clips)
- flashing → category: materials (FAB- items: eave, rake, ridge, valley, sidewall, headwall, starter, drip edge, transition, parapet, z-flash)
- fasteners → category: materials (screws, rivets, sealant)
- snow-retention → category: accessories (snow guards, fence, tubes, collars, caps)
- delivery → category: equipment (travel, freight, chop & drop)

CRITICAL EXTRACTION RULES:
- Extract EVERY line item exactly as it appears in the quote
- Include ALL items: travel charges, overnight fees, delivery fees, tax, sealant, freight, etc.
- Do NOT filter out any items - even if they seem minor
- Do NOT skip fees, charges, or service items
- Quantities and prices must match the PDF exactly - do NOT recalculate
- Extract item descriptions exactly as written on the quote

Return ONLY JSON in this exact shape:
{
  "vendor": "schafer|tra|rocky-mountain",
  "quote_number": "string",
  "quote_date": "YYYY-MM-DD",
  "project_address": "string",
  "subtotal": 0,
  "tax": 0,
  "total": 0,
  "items": [
    {
      "name": "string",
      "unit": "EACH|LF|SF|etc",
      "price": 0,
      "quantity": 0,
      "extended_price": 0,
      "category": "materials|equipment|accessories",
      "vendor_category": "panels|flashing|fasteners|snow-retention|delivery"
    }
  ]
}

IMPORTANT:
- Ensure subtotal is the pre-tax sum of line items.
- Ensure total equals subtotal + tax + any fees shown.
- If tax or total are missing, set them to 0 and still return numeric values.
- Extract ALL line items - do not skip any items from the quote.

Return only the JSON object, no other text.`;

    const response = await fetch('/api/extract-vendor-quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pdf: base64,
        prompt,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to extract vendor quote');
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse vendor quote data');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const quoteId = generateId();
    const vendor = normalizeVendor(parsed.vendor);

    const quote: VendorQuote = {
      id: quoteId,
      estimate_id: '',
      vendor,
      quote_number: parsed.quote_number || '',
      quote_date: parsed.quote_date || '',
      project_address: parsed.project_address || '',
      file_name: file.name || '',
      subtotal: toNumber(parsed.subtotal),
      tax: toNumber(parsed.tax),
      total: toNumber(parsed.total),
    };

    const items: VendorQuoteItem[] = (parsed.items || []).map((item: any) => {
      const quantity = toNumber(item.quantity);
      const price = toNumber(item.price);
      const extended = toNumber(item.extended_price) || quantity * price;
      const normalizedCategory = ['materials', 'equipment', 'accessories'].includes(item.category)
        ? item.category
        : 'materials';
      const normalizedVendorCategory = ['panels', 'flashing', 'fasteners', 'snow-retention', 'delivery'].includes(item.vendor_category)
        ? item.vendor_category
        : 'panels';
      return {
        id: generateId(),
        vendor_quote_id: quoteId,
        name: item.name || 'Vendor Item',
        unit: item.unit || 'each',
        price,
        quantity,
        extended_price: extended,
        category: normalizedCategory as VendorQuoteItem['category'],
        vendor_category: normalizedVendorCategory as VendorQuoteItem['vendor_category'],
      };
    });

    const computedSubtotal = items.reduce((sum, item) => sum + (item.extended_price || 0), 0);
    if (!quote.subtotal) {
      quote.subtotal = computedSubtotal;
    }
    if (!quote.total) {
      quote.total = quote.subtotal + (quote.tax || 0);
    }

    return { quote, items };
  };

  const handleVendorQuoteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    setIsExtractingVendorQuote(true);
    try {
      const newQuotes: VendorQuote[] = [];
      const newItems: VendorQuoteItem[] = [];

      for (const file of files) {
        const { quote, items } = await extractVendorQuoteFromPdf(file);
        newQuotes.push(quote);
        // Add all quote items directly - no matching logic
        // Schafer quotes are the source of truth, all items are included
        newItems.push(...items);
      }

      if (newQuotes.length > 0) {
        setVendorQuotes(prev => [...prev, ...newQuotes]);
      }

      if (newItems.length > 0) {
        const newItemIds = newItems.map(item => item.id);
        setVendorQuoteItems(prev => [...prev, ...newItems]);
        onSetSelectedItems(prev => Array.from(new Set([...prev, ...newItemIds])));
        onSetItemQuantities(prev => {
          const updated = { ...prev };
          newItems.forEach(item => {
            updated[item.id] = item.quantity || 0;
          });
          return updated;
        });
      }
    } catch (error) {
      console.error('Vendor quote extraction error:', error);
      alert('Error extracting vendor quote. Please try again.');
    } finally {
      setIsExtractingVendorQuote(false);
      e.target.value = '';
    }
  };

  const removeVendorQuoteFromState = (quoteId: string) => {
    const removedItemIds = vendorQuoteItems
      .filter(item => item.vendor_quote_id === quoteId)
      .map(item => item.id);

    setVendorQuotes(prev => prev.filter(quote => quote.id !== quoteId));
    setVendorQuoteItems(prev => prev.filter(item => item.vendor_quote_id !== quoteId));
    onSetSelectedItems(prev => prev.filter(id => !removedItemIds.includes(id)));
    onSetItemQuantities(prev => {
      const updated = { ...prev };
      removedItemIds.forEach(id => {
        delete updated[id];
      });
      return updated;
    });
  };

  const ensureVendorItemQuantities = (selectedIds: string[]) => {
    if (vendorItemMap.size === 0) return;
    onSetItemQuantities(prev => {
      const updated = { ...prev };
      selectedIds.forEach(id => {
        if (updated[id] === undefined) {
          const vendorItem = vendorItemMap.get(id);
          if (vendorItem) {
            updated[id] = vendorItem.quantity || 0;
          }
        }
      });
      return updated;
    });
  };

  return {
    vendorQuotes,
    setVendorQuotes,
    vendorQuoteItems,
    setVendorQuoteItems,
    isExtractingVendorQuote,
    showVendorBreakdown,
    setShowVendorBreakdown,
    groupedVendorDescriptions,
    setGroupedVendorDescriptions,
    isGeneratingGroupDescriptions,
    setIsGeneratingGroupDescriptions,
    vendorItemMap,
    vendorQuoteMap,
    vendorAdjustedPriceMap,
    vendorOverheadByQuoteId,
    vendorQuoteItemSubtotals,
    vendorTaxFeesTotal,
    groupedVendorItems,
    groupedVendorItemsForDescription,
    selectedVendorItemsTotal,
    groupedVendorItemsTotal,
    vendorSelectableItems,
    extractVendorQuoteFromPdf,
    handleVendorQuoteUpload,
    removeVendorQuoteFromState,
    buildGroupedVendorItems,
    generateGroupedVendorDescriptions,
    ensureVendorItemQuantities,
  };
};
