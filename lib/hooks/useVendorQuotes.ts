import { useState, useMemo, useEffect, useCallback } from 'react';
import { generateId, toNumber } from '@/lib/utils/helpers';
import type { VendorQuote, VendorQuoteItem, PriceItem } from '@/types';

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

type UseVendorQuotesCallbacks = {
  priceItems: PriceItem[];
  itemQuantities: Record<string, number>;
  selectedItems: string[];
  setSelectedItems: React.Dispatch<React.SetStateAction<string[]>>;
  setItemQuantities: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  fileToBase64: (file: File) => Promise<string>;
  updatePriceItem: (id: string, updates: Partial<PriceItem>) => Promise<void>;
};

export function useVendorQuotes(callbacks: UseVendorQuotesCallbacks) {
  const {
    priceItems,
    itemQuantities,
    selectedItems,
    setSelectedItems,
    setItemQuantities,
    fileToBase64,
    updatePriceItem,
  } = callbacks;

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

  const vendorQuoteTotals = useMemo(() => {
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
    return vendorQuoteItems.map(item => ({
      id: item.id,
      name: item.name,
      unit: item.unit || 'each',
      price: item.price || 0,
      coverage: null,
      coverageUnit: null,
      category: item.category,
      proposalDescription: null,
      isVendorItem: true,
      vendorQuoteId: item.vendor_quote_id,
      vendorCategory: item.vendor_category,
    }));
  }, [vendorQuoteItems]);

  const normalizeVendor = (value: string): VendorQuote['vendor'] => {
    const normalized = (value || '').toLowerCase();
    if (normalized.includes('schafer')) return 'schafer';
    if (normalized.includes('tra')) return 'tra';
    if (normalized.includes('rocky')) return 'rocky-mountain';
    return 'schafer';
  };

  const formatVendorName = (vendor: VendorQuote['vendor']) => {
    if (vendor === 'schafer') return 'Schafer';
    if (vendor === 'tra') return 'TRA';
    return 'Rocky Mountain';
  };

  const findSchaferMatch = (itemName: string, schaferItems: PriceItem[]) => {
    const name = itemName.toUpperCase();
    const byName = (target: string) => schaferItems.find(item => item.name === target) || null;

    if (name.includes('SCCL20') || name.includes('COIL 20')) {
      return byName('Schafer Coil 20" 24ga');
    }
    if (name.includes('SCCL48') || name.includes('COIL 48')) {
      return byName('Schafer Coil 48" 24ga Galvanized');
    }
    if (name.includes('PANEL FABRICATION') || name.includes('FAB-PANEL') || name.includes('SCFA') || name.includes('PANEL FAB')) {
      return byName('Schafer Panel Fabrication Steel SS150');
    }
    if (name.includes('PANEL CLIP') && (name.includes('1-1/2') || name.includes('1.5'))) {
      return byName('Schafer Panel Clip Mech 1-1/2" 24ga');
    }
    if (name.includes('PANEL CLIP') && (name.includes('1"') || name.includes('1 IN'))) {
      return byName('Schafer Panel Clip Mech 1" 24ga');
    }
    if (name.includes('PANCAKE') || name.includes('PCSCGA')) {
      return byName('Schafer Pancake Screw 1" Galv/Zinc');
    }
    if (name.includes('SHEET 4X10') && name.includes('GALV')) {
      return byName('Schafer Sheet 4x10 Galv 24ga');
    }
    if (name.includes('SHEET 4X10') || name.includes('SCSH')) {
      return byName('Schafer Sheet 4x10 24ga');
    }
    if (name.includes('SHEET 3X10') && (name.includes('COPPER') || name.includes('24OZ'))) {
      return byName('Schafer Sheet 3x10 Copper 24oz');
    }
    if (name.includes('FAB-EAVE') || name.includes('FAB EAVE')) {
      return byName('Schafer Fab Eave');
    }
    if (name.includes('FAB-RAKECLP') || name.includes('FAB RAKE CLIP')) {
      return byName('Schafer Fab Rake Clip');
    }
    if (name.includes('FAB-RAKE') || name.includes('FAB RAKE')) {
      return byName('Schafer Fab Rake');
    }
    if (name.includes('FAB-HIPRDGE') || name.includes('FAB RIDGE')) {
      return byName('Schafer Fab Ridge');
    }
    if (name.includes('HALF RIDGE')) {
      return byName('Schafer Fab Half Ridge');
    }
    if (name.includes('FAB-CZFLSHNG') || name.includes('FAB CZ')) {
      return byName('Schafer Fab CZ Flashing');
    }
    if (name.includes('FAB-HEADWALL') || name.includes('FAB HEAD WALL')) {
      return byName('Schafer Fab Head Wall');
    }
    if (name.includes('FAB-SIDEWALL') || name.includes('FAB SIDE WALL')) {
      return byName('Schafer Fab Side Wall');
    }
    if (name.includes('FAB-STRTR') || name.includes('FAB STARTER')) {
      return byName('Schafer Fab Starter');
    }
    if (name.includes('FAB-WVALLEY') || name.includes('FAB VALLEY')) {
      return byName('Schafer Fab W Valley');
    }
    if (name.includes('FAB-TRANSITION') || name.includes('FAB TRANSITION')) {
      return byName('Schafer Fab Transition');
    }
    if (name.includes('FAB-DRIPEDGE') || name.includes('FAB DRIP EDGE')) {
      return byName('Schafer Fab Drip Edge');
    }
    if (name.includes('FAB-ZFLASH') || name.includes('FAB Z')) {
      return byName('Schafer Fab Z Flash');
    }
    if (name.includes('FAB-PARAPET')) {
      return name.includes('CLEAT')
        ? byName('Schafer Fab Parapet Cleat')
        : byName('Schafer Fab Parapet Cap');
    }
    if (name.includes('LINE FABRICATION') || name.includes('FABTRIMSCHA')) {
      return byName('Schafer Fab Line Fabrication');
    }
    if (name.includes('PANEL RUN') && name.includes('MILE')) {
      return byName('Schafer Job Site Panel Run (per mile)');
    }
    if (name.includes('PANEL RUN')) {
      return byName('Schafer Job Site Panel Run (base)');
    }
    if (name.includes('DELIVERY FEE') || name.includes('DELFEE')) {
      return byName('Schafer Retail Delivery Fee');
    }
    if (name.includes('OVERNIGHT')) {
      return byName('Schafer Overnight Stay');
    }
    if (name.includes('NOVA SEAL') || name.includes('SEALANT')) {
      return byName('Schafer Nova Seal Sealant');
    }
    if (name.includes('POP RIVET') && name.includes('STAINLESS')) {
      return byName('Schafer Pop Rivet 1/8" Stainless');
    }
    if (name.includes('POP RIVET')) {
      return byName('Schafer Pop Rivet 1/8"');
    }
    if (name.includes('WOODGRIP')) {
      return byName('Schafer Woodgrip 1-1/2" Galv');
    }
    return null;
  };

  const applySchaferQuoteMatching = async (items: VendorQuoteItem[]) => {
    const schaferItems = priceItems.filter(item => item.category === 'schafer');
    if (schaferItems.length === 0) {
      return { unmatchedItems: items, matchedIds: [] as string[], matchedQuantities: {} as Record<string, number> };
    }

    const unmatchedItems: VendorQuoteItem[] = [];
    const matchedIds: string[] = [];
    const matchedQuantities: Record<string, number> = {};

    for (const item of items) {
      const match = findSchaferMatch(item.name, schaferItems);
      if (match) {
        const quotePrice = toNumber(item.price);
        if (quotePrice > 0 && Math.abs(quotePrice - match.price) > 0.001) {
          await updatePriceItem(match.id, { price: quotePrice });
        }
        matchedIds.push(match.id);
        matchedQuantities[match.id] = item.quantity || 0;
      } else {
        unmatchedItems.push(item);
      }
    }

    return { unmatchedItems, matchedIds, matchedQuantities };
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

    const items: VendorQuoteItem[] = (parsed.items || []).map((item) => {
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
      const matchedIds: string[] = [];
      const matchedQuantities: Record<string, number> = {};

      for (const file of files) {
        const { quote, items } = await extractVendorQuoteFromPdf(file);
        newQuotes.push(quote);
        if (quote.vendor === 'schafer') {
          const matched = await applySchaferQuoteMatching(items);
          newItems.push(...matched.unmatchedItems);
          matchedIds.push(...matched.matchedIds);
          Object.assign(matchedQuantities, matched.matchedQuantities);
        } else {
          newItems.push(...items);
        }
      }

      if (newQuotes.length > 0) {
        setVendorQuotes(prev => [...prev, ...newQuotes]);
      }

      if (newItems.length > 0) {
        const newItemIds = newItems.map(item => item.id);
        setVendorQuoteItems(prev => [...prev, ...newItems]);
        setSelectedItems(prev => Array.from(new Set([...prev, ...newItemIds])));
        setItemQuantities(prev => {
          const updated = { ...prev };
          newItems.forEach(item => {
            updated[item.id] = item.quantity || 0;
          });
          return updated;
        });
      }

      if (matchedIds.length > 0) {
        setSelectedItems(prev => Array.from(new Set([...prev, ...matchedIds])));
        setItemQuantities(prev => {
          const updated = { ...prev };
          Object.entries(matchedQuantities).forEach(([id, quantity]) => {
            updated[id] = quantity;
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
    setSelectedItems(prev => prev.filter(id => !removedItemIds.includes(id)));
    setItemQuantities(prev => {
      const updated = { ...prev };
      removedItemIds.forEach(id => {
        delete updated[id];
      });
      return updated;
    });
  };

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
    const missing = groupedVendorItemsForDescription.filter(group => !groupedVendorDescriptions[group.id]);
    if (missing.length === 0) return;

    const templateDescriptions: Record<string, string> = {
      Panels: 'Standing seam metal panels with clips and fasteners',
      Flashing: 'Custom fabricated metal flashing including eave, rake, ridge, and trim pieces',
      Delivery: 'Delivery and travel charges',
    };

    setGroupedVendorDescriptions(prev => {
      const updated = { ...prev };
      missing.forEach(group => {
        const template = templateDescriptions[group.name];
        if (template) {
          updated[group.id] = `${group.name} - ${template}`;
        }
      });
      return updated;
    });
  }, [groupedVendorItemsForDescription, groupedVendorDescriptions]);

  return {
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
  };
}
