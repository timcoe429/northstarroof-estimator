'use client'

import React, { useState, useCallback, useEffect } from 'react';
import { Upload, DollarSign, Calculator, Settings, ChevronDown, ChevronUp, AlertCircle, Check, X, Edit2, Plus, Trash2, Package, Users, Truck, Wrench } from 'lucide-react';

// Type definitions
interface Measurements {
  total_squares: number;
  predominant_pitch: string;
  ridge_length: number;
  hip_length: number;
  valley_length: number;
  eave_length: number;
  rake_length: number;
  penetrations: number;
  skylights: number;
  chimneys: number;
  complexity: string;
  fileName?: string;
}

interface PriceItem {
  id: string;
  name: string;
  unit: string;
  price: number;
  coverage: number | null;
  coverageUnit: string | null;
  category: 'materials' | 'labor' | 'equipment' | 'accessories';
}

interface LineItem extends PriceItem {
  baseQuantity: number;
  quantity: number;
  total: number;
  wasteAdded: number;
}

interface CustomerInfo {
  name: string;
  address: string;
  phone: string;
}

interface Estimate {
  lineItems: LineItem[];
  byCategory: {
    materials: LineItem[];
    labor: LineItem[];
    equipment: LineItem[];
    accessories: LineItem[];
  };
  totals: {
    materials: number;
    labor: number;
    equipment: number;
    accessories: number;
  };
  baseCost: number;
  officeCostPercent: number;
  officeAllocation: number;
  totalCost: number;
  marginPercent: number;
  wastePercent: number;
  sellPrice: number;
  grossProfit: number;
  profitMargin: number;
  measurements: Measurements;
  customerInfo: CustomerInfo;
  generatedAt: string;
}

// Category definitions with icons
const CATEGORIES = {
  materials: { label: 'Materials', icon: Package, color: 'blue' },
  labor: { label: 'Labor', icon: Users, color: 'green' },
  equipment: { label: 'Equipment & Fees', icon: Truck, color: 'orange' },
  accessories: { label: 'Accessories', icon: Wrench, color: 'purple' },
};

// Unit types for calculations
const UNIT_TYPES = [
  { value: 'sq', label: 'per square', calcType: 'area' },
  { value: 'bundle', label: 'per bundle', calcType: 'area', needsCoverage: true },
  { value: 'roll', label: 'per roll', calcType: 'area', needsCoverage: true },
  { value: 'lf', label: 'per linear ft', calcType: 'linear' },
  { value: 'each', label: 'each', calcType: 'count' },
  { value: 'pail', label: 'per pail', calcType: 'count' },
  { value: 'box', label: 'per box', calcType: 'count' },
  { value: 'tube', label: 'per tube', calcType: 'count' },
  { value: 'sheet', label: 'per sheet', calcType: 'count' },
  { value: 'flat', label: 'flat fee', calcType: 'flat' },
];

// What measurements each calc type uses
const CALC_MAPPINGS = {
  area: ['total_squares'],
  linear: ['ridge_length', 'hip_length', 'valley_length', 'eave_length', 'rake_length'],
  count: ['penetrations', 'skylights', 'chimneys'],
  flat: [],
};

export default function RoofScopeEstimator() {
  // Core state
  const [step, setStep] = useState('upload');
  const [measurements, setMeasurements] = useState<Measurements | null>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({ name: '', address: '', phone: '' });

  // Price list state
  const [priceItems, setPriceItems] = useState<PriceItem[]>(() => {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem('roofscope_price_items_v2');
    return saved ? JSON.parse(saved) : [];
  });
  const [showPrices, setShowPrices] = useState(false);
  const [priceSheetProcessing, setPriceSheetProcessing] = useState(false);
  const [extractedItems, setExtractedItems] = useState<PriceItem[] | null>(null);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('materials');

  // Estimate builder state
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});

  // Financial controls
  const [marginPercent, setMarginPercent] = useState(() => {
    if (typeof window === 'undefined') return 20;
    const saved = localStorage.getItem('roofscope_margin');
    return saved ? parseFloat(saved) : 20;
  });
  const [officeCostPercent, setOfficeCostPercent] = useState(() => {
    if (typeof window === 'undefined') return 5;
    const saved = localStorage.getItem('roofscope_office_percent');
    return saved ? parseFloat(saved) : 5;
  });
  const [wastePercent, setWastePercent] = useState(() => {
    if (typeof window === 'undefined') return 10;
    const saved = localStorage.getItem('roofscope_waste');
    return saved ? parseFloat(saved) : 10;
  });
  const [showFinancials, setShowFinancials] = useState(false);

  // Save financial settings
  useEffect(() => {
    localStorage.setItem('roofscope_margin', marginPercent.toString());
  }, [marginPercent]);

  useEffect(() => {
    localStorage.setItem('roofscope_office_percent', officeCostPercent.toString());
  }, [officeCostPercent]);

  useEffect(() => {
    localStorage.setItem('roofscope_waste', wastePercent.toString());
  }, [wastePercent]);

  // Save price items whenever they change
  useEffect(() => {
    localStorage.setItem('roofscope_price_items_v2', JSON.stringify(priceItems));
  }, [priceItems]);

  // Global paste handler
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const itemsArray = Array.from(items);
      for (const item of itemsArray) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) return;

          if (showPrices) {
            extractPricesFromImage(file);
          } else if (step === 'upload') {
            extractFromImage(file);
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [showPrices, step]);

  // Extract prices from screenshot using Claude vision
  const extractPricesFromImage = async (file) => {
    setPriceSheetProcessing(true);

    try {
      const base64 = await fileToBase64(file);

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: file.type || 'image/png', data: base64 }
              },
              {
                type: 'text',
                text: `Extract ALL pricing items from this roofing price sheet. For each item, determine:
1. The item name exactly as shown
2. The unit type (sq, bundle, roll, lf, each, pail, box, tube, sheet, or flat)
3. The price
4. Coverage if applicable (e.g., "14.3 sq ft per bundle", "200 sq ft per roll", "10 linear feet")
5. Category: "materials" (tiles, shingles, underlayment, flashing, valleys, etc.), "labor" (crew names, installation labor), "equipment" (rolloff, porto potty, fuel, delivery), or "accessories" (boots, vents, snow guards, sealants, nails, caps)

Return ONLY a JSON array like this:
[
  {"name": "Brava Field Tile", "unit": "bundle", "price": 43.25, "coverage": 14.3, "coverageUnit": "sqft", "category": "materials"},
  {"name": "Hugo (standard)", "unit": "sq", "price": 550, "coverage": null, "coverageUnit": null, "category": "labor"},
  {"name": "Rolloff", "unit": "sq", "price": 48, "coverage": null, "coverageUnit": null, "category": "equipment"},
  {"name": "4\" Boot Galv", "unit": "each", "price": 20, "coverage": null, "coverageUnit": null, "category": "accessories"}
]

Extract EVERY line item you can see. Return only the JSON array, no other text.`
              }
            ]
          }]
        })
      });

      const data = await response.json();
      const text = data.content?.[0]?.text || '';

      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const extracted = JSON.parse(jsonMatch[0]);
        setExtractedItems(extracted);
      } else {
        alert('Could not extract prices. Please try a clearer screenshot.');
      }
    } catch (error) {
      console.error('Price extraction error:', error);
      alert('Error processing image. Please try again.');
    }

    setPriceSheetProcessing(false);
  };

  // Extract roof measurements from image
  const extractFromImage = async (file) => {
    setIsProcessing(true);

    try {
      const base64 = await fileToBase64(file);

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: file.type || 'image/png', data: base64 }
              },
              {
                type: 'text',
                text: `Extract roof measurements from this RoofScope, EagleView, or similar roof report. Return ONLY a JSON object:

{
  "total_squares": <number>,
  "predominant_pitch": "<string like 6/12>",
  "ridge_length": <number in feet>,
  "hip_length": <number in feet>,
  "valley_length": <number in feet>,
  "eave_length": <number in feet>,
  "rake_length": <number in feet>,
  "penetrations": <count of vents/pipes>,
  "skylights": <count>,
  "chimneys": <count>,
  "complexity": "<Simple|Moderate|Complex>"
}

Use 0 for any values not visible. Return only JSON.`
              }
            ]
          }]
        })
      });

      const data = await response.json();
      const text = data.content?.[0]?.text || '';

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const extracted = JSON.parse(jsonMatch[0]);
        setMeasurements({ ...extracted, fileName: file.name || 'Pasted image' });
        initializeEstimateItems(extracted);
        setStep('extracted');
      } else {
        throw new Error('Could not parse measurements');
      }
    } catch (error) {
      console.error('Extraction error:', error);
      alert('Error extracting measurements. Please try a clearer image.');
    }

    setIsProcessing(false);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          resolve(result.split(',')[1]);
        } else {
          throw new Error('Failed to convert file to base64 string');
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Initialize estimate with smart defaults based on measurements
  const initializeEstimateItems = (m: Measurements) => {
    const quantities = {};
    
    priceItems.forEach(item => {
      const unitType = UNIT_TYPES.find(u => u.value === item.unit);
      if (!unitType) return;

      let qty = 0;
      
      if (unitType.calcType === 'area') {
        if (item.coverage && item.coverageUnit === 'sqft') {
          // Convert squares to sq ft, then divide by coverage
          qty = Math.ceil((m.total_squares * 100) / item.coverage);
        } else if (item.coverage && item.coverageUnit === 'sq') {
          qty = Math.ceil(m.total_squares / item.coverage);
        } else {
          qty = m.total_squares;
        }
      } else if (unitType.calcType === 'linear') {
        // Smart mapping based on item name
        const name = item.name.toLowerCase();
        if (name.includes('ridge') || name.includes('h&r') || name.includes('hip')) {
          qty = Math.ceil((m.ridge_length + m.hip_length) / (item.coverage || 1));
        } else if (name.includes('valley')) {
          qty = Math.ceil(m.valley_length / (item.coverage || 10));
        } else if (name.includes('eave') || name.includes('drip') || name.includes('starter')) {
          qty = Math.ceil(m.eave_length / (item.coverage || 10));
        } else if (name.includes('rake')) {
          qty = Math.ceil(m.rake_length / (item.coverage || 10));
        }
      } else if (unitType.calcType === 'count') {
        const name = item.name.toLowerCase();
        if (name.includes('boot') || name.includes('pipe') || name.includes('flash') || name.includes('vent')) {
          qty = m.penetrations || 0;
        } else if (name.includes('skylight') || name.includes('velux')) {
          qty = m.skylights || 0;
        }
      }

      quantities[item.id] = qty;
    });

    setItemQuantities(quantities);
    // Auto-select items that have quantities
    setSelectedItems(priceItems.filter(item => quantities[item.id] > 0).map(item => item.id));
  };

  // Apply extracted prices to price list
  const applyExtractedPrices = () => {
    if (!extractedItems) return;

    const newItems = extractedItems.map((item, idx) => ({
      id: `item_${Date.now()}_${idx}`,
      name: item.name,
      unit: item.unit || 'each',
      price: item.price || 0,
      coverage: item.coverage,
      coverageUnit: item.coverageUnit,
      category: item.category || 'materials',
    }));

    setPriceItems(prev => [...prev, ...newItems]);
    setExtractedItems(null);
  };

  // Price item management
  const addPriceItem = () => {
    const newItem: PriceItem = {
      id: `item_${Date.now()}`,
      name: 'New Item',
      unit: 'each',
      price: 0,
      coverage: null,
      coverageUnit: null,
      category: activeCategory as PriceItem['category'],
    };
    setPriceItems(prev => [...prev, newItem]);
    setEditingItem(newItem.id);
  };

  const updatePriceItem = (id: string, updates: Partial<PriceItem>) => {
    setPriceItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  const deletePriceItem = (id: string) => {
    setPriceItems(prev => prev.filter(item => item.id !== id));
    setSelectedItems(prev => prev.filter(itemId => itemId !== id));
  };

  // File handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) extractFromImage(file);
  };

  const handlePriceSheetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) extractPricesFromImage(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) extractFromImage(file);
  };

  // Calculate estimate
  const calculateEstimate = () => {
    if (!measurements) return;
    
    const wasteFactor = 1 + (wastePercent / 100);
    
    const lineItems: LineItem[] = selectedItems.map(id => {
      const item = priceItems.find(p => p.id === id);
      if (!item) return null;
      
      const baseQty = itemQuantities[id] || 0;
      // Apply waste factor only to materials
      const qty = item.category === 'materials' ? Math.ceil(baseQty * wasteFactor) : baseQty;
      const baseTotal = baseQty * item.price;
      const total = qty * item.price;
      
      return {
        ...item,
        baseQuantity: baseQty,
        quantity: qty,
        total,
        wasteAdded: item.category === 'materials' ? qty - baseQty : 0,
      };
    }).filter((item): item is LineItem => item !== null);

    const byCategory: Estimate['byCategory'] = Object.keys(CATEGORIES).reduce((acc, cat) => {
      acc[cat as keyof typeof CATEGORIES] = lineItems.filter(item => item.category === cat);
      return acc;
    }, {
      materials: [],
      labor: [],
      equipment: [],
      accessories: [],
    });

    const totals: Estimate['totals'] = Object.entries(byCategory).reduce((acc, [cat, items]) => {
      acc[cat as keyof Estimate['totals']] = items.reduce((sum, item) => sum + item.total, 0);
      return acc;
    }, {
      materials: 0,
      labor: 0,
      equipment: 0,
      accessories: 0,
    });

    // Calculate costs and profit
    const baseCost = Object.values(totals).reduce((sum, t) => sum + t, 0);
    const officeAllocation = baseCost * (officeCostPercent / 100);
    const totalCost = baseCost + officeAllocation;
    
    // Margin is applied on top of cost: sellPrice = cost / (1 - margin%)
    const sellPrice = totalCost / (1 - (marginPercent / 100));
    const grossProfit = sellPrice - totalCost;
    const profitMargin = sellPrice > 0 ? (grossProfit / sellPrice) * 100 : 0;

    setEstimate({
      lineItems,
      byCategory,
      totals,
      baseCost,
      officeCostPercent,
      officeAllocation,
      totalCost,
      marginPercent,
      wastePercent,
      sellPrice,
      grossProfit,
      profitMargin,
      measurements,
      customerInfo,
      generatedAt: new Date().toLocaleString(),
    });
    setStep('estimate');
  };

  const resetEstimator = () => {
    setMeasurements(null);
    setEstimate(null);
    setSelectedItems([]);
    setItemQuantities({});
    setStep('upload');
    setCustomerInfo({ name: '', address: '', phone: '' });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const getCategoryItems = (category) => priceItems.filter(item => item.category === category);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Calculator className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-gray-900 text-sm md:text-base">Roof Estimator Pro</h1>
                <p className="text-xs text-gray-500 hidden sm:block">Paste RoofScope → Get Estimate</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPrices(!showPrices)}
                className="flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm"
              >
                <DollarSign className="w-4 h-4" />
                <span className="hidden sm:inline">My Price List</span>
                <span className="sm:hidden">Prices</span>
                ({priceItems.length})
                {showPrices ? <ChevronUp className="w-4 h-4 hidden sm:inline" /> : <ChevronDown className="w-4 h-4 hidden sm:inline" />}
              </button>
              <button
                onClick={() => setShowFinancials(!showFinancials)}
                className={`flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-lg transition-colors text-sm ${showFinancials ? 'bg-green-100 text-green-700' : 'bg-gray-100 hover:bg-gray-200'}`}
              >
                <Calculator className="w-4 h-4" />
                <span className="hidden sm:inline">Margin & Profit</span>
                <span className="sm:hidden">Margin</span>
              </button>
            </div>
          </div>
        </div>

        {/* Financial Controls */}
        {showFinancials && (
          <div className="border-t border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-3 md:py-4">
            <div className="max-w-5xl mx-auto">
              <div className="flex flex-wrap items-center gap-4 md:gap-8">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Waste</label>
                  <div className="flex items-center bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <input
                      type="number"
                      value={wastePercent}
                      onChange={(e) => setWastePercent(parseFloat(e.target.value) || 0)}
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
                      value={officeCostPercent}
                      onChange={(e) => setOfficeCostPercent(parseFloat(e.target.value) || 0)}
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
                      value={marginPercent}
                      onChange={(e) => setMarginPercent(parseFloat(e.target.value) || 0)}
                      className="w-14 md:w-16 px-2 py-1.5 md:py-2 text-center font-semibold outline-none"
                      min="0"
                      max="80"
                    />
                    <span className="px-2 text-gray-400 bg-gray-50 text-sm">%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Extracted Items Modal */}
      {extractedItems && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-4 md:p-6 max-h-[85vh] overflow-auto">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              <Check className="w-5 h-5 text-green-600" />
              Found {extractedItems.length} Items!
            </h3>
            <p className="text-sm text-gray-500 mb-4">Review and add to your price list</p>

            <div className="space-y-2 mb-6 max-h-64 md:max-h-96 overflow-auto">
              {extractedItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm block truncate">{item.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      item.category === 'materials' ? 'bg-blue-100 text-blue-700' :
                      item.category === 'labor' ? 'bg-green-100 text-green-700' :
                      item.category === 'equipment' ? 'bg-orange-100 text-orange-700' :
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
                onClick={() => setExtractedItems(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={applyExtractedPrices}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm"
              >
                Add All to Price List
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Price List Panel */}
      {showPrices && (
        <div className="border-b border-gray-200 bg-white">
          <div className="max-w-5xl mx-auto px-4 py-4 md:py-6">
            {/* Category Tabs - Scrollable on mobile */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
              {Object.entries(CATEGORIES).map(([key, { label, icon: Icon, color }]) => (
                <button
                  key={key}
                  onClick={() => setActiveCategory(key)}
                  className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-lg font-medium transition-colors whitespace-nowrap text-sm ${
                    activeCategory === key
                      ? `bg-${color}-100 text-${color}-700 border-2 border-${color}-300`
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={activeCategory === key ? {
                    backgroundColor: color === 'blue' ? '#dbeafe' : color === 'green' ? '#dcfce7' : color === 'orange' ? '#ffedd5' : '#f3e8ff',
                    color: color === 'blue' ? '#1d4ed8' : color === 'green' ? '#15803d' : color === 'orange' ? '#c2410c' : '#7e22ce',
                  } : {}}
                >
                  <Icon className="w-4 h-4" />
                  {label} ({getCategoryItems(key).length})
                </button>
              ))}
            </div>

            {/* Items List */}
            <div className="bg-gray-50 rounded-xl p-3 md:p-4 max-h-64 overflow-auto">
              {getCategoryItems(activeCategory).length === 0 ? (
                <p className="text-center text-gray-400 py-8 text-sm">No items yet. Paste a price sheet or add manually.</p>
              ) : (
                <div className="space-y-2">
                  {getCategoryItems(activeCategory).map(item => (
                    <div key={item.id} className="flex items-center gap-2 md:gap-3 bg-white rounded-lg p-2 md:p-3 border border-gray-200">
                      {editingItem === item.id ? (
                        <>
                          {/* Desktop edit layout */}
                          <div className="hidden md:flex flex-1 items-center gap-2">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => updatePriceItem(item.id, { name: e.target.value })}
                              className="flex-1 px-2 py-1 border rounded"
                              autoFocus
                            />
                            <select
                              value={item.unit}
                              onChange={(e) => updatePriceItem(item.id, { unit: e.target.value })}
                              className="px-2 py-1 border rounded"
                            >
                              {UNIT_TYPES.map(u => (
                                <option key={u.value} value={u.value}>{u.label}</option>
                              ))}
                            </select>
                            <div className="flex items-center gap-1">
                              <span>$</span>
                              <input
                                type="number"
                                value={item.price}
                                onChange={(e) => updatePriceItem(item.id, { price: parseFloat(e.target.value) || 0 })}
                                className="w-24 px-2 py-1 border rounded"
                              />
                            </div>
                            <button
                              onClick={() => setEditingItem(null)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          </div>
                          {/* Mobile edit layout */}
                          <div className="md:hidden flex-1 flex flex-col gap-2">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => updatePriceItem(item.id, { name: e.target.value })}
                              className="flex-1 px-2 py-1 border rounded text-sm"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <select
                                value={item.unit}
                                onChange={(e) => updatePriceItem(item.id, { unit: e.target.value })}
                                className="px-2 py-1 border rounded text-sm"
                              >
                                {UNIT_TYPES.map(u => (
                                  <option key={u.value} value={u.value}>{u.label}</option>
                                ))}
                              </select>
                              <div className="flex items-center gap-1">
                                <span className="text-sm">$</span>
                                <input
                                  type="number"
                                  value={item.price}
                                  onChange={(e) => updatePriceItem(item.id, { price: parseFloat(e.target.value) || 0 })}
                                  className="w-20 px-2 py-1 border rounded text-sm"
                                />
                              </div>
                              <button
                                onClick={() => setEditingItem(null)}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 font-medium text-sm md:text-base truncate">{item.name}</span>
                          <span className="text-gray-400 text-sm hidden md:inline">{item.unit}</span>
                          <span className="font-semibold text-sm md:text-base">{formatCurrency(item.price)}</span>
                          <button
                            onClick={() => setEditingItem(item.id)}
                            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deletePriceItem(item.id)}
                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4">
              <button
                onClick={addPriceItem}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
              
              <input
                type="file"
                accept="image/*"
                onChange={handlePriceSheetUpload}
                className="hidden"
                id="price-sheet-upload"
              />
              <label
                htmlFor="price-sheet-upload"
                className={`flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium cursor-pointer text-sm ${priceSheetProcessing ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {priceSheetProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Paste or Upload Price Sheet
                  </>
                )}
              </label>

              {priceItems.length > 0 && (
                <button
                  onClick={() => { setPriceItems([]); localStorage.removeItem('roofscope_price_items_v2'); }}
                  className="sm:ml-auto text-sm text-red-500 hover:text-red-700 py-2"
                >
                  Clear All
                </button>
              )}
            </div>

            <p className="text-xs text-gray-400 mt-3 hidden sm:block">
              💡 Tip: Copy your price sheet and press <kbd className="px-1.5 py-0.5 bg-gray-200 rounded">Ctrl+V</kbd> to auto-extract
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 py-6 md:py-8">
        {/* Upload Step */}
        {step === 'upload' && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => document.getElementById('file-upload').click()}
            className="border-2 border-dashed border-gray-300 rounded-2xl p-8 md:p-12 text-center bg-white hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
          >
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <div className="w-14 h-14 md:w-16 md:h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Upload className="w-7 h-7 md:w-8 md:h-8 text-blue-600" />
            </div>
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-2">
              Paste your RoofScope screenshot
            </h2>
            <p className="text-gray-500 mb-4 text-sm md:text-base">
              <kbd className="px-2 py-1 bg-gray-100 rounded text-xs md:text-sm font-mono">Ctrl+V</kbd> to paste, or tap to upload
            </p>
            <p className="text-xs md:text-sm text-gray-400">
              Works with RoofScope, EagleView, GAF QuickMeasure
            </p>
          </div>
        )}

        {/* Processing */}
        {isProcessing && (
          <div className="bg-white rounded-2xl p-12 text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Reading Measurements...</h2>
            <p className="text-gray-500">Extracting roof data from your image</p>
          </div>
        )}

        {/* Review & Build Estimate */}
        {step === 'extracted' && measurements && (
          <div className="space-y-4 md:space-y-6">
            {/* Measurements Summary */}
            <div className="bg-white rounded-2xl p-4 md:p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Roof Measurements</h2>
                <button onClick={resetEstimator} className="text-xs md:text-sm text-gray-500 hover:text-gray-700">
                  Upload Different
                </button>
              </div>

              {/* Customer Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6 p-3 md:p-4 bg-gray-50 rounded-xl">
                <input
                  type="text"
                  value={customerInfo.name}
                  onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Customer Name"
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <input
                  type="text"
                  value={customerInfo.address}
                  onChange={(e) => setCustomerInfo(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Address"
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <input
                  type="text"
                  value={customerInfo.phone}
                  onChange={(e) => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="Phone"
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>

              {/* Measurements Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                {[
                  { key: 'total_squares', label: 'Squares', unit: 'sq' },
                  { key: 'predominant_pitch', label: 'Pitch', unit: '' },
                  { key: 'ridge_length', label: 'Ridge', unit: 'ft' },
                  { key: 'hip_length', label: 'Hips', unit: 'ft' },
                  { key: 'valley_length', label: 'Valleys', unit: 'ft' },
                  { key: 'eave_length', label: 'Eaves', unit: 'ft' },
                  { key: 'rake_length', label: 'Rakes', unit: 'ft' },
                  { key: 'penetrations', label: 'Penetrations', unit: '' },
                ].map(({ key, label, unit }) => (
                  <div key={key} className="bg-gray-50 rounded-lg p-2 md:p-3">
                    <div className="text-xs text-gray-500">{label}</div>
                    <div className="text-lg md:text-xl font-bold">
                      {measurements[key]} <span className="text-xs md:text-sm font-normal text-gray-400">{unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Line Item Builder */}
            <div className="bg-white rounded-2xl p-4 md:p-6 border border-gray-200">
              <h2 className="font-semibold text-gray-900 mb-4">Build Your Estimate</h2>

              {priceItems.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p className="mb-2 text-sm">No price items yet.</p>
                  <button
                    onClick={() => setShowPrices(true)}
                    className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                  >
                    Add your prices first →
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(CATEGORIES).map(([catKey, { label, icon: Icon }]) => {
                    const items = getCategoryItems(catKey);
                    if (items.length === 0) return null;

                    return (
                      <div key={catKey}>
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          {label}
                        </h3>
                        <div className="space-y-2">
                          {items.map(item => {
                            const isSelected = selectedItems.includes(item.id);
                            const qty = itemQuantities[item.id] || 0;

                            return (
                              <div
                                key={item.id}
                                className={`p-3 rounded-lg border-2 transition-colors ${
                                  isSelected ? 'border-blue-300 bg-blue-50' : 'border-gray-100 bg-gray-50'
                                }`}
                              >
                                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedItems(prev => [...prev, item.id]);
                                      } else {
                                        setSelectedItems(prev => prev.filter(id => id !== item.id));
                                      }
                                    }}
                                    className="w-5 h-5 rounded flex-shrink-0"
                                  />
                                  <span className="font-medium flex-1 min-w-[120px]">{item.name}</span>
                                  <input
                                    type="number"
                                    value={qty}
                                    onChange={(e) => setItemQuantities(prev => ({ ...prev, [item.id]: parseFloat(e.target.value) || 0 }))}
                                    className="w-20 px-2 py-1 border border-gray-200 rounded text-center"
                                  />
                                  <span className="text-gray-400 text-sm w-14">{item.unit}</span>
                                  <span className="text-gray-400">×</span>
                                  <span className="w-24 text-right">{formatCurrency(item.price)}</span>
                                  <span className="text-gray-400">=</span>
                                  <span className="w-28 text-right font-semibold text-blue-600">
                                    {formatCurrency(qty * item.price)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Generate Button */}
            {priceItems.length > 0 && (
              <button
                onClick={calculateEstimate}
                disabled={selectedItems.length === 0}
                className="w-full py-3 md:py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Calculator className="w-5 h-5" />
                Generate Estimate ({selectedItems.length} items)
              </button>
            )}
          </div>
        )}

        {/* Final Estimate */}
        {step === 'estimate' && estimate && (
          <div className="space-y-4 md:space-y-6">
            {/* Profit Summary Card */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-4 md:p-6 text-white">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                <div>
                  <p className="text-green-100 text-xs md:text-sm">Total Cost</p>
                  <p className="text-lg md:text-2xl font-bold">{formatCurrency(estimate.totalCost)}</p>
                </div>
                <div>
                  <p className="text-green-100 text-xs md:text-sm">Sell Price</p>
                  <p className="text-lg md:text-2xl font-bold">{formatCurrency(estimate.sellPrice)}</p>
                </div>
                <div>
                  <p className="text-green-100 text-xs md:text-sm">Net Profit</p>
                  <p className="text-lg md:text-2xl font-bold">{formatCurrency(estimate.grossProfit)}</p>
                </div>
                <div>
                  <p className="text-green-100 text-xs md:text-sm">Profit Margin</p>
                  <p className="text-lg md:text-2xl font-bold">{estimate.profitMargin.toFixed(1)}%</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 md:p-6 border border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900">Roofing Estimate</h2>
                  <p className="text-gray-500 text-sm">
                    {estimate.customerInfo.name || 'Customer'} • {estimate.customerInfo.address || 'Address'}
                  </p>
                  <p className="text-xs md:text-sm text-gray-400">{estimate.generatedAt}</p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-xs md:text-sm text-gray-500">Quote to Customer</p>
                  <p className="text-2xl md:text-4xl font-bold text-gray-900">{formatCurrency(estimate.sellPrice)}</p>
                </div>
              </div>

              {/* Line Items by Category */}
              {Object.entries(CATEGORIES).map(([catKey, { label }]) => {
                const items = estimate.byCategory[catKey];
                if (!items || items.length === 0) return null;

                return (
                  <div key={catKey} className="mb-4 md:mb-6">
                    <h3 className="text-xs md:text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 md:mb-3">{label}</h3>
                    <div className="space-y-2">
                      {items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-sm block truncate">{item.name}</span>
                            <span className="text-gray-400 text-xs">
                              {item.quantity} {item.unit} × {formatCurrency(item.price)}
                              {item.wasteAdded > 0 && (
                                <span className="text-orange-500 ml-1">(+{item.wasteAdded} waste)</span>
                              )}
                            </span>
                          </div>
                          <span className="font-semibold text-sm ml-2">{formatCurrency(item.total)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between mt-2 pt-2 border-t border-gray-200 text-sm">
                      <span className="text-gray-600">{label} Subtotal</span>
                      <span className="font-bold">{formatCurrency(estimate.totals[catKey])}</span>
                    </div>
                  </div>
                );
              })}

              {/* Financial Summary */}
              <div className="border-t-2 border-gray-200 pt-4 mt-4 md:mt-6 space-y-2 md:space-y-3 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Base Cost ({estimate.wastePercent}% waste)</span>
                  <span>{formatCurrency(estimate.baseCost)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Office ({estimate.officeCostPercent}%)</span>
                  <span>+{formatCurrency(estimate.officeAllocation)}</span>
                </div>
                <div className="flex justify-between font-medium border-t border-gray-200 pt-2 md:pt-3">
                  <span>Total Cost</span>
                  <span>{formatCurrency(estimate.totalCost)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Margin ({estimate.marginPercent}%)</span>
                  <span>+{formatCurrency(estimate.grossProfit)}</span>
                </div>
                <div className="flex justify-between items-center border-t-2 border-gray-900 pt-3 md:pt-4">
                  <div>
                    <p className="text-lg md:text-xl font-bold">Customer Price</p>
                    <p className="text-xs md:text-sm text-gray-500">
                      {estimate.measurements.total_squares} sq • {estimate.measurements.predominant_pitch}
                    </p>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold">{formatCurrency(estimate.sellPrice)}</p>
                </div>
              </div>

              {/* Profit Breakdown (Internal Only) */}
              <div className="mt-4 md:mt-6 p-3 md:p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-2 text-amber-800 mb-2">
                  <AlertCircle className="w-4 h-4" />
                  <span className="font-semibold text-xs md:text-sm">Internal Only</span>
                </div>
                <div className="grid grid-cols-3 gap-2 md:gap-4 text-xs md:text-sm">
                  <div>
                    <span className="text-amber-700 block">Cost</span>
                    <span className="font-bold text-amber-900">{formatCurrency(estimate.totalCost)}</span>
                  </div>
                  <div>
                    <span className="text-amber-700 block">Profit</span>
                    <span className="font-bold text-green-700">{formatCurrency(estimate.grossProfit)}</span>
                  </div>
                  <div>
                    <span className="text-amber-700 block">Margin</span>
                    <span className="font-bold text-green-700">{estimate.profitMargin.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
              <button
                onClick={() => setStep('extracted')}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm md:text-base"
              >
                Edit Estimate
              </button>
              <button
                onClick={resetEstimator}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 text-sm md:text-base"
              >
                <Upload className="w-5 h-5" />
                New Estimate
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
