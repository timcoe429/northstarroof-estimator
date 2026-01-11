'use client'

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Upload, DollarSign, Calculator, Settings, ChevronDown, ChevronUp, AlertCircle, Check, X, Edit2, Plus, Trash2, Package, Users, Truck, Wrench, FileText, Copy, Bot } from 'lucide-react';
import Image from 'next/image';
import type { Measurements, PriceItem, LineItem, CustomerInfo, Estimate, SavedQuote } from '@/types';
import { saveQuote, loadQuotes, loadQuote, deleteQuote } from '@/lib/supabase';
import { generateProposalPDF } from '@/lib/generateProposal';
import { useAuth } from '@/lib/AuthContext';

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

// Professional description mapping for price items
const descriptionMap: Record<string, string> = {
  // BRAVA SYSTEM
  "Brava Field Tile": "Brava composite slate field tiles - durable, lightweight synthetic roofing with Class A fire rating and 50-year limited warranty.",
  "Brava Starter": "Brava starter course tiles for proper alignment along eaves and rakes.",
  "Brava H&R": "Brava hip and ridge cap tiles for weather-tight roof peaks and hips.",
  "Brava H&R High Slope": "Brava hip and ridge caps engineered for steep slope applications (8/12 pitch and above).",
  "Brava Solids": "Brava solid tiles for valley cuts, edges, and detail work.",
  "Brava Delivery": "Freight and delivery of Brava roofing materials to project site.",
  
  // DAVINCI SYSTEM
  "DaVinci Multi-Width Shake": "DaVinci Multi-Width Shake synthetic cedar roofing - realistic wood appearance with composite durability and Class A fire rating.",
  "DaVinci Starter": "DaVinci starter course for proper alignment along eaves and rakes.",
  "DaVinci H&R Hinged": "DaVinci hinged hip and ridge caps for steep slope applications (8/12 pitch and above).",
  
  // COPPER FLASHINGS
  "Copper D-Style Eave": "16oz copper D-style drip edge for eave protection - develops natural patina over time.",
  "Copper D-Style Rake": "16oz copper D-style drip edge for rake edges - develops natural patina over time.",
  "Copper Valley": "16oz copper valley flashing, 10' x 24\" - superior water channeling and lifetime durability.",
  "Copper Step Flash": "16oz copper step flashing pieces for sidewall-to-roof transitions.",
  "Copper Pitch Change": "16oz copper transition flashing for pitch change details.",
  "Copper Headwall": "16oz copper headwall flashing for wall-to-roof transitions.",
  "Copper Flat Sheet": "16oz copper sheet for custom flashing fabrication on-site.",
  
  // STANDARD FLASHINGS
  "D-Style Eave": "Painted aluminum D-style drip edge for eave protection, color-matched to roofing.",
  "D-Style Rake": "Painted aluminum D-style drip edge for rake edges, color-matched to roofing.",
  "Valley": "Painted aluminum valley flashing, 10' x 24\" sections.",
  "Step Flash": "Aluminum step flashing for sidewall-to-roof transitions.",
  "Headwall or Pitch Change": "Aluminum flashing for headwall and pitch change transitions.",
  "Flat Sheet": "Aluminum sheet for custom flashing fabrication.",
  "Hip & Ridge": "Painted metal hip and ridge cap trim.",
  
  // UNDERLAYMENTS
  "OC Titanium PSU 30": "Owens Corning Titanium PSU 30 synthetic underlayment - superior tear resistance and traction.",
  "SolarHide Radiant Barrier": "SolarHide reflective radiant barrier underlayment for enhanced energy efficiency.",
  "Sharkskin": "Sharkskin Ultra SA self-adhering synthetic underlayment - premium waterproofing protection.",
  "GAF VersaShield": "GAF VersaShield Class A fire-rated roof underlayment.",
  "Grace Ice & Water High Temp": "Grace Ice & Water HT self-adhering membrane for high-temperature applications and critical areas.",
  "Low Slope Base Sheet": "Modified bitumen base sheet for low slope roof assemblies.",
  "Low Slope Cap": "Modified bitumen cap sheet for low slope roof assemblies - granulated surface.",
  
  // FASTENERS
  "1.75\" SS RS Coil Nail": "1.75\" stainless steel ring shank coil nails - corrosion resistant for coastal or high-moisture environments.",
  "1.75\" Coil Nails RS HDG": "1.75\" hot-dip galvanized ring shank coil nails for standard applications.",
  "3\" Coil Screws (H&R)": "3\" coil screws for secure hip and ridge cap attachment.",
  "1.25\" Plasticap Pail": "1.25\" plastic cap nails for underlayment installation.",
  "2.5\" Hand Nail": "2.5\" hand-drive nails for detail and repair work.",
  "7/8\" Gun Nail": "7/8\" pneumatic nails for roof sheathing installation.",
  
  // VENTILATION
  "Rolled Ridge Vent": "Rolled ridge vent system for continuous attic ventilation along roof peak.",
  "Airhawk RVG 50": "Airhawk RVG 50 slant-back roof vent - 50 sq in net free area.",
  "Small Broan 636": "Broan 636 roof cap for 3\" or 4\" round duct exhaust.",
  "Large Broan 634": "Broan 634 roof cap for 6\" round duct exhaust.",
  
  // PENETRATION FLASHINGS
  "4in1 Pipe Jack": "4-in-1 adjustable pipe boot - fits 1.5\" to 3\" pipes with flexible EPDM collar.",
  "4\" Boot Galv": "4\" galvanized pipe boot flashing with EPDM seal.",
  "Split Boot": "Split-design pipe boot for repairs around existing penetrations without disconnection.",
  
  // SEALANTS
  "Auto Caulk 4 in 1": "OSI Quad caulk - all-weather sealant for flashing and trim.",
  "Lucas Clear Sealant": "Lucas #5500 clear waterproof sealant.",
  "NP-1 Sealant": "Sonneborn NP-1 polyurethane sealant - paintable, permanent flexibility.",
  "Matching Spray Paint": "Color-matched touch-up paint for flashings and metal trim.",
  
  // SHEATHING
  "7/16\" OSB": "7/16\" OSB roof sheathing - replace damaged or rotted decking as needed.",
  "2X4 Toe Boards": "2x4 lumber for OSHA-compliant safety toe boards at roof edges.",
  
  // ACCESSORIES
  "RMSG Yeti Snowguard": "Rocky Mountain Snow Guard Yeti series - powder-coated snow retention for controlled snow release.",
  "Plastic Caps": "Plastic button caps for securing underlayment.",
  
  // SKYLIGHTS
  "Velux FCM4646 Laminated LowE3": "Velux FCM 46x46 fixed curb-mount skylight with laminated LowE3 glass.",
  "Velux Flash Kit ECL4646": "Velux ECL flashing kit - integrated weatherproofing system for skylight installation.",
  
  // LABOR
  "Hugo (12/12 pitch)": "Complete roof installation labor for steep pitch roofing (12/12) - includes tear-off, deck prep, underlayment, and finish roofing.",
  "Hugo (lower pitch)": "Complete roof installation labor for lower pitch roofing - includes tear-off, deck prep, underlayment, and finish roofing.",
  "Hugo (standard)": "Complete roof installation labor for standard pitch roofing - includes tear-off, deck prep, underlayment, and finish roofing.",
  "Alfredo": "Complete roof installation labor - includes tear-off, deck prep, underlayment, and finish roofing.",
  "Chris": "Complete roof installation labor - includes tear-off, deck prep, underlayment, and finish roofing.",
  "Sergio": "Complete roof installation labor - includes tear-off, deck prep, underlayment, and finish roofing.",
  "Snowguard Install": "Installation labor for snow retention system per manufacturer specifications.",
  "Snowfence Install": "Installation labor for snow fence system, per linear foot.",
  
  // EQUIPMENT & FEES
  "Rolloff": "30-yard roll-off dumpster for roofing debris removal and disposal.",
  "Porto Potty": "Portable restroom rental for duration of project.",
  "Fuel Charge": "Fuel surcharge for material delivery to project site.",
  "Aspen Reprographic": "Permit application drawings and documentation services.",
};

export default function RoofScopeEstimator() {
  const { user, signOut } = useAuth();
  
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
  const [viewMode, setViewMode] = useState<'internal' | 'client'>('internal');

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
  const [sundriesPercent, setSundriesPercent] = useState(() => {
    if (typeof window === 'undefined') return 10;
    const saved = localStorage.getItem('roofscope_sundries');
    return saved ? parseFloat(saved) : 10;
  });
  const [showFinancials, setShowFinancials] = useState(false);

  // Track uploaded image types
  const [uploadedImages, setUploadedImages] = useState<Set<string>>(new Set());

  // Saved quotes state
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([]);
  const [showSavedQuotes, setShowSavedQuotes] = useState(false);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
  const [isSavingQuote, setIsSavingQuote] = useState(false);

  // Job description and smart selection state
  const [jobDescription, setJobDescription] = useState('');
  const [smartSelectionReasoning, setSmartSelectionReasoning] = useState('');
  const [smartSelectionWarnings, setSmartSelectionWarnings] = useState<string[]>([]);
  const [isGeneratingSelection, setIsGeneratingSelection] = useState(false);

  // Bulk description generation state
  const [isGeneratingDescriptions, setIsGeneratingDescriptions] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number } | null>(null);

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

  useEffect(() => {
    localStorage.setItem('roofscope_sundries', sundriesPercent.toString());
  }, [sundriesPercent]);

  // Calculate quantities for ALL items based on measurements
  const calculateItemQuantities = useCallback((m: Measurements) => {
    const quantities: Record<string, number> = {};
    
    priceItems.forEach(item => {
      const name = item.name.toLowerCase();
      let qty = 0;

      // Normalize coverage to number and coverageUnit to lowercase string
      const coverage = item.coverage ? (typeof item.coverage === 'string' ? parseFloat(item.coverage) : item.coverage) : null;
      const coverageUnit = item.coverageUnit ? item.coverageUnit.toLowerCase() : null;

      // PRIORITY 1: IF item has coverage AND coverageUnit → Calculate using coverage FIRST
      if (coverage && coverageUnit) {
        if (coverageUnit === 'lf') {
          // Linear coverage calculation
          if (name.includes('starter')) {
            // Starter uses perimeter: eave_length + rake_length
            qty = Math.ceil(((m.eave_length || 0) + (m.rake_length || 0)) / coverage);
          } else if (name.includes('valley')) {
            qty = Math.ceil((m.valley_length || 0) / coverage);
          } else if (name.includes('eave') || name.includes('drip')) {
            qty = Math.ceil((m.eave_length || 0) / coverage);
          } else if (name.includes('rake')) {
            qty = Math.ceil((m.rake_length || 0) / coverage);
          } else if (name.includes('ridge') || name.includes('h&r')) {
            // H&R covers both ridge and hip
            qty = Math.ceil(((m.ridge_length || 0) + (m.hip_length || 0)) / coverage);
          } else if (name.includes('hip')) {
            qty = Math.ceil((m.hip_length || 0) / coverage);
          } else {
            // Default linear: use eave_length
            qty = Math.ceil((m.eave_length || 0) / coverage);
          }
        } else if (coverageUnit === 'sqft') {
          // Convert squares to sq ft, then divide by coverage
          qty = Math.ceil((m.total_squares * 100) / coverage);
        } else if (coverageUnit === 'sq') {
          // Coverage in squares
          qty = Math.ceil(m.total_squares / coverage);
        }
      }
      // PRIORITY 1.5: Manual-entry items (unit "each", no coverage, not flat fee) → Default to 0
      else if (item.unit === 'each' && !coverage) {
        // Check if it's a known flat fee item
        const isFlatFeeItem = name.includes('delivery') || name.includes('fuel') || name.includes('porto') || name.includes('rolloff') || name.includes('reprographic');
        
        // If not a flat fee item, default to 0 (user must enter quantity manually)
        // This includes labor items with "each" unit that aren't per-square (like "Snowguard Install")
        if (!isFlatFeeItem) {
          qty = 0;
        } else {
          // Flat fee items: always 1
          qty = 1;
        }
      }
      // PRIORITY 2: ELSE IF special cases (only when no coverage)
      else if (name.includes('osb') || name.includes('oriented strand')) {
        // OSB sheets: total_squares × 3
        qty = m.total_squares * 3;
      } else if (name.includes('starter')) {
        // Starter: eave_length + rake_length (perimeter) - no coverage
        qty = (m.eave_length || 0) + (m.rake_length || 0);
      } else if (name.includes('delivery') || name.includes('fuel') || name.includes('porto') || name.includes('rolloff') || item.unit === 'flat') {
        // Flat fee items: always 1
        qty = 1;
      } else if (item.category === 'labor' && item.unit !== 'each') {
        // Labor items (per-square): total_squares
        // Exclude "each" unit labor items (they're handled above as manual-entry)
        qty = m.total_squares || 0;
      }
      // PRIORITY 3: ELSE fall back to unit-based calculation
      else {
        const unitType = UNIT_TYPES.find(u => u.value === item.unit);
        if (!unitType) {
          quantities[item.id] = 0;
          return;
        }

        if (unitType.calcType === 'area') {
          // Area-based items (Field Tile, Shakes, Shingles, Underlayment)
          // No coverage, use total_squares directly
          qty = m.total_squares || 0;
        } else if (unitType.calcType === 'linear') {
          // Linear-based items - no coverage, use direct measurements
          if (name.includes('valley')) {
            qty = m.valley_length || 0;
          } else if (name.includes('eave') || name.includes('drip')) {
            qty = m.eave_length || 0;
          } else if (name.includes('rake')) {
            qty = m.rake_length || 0;
          } else if (name.includes('ridge')) {
            qty = m.ridge_length || 0;
          } else if (name.includes('hip')) {
            qty = m.hip_length || 0;
          } else if (name.includes('h&r')) {
            // H&R covers both ridge and hip
            qty = (m.ridge_length || 0) + (m.hip_length || 0);
          } else {
            // Default linear: 0 if no match
            qty = 0;
          }
        } else if (unitType.calcType === 'count') {
          // Count-based items
          if (name.includes('boot') || name.includes('pipe') || name.includes('jack') || name.includes('flash') || name.includes('vent')) {
            qty = m.penetrations || 0;
          } else if (name.includes('skylight') || name.includes('velux')) {
            qty = m.skylights || 0;
          } else if (name.includes('chimney')) {
            qty = m.chimneys || 0;
          } else {
            // Default count: 0
            qty = 0;
          }
        } else if (unitType.calcType === 'flat') {
          // Flat fee items
          qty = 1;
        }
      }

      quantities[item.id] = qty;
    });

    return quantities;
  }, [priceItems]);

  // Recalculate quantities whenever measurements or priceItems change
  useEffect(() => {
    if (measurements && priceItems.length > 0) {
      const quantities = calculateItemQuantities(measurements);
      setItemQuantities(prev => {
        // Merge with existing to preserve any manual edits, but update calculated ones
        const merged = { ...prev };
        Object.keys(quantities).forEach(id => {
          // Only update if the item still exists in priceItems
          if (priceItems.find(item => item.id === id)) {
            merged[id] = quantities[id];
          }
        });
        return merged;
      });
    }
  }, [measurements, priceItems, calculateItemQuantities]);

  // Calculate markup multiplier for client view
  // Combined multiplier = (1 + officePercent/100) × (1 + marginPercent/100)
  const markupMultiplier = useMemo(() => {
    return (1 + officeCostPercent / 100) * (1 + marginPercent / 100);
  }, [officeCostPercent, marginPercent]);

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
          } else if (step === 'upload' || step === 'extracted') {
            // Allow pasting in 'extracted' step to add analysis image
            extractFromImage(file);
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [showPrices, step, measurements, uploadedImages]);

  // Extract prices from screenshot using Claude vision
  const extractPricesFromImage = async (file: File) => {
    setPriceSheetProcessing(true);

    try {
      const base64 = await fileToBase64(file);
      const dataUrl = `data:${file.type || 'image/png'};base64,${base64}`;

      const prompt = `You are extracting pricing from a roofing contractor's price sheet.

PRODUCT LINE RULES:
- Brava and DaVinci are DIFFERENT product lines (never mix them on same job)
- Brava products: Field Tile, Starter, H&R, H&R High Slope, Solids
- DaVinci products: Multi-Width Shake, Starter, H&R Hinged
- H&R High Slope / Hinged variants are for steep pitches (8/12 and above)
- Regular H&R is for standard pitches (below 8/12)

LABOR RULES:
- Crew names (Hugo, Alfredo, Chris, Sergio) are labor options
- Only ONE crew works a job - they are alternatives, not additions
- Different prices for different pitch difficulties (12/12 pitch, lower pitch, standard)

CATEGORIES:
- materials: Tiles, shingles, underlayment, flashing, valleys, ice & water
- labor: Crew names with per-square rates
- equipment: Rolloff, porto potty, fuel charges, rentals
- accessories: Boots, vents, snow guards, sealants, caulk, caps

ROOFING KNOWLEDGE:
- 1 square = 100 sq ft of roof area
- Starter is used along eaves and rakes
- H&R (Hip & Ridge) covers the hips and ridges
- High slope products are required for 8/12 pitch and above for safety/warranty
- Valleys need valley metal or ice & water shield
- Penetrations need pipe boots/flashings
- Labor is priced per square, varies by pitch difficulty

Extract each item with: name, category, unit, price, coverage information if available, and proposalDescription if available.

COVERAGE EXTRACTION:
Look for coverage information in the item description or notes:
- "10' length" or "10 ft" → coverage: 10, coverageUnit: "lf"
- "2 sq per roll" or "2 squares" → coverage: 2, coverageUnit: "sq"
- "200 sq ft per roll" or "200 sqft" → coverage: 200, coverageUnit: "sqft"
- "4 linear feet per piece" → coverage: 4, coverageUnit: "lf"
- "14.3 sq ft per bundle" → coverage: 14.3, coverageUnit: "sqft"
- If no coverage info found, use coverage: null, coverageUnit: null

PROPOSAL DESCRIPTION EXTRACTION:
- If the price sheet includes detailed descriptions or installation notes for items, extract them as proposalDescription
- Look for full sentences or detailed descriptions that explain what the item is or how it's installed
- If no description found, use proposalDescription: null

Return ONLY a JSON array like this:
[
  {"name": "Brava Field Tile", "unit": "bundle", "price": 43.25, "coverage": 14.3, "coverageUnit": "sqft", "category": "materials", "proposalDescription": null},
  {"name": "Copper D-Style Eave", "unit": "each", "price": 25.00, "coverage": 10, "coverageUnit": "lf", "category": "materials", "proposalDescription": null},
  {"name": "Hugo (standard)", "unit": "sq", "price": 550, "coverage": null, "coverageUnit": null, "category": "labor", "proposalDescription": null},
  {"name": "Rolloff", "unit": "sq", "price": 48, "coverage": null, "coverageUnit": null, "category": "equipment", "proposalDescription": null},
  {"name": "4\" Boot Galv", "unit": "each", "price": 20, "coverage": null, "coverageUnit": null, "category": "accessories", "proposalDescription": null}
]

Extract EVERY line item you can see. Return only the JSON array, no other text.`;

      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: dataUrl,
          prompt,
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to extract prices');
      }

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

  // Merge measurements intelligently
  const mergeMeasurements = (existing: Measurements, newData: Partial<Measurements>): Measurements => {
    return {
      ...existing,
      ...newData,
      // Update predominant_pitch if new data provides it
      predominant_pitch: newData.predominant_pitch !== undefined && newData.predominant_pitch !== null && newData.predominant_pitch !== ''
        ? newData.predominant_pitch
        : existing.predominant_pitch,
      // Preserve existing values unless new ones are provided (handle undefined/null)
      steep_squares: newData.steep_squares !== undefined && newData.steep_squares !== null 
        ? newData.steep_squares 
        : (existing.steep_squares ?? undefined),
      standard_squares: newData.standard_squares !== undefined && newData.standard_squares !== null 
        ? newData.standard_squares 
        : (existing.standard_squares ?? undefined),
      flat_squares: newData.flat_squares !== undefined && newData.flat_squares !== null 
        ? newData.flat_squares 
        : (existing.flat_squares ?? undefined),
    };
  };

  // Extract roof measurements from summary image (basic measurements)
  const extractSummaryImage = async (file: File) => {
    setIsProcessing(true);

    try {
      const base64 = await fileToBase64(file);
      const dataUrl = `data:${file.type || 'image/png'};base64,${base64}`;

      const prompt = `You are extracting roof measurements from a RoofScope or EagleView SUMMARY page.

This is the main summary page that shows overall measurements. Extract:

MEASUREMENTS TO EXTRACT:
- total_squares: Total roof area in squares
- predominant_pitch: Main roof pitch (e.g., '10/12')
- ridge_length: Total ridge in linear feet
- hip_length: Total hips in linear feet
- valley_length: Total valleys in linear feet
- eave_length: Total eaves in linear feet
- rake_length: Total rakes in linear feet
- penetrations: Number of pipe penetrations
- skylights: Number of skylights
- chimneys: Number of chimneys
- complexity: Simple, Moderate, or Complex

ROOFING KNOWLEDGE:
- 1 square = 100 sq ft of roof area
- Starter is used along eaves and rakes
- H&R (Hip & Ridge) covers the hips and ridges
- Valleys need valley metal or ice & water shield
- Penetrations need pipe boots/flashings
- Labor is priced per square, varies by pitch difficulty

Return ONLY a JSON object:
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

Use 0 for any values not visible. Return only JSON.`;

      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: dataUrl,
          prompt,
          max_tokens: 1500,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to extract measurements');
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || '';

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const extracted = JSON.parse(jsonMatch[0]);
        const newMeasurements = { ...extracted, fileName: file.name || 'Pasted image' };
        
        if (measurements) {
          // Merge with existing measurements
          const merged = mergeMeasurements(measurements, newMeasurements);
          setMeasurements(merged);
        } else {
          // Set initial measurements
          setMeasurements(newMeasurements);
          initializeEstimateItems(newMeasurements);
          setStep('extracted');
        }
        
        setUploadedImages(prev => new Set(Array.from(prev).concat('summary')));
      } else {
        throw new Error('Could not parse measurements');
      }
    } catch (error) {
      console.error('Extraction error:', error);
      alert('Error extracting measurements. Please try again.');
    }

    setIsProcessing(false);
  };

  // Extract slope breakdown from Roof Area Analysis image
  const extractAnalysisImage = async (file: File) => {
    setIsProcessing(true);

    try {
      const base64 = await fileToBase64(file);
      const dataUrl = `data:${file.type || 'image/png'};base64,${base64}`;

      const prompt = `You are extracting measurements from a RoofScope or EagleView ROOF AREA ANALYSIS page.

This page may show either:
1. A detailed plane table with columns: Plane | Area(sf) | Pitch | Slope | High | IWB(sf)
2. A Totals (SQ) summary table

PRIORITIZE the detailed plane table if both are visible.

EXTRACTION RULES:

1. PREDOMINANT PITCH (from detailed plane table):
   - Group all planes by their Pitch value (e.g., 4:12, 10:12, 5:12, 24:12)
   - Sum the Area(sf) for each pitch group
   - The pitch with the HIGHEST total area becomes predominant_pitch
   - Format as "X/12" (e.g., if 10:12 has most area, return "10/12")
   - If only Totals table available, extract predominant pitch from there if visible

2. SLOPE BREAKDOWN:
   - If detailed plane table is visible:
     * S = Steep (pitch 8/12 and above)
     * L = Low
     * F = Flat
     * Sum Area(sf) for all planes with Slope="S" → convert to squares (divide by 100) → steep_squares
     * Sum Area(sf) for all planes with Slope="L" or blank (but not S or F) → convert to squares → standard_squares
     * Sum Area(sf) for all planes with Slope="F" → convert to squares → flat_squares
   - If only Totals table available:
     * Sum areas marked "Steep" or "High" → steep_squares
     * Sum areas marked "Low" or "Standard" → standard_squares
     * Sum areas marked "Flat" → flat_squares

ROOFING KNOWLEDGE:
- 1 square = 100 sq ft of roof area
- High slope products are required for 8/12 pitch and above for safety/warranty
- Regular H&R is for standard pitches (below 8/12)

Return ONLY a JSON object:
{
  "predominant_pitch": "<X/12 format or null if not visible>",
  "steep_squares": <number or null>,
  "standard_squares": <number or null>,
  "flat_squares": <number or null>
}

Use null for any values not visible. Return only JSON.`;

      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: dataUrl,
          prompt,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to extract slope breakdown');
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || '';

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const extracted = JSON.parse(jsonMatch[0]);
        
        if (measurements) {
          // Merge slope breakdown with existing measurements
          const merged = mergeMeasurements(measurements, extracted);
          setMeasurements(merged);
          // Re-initialize estimate items with updated measurements
          initializeEstimateItems(merged);
        } else {
          // If no existing measurements, this shouldn't happen but handle gracefully
          alert('Please upload the RoofScope Summary first, then the Roof Area Analysis.');
          setIsProcessing(false);
          return;
        }
        
        setUploadedImages(prev => new Set(Array.from(prev).concat('analysis')));
      } else {
        throw new Error('Could not parse slope breakdown');
      }
    } catch (error) {
      console.error('Extraction error:', error);
      alert('Error extracting slope breakdown. Please try again.');
    }

    setIsProcessing(false);
  };

  // Extract roof measurements from image (routes to appropriate extractor based on context)
  const extractFromImage = async (file: File) => {
    // If measurements already exist and summary has been uploaded, assume this is an analysis image
    // Otherwise, assume it's a summary image
    if (measurements && uploadedImages.has('summary') && !uploadedImages.has('analysis')) {
      await extractAnalysisImage(file);
    } else {
      await extractSummaryImage(file);
    }
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
    // Quantities will be recalculated by useEffect
    // This function is kept for backward compatibility but doesn't need to do anything
  };

  // Copy client view estimate to clipboard
  const copyClientViewToClipboard = async () => {
    if (!estimate) return;

    let text = `ROOFING ESTIMATE\n`;
    text += `${estimate.customerInfo.name || 'Customer'}\n`;
    text += `${estimate.customerInfo.address || 'Address'}\n`;
    text += `${estimate.generatedAt}\n\n`;

    // Line items by category
    Object.entries(CATEGORIES).forEach(([catKey, { label }]) => {
      const items = estimate.byCategory[catKey];
      if (!items || items.length === 0) return;

      text += `${label.toUpperCase()}\n`;
      items.forEach(item => {
        const clientPrice = Math.round(item.total * markupMultiplier * 100) / 100;
        text += `${item.name} (${item.quantity} ${item.unit})\t${formatCurrency(clientPrice)}\n`;
      });
      const clientSubtotal = Math.round(estimate.totals[catKey] * markupMultiplier * 100) / 100;
      text += `${label} Subtotal\t${formatCurrency(clientSubtotal)}\n\n`;
    });

    // Totals
    text += `${'─'.repeat(40)}\n`;
    text += `TOTAL\t${formatCurrency(estimate.sellPrice)}\n`;

    try {
      await navigator.clipboard.writeText(text);
      // Show success feedback (you could add a toast notification here)
      alert('Estimate copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard');
    }
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
      proposalDescription: item.proposalDescription || null,
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
      proposalDescription: null,
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

  // Bulk generate proposal descriptions for items with blank descriptions
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

Write a detailed, professional description for this roofing item. The description should:
- Explain what the product is and its purpose
- Include relevant specifications or features when applicable
- Be 1-2 sentences (15-40 words)
- Sound professional and informative, not salesy
- NOT start with "Install" - vary the sentence structure

Item name: ${item.name}
Category: ${item.category}
Unit: ${item.unit}

Examples of GOOD descriptions:
- "Brava composite slate field tiles - durable, lightweight synthetic roofing with Class A fire rating and 50-year limited warranty."
- "16oz copper D-style drip edge for eave protection - develops natural patina over time."
- "Grace Ice & Water HT self-adhering membrane for high-temperature applications and critical areas."
- "Complete roof installation labor for steep pitch roofing (12/12) - includes tear-off, deck prep, underlayment, and finish roofing."
- "30-yard roll-off dumpster for roofing debris removal and disposal."
- "Rocky Mountain Snow Guard Yeti series - powder-coated snow retention for controlled snow release."

Examples of BAD descriptions (do NOT write like this):
- "Install Brava Field Tile per manufacturer specifications." (too generic, starts with Install)
- "Supply and install roofing materials." (too vague)
- "Roofing labor." (not descriptive enough)

For LABOR items: Describe what work is included (tear-off, deck prep, underlayment, finish roofing, etc.)
For MATERIALS: Describe the product features, specifications, or benefits
For EQUIPMENT/FEES: Describe what is being provided

Return ONLY the description text, nothing else.`,
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

  // Generate smart selection based on job description
  const generateSmartSelection = async () => {
    if (!jobDescription.trim() || !measurements || priceItems.length === 0) {
      alert('Please provide a job description and ensure you have price items.');
      return;
    }

    setIsGeneratingSelection(true);
    setSmartSelectionReasoning('');
    setSmartSelectionWarnings([]);

    try {
      const prompt = `You are a roofing estimator assistant. Based on the job description and measurements, select the appropriate items from the price list.

JOB DESCRIPTION:
${jobDescription}

MEASUREMENTS:
${JSON.stringify(measurements, null, 2)}

PRICE LIST:
${JSON.stringify(priceItems, null, 2)}

RULES:
1. PRODUCT LINES: Only select ONE system (Brava OR DaVinci, never both)
2. LABOR: Only select ONE crew (Hugo/Alfredo/Chris/Sergio). Pick the right Hugo rate based on pitch if Hugo is chosen.
3. SLOPE-AWARE: If pitch >= 8/12, use High Slope/Hinged H&R variants. If < 8/12, use regular H&R.
4. TEAR-OFF: If mentioned, include Rolloff and OSB. Calculate OSB as (total_squares * 3) sheets.
5. DELIVERY: If Brava selected, include Brava Delivery.
6. UNDERLAYMENT: Select appropriate underlayment (Ice & Water for valleys/eaves, synthetic for field)
7. ACCESSORIES: Don't select individual accessory items (nails, caulk, etc.) - these are covered by Sundries %
8. SPECIAL REQUESTS: If user mentions specific items (copper valleys, snowguards, skylights), select those.

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
        
        // Apply the selection
        if (result.selectedItemIds && Array.isArray(result.selectedItemIds)) {
          setSelectedItems(result.selectedItemIds);
        }
        
        // Apply explicit quantities if provided
        if (result.explicitQuantities && typeof result.explicitQuantities === 'object') {
          setItemQuantities(prev => {
            const updated = { ...prev };
            
            // Iterate through explicit quantities
            Object.entries(result.explicitQuantities).forEach(([key, value]) => {
              const quantity = typeof value === 'number' ? value : parseFloat(value as string);
              if (isNaN(quantity)) return;
              
              // Find items whose name contains the key (case-insensitive)
              const keyLower = key.toLowerCase();
              priceItems.forEach(item => {
                if (item.name.toLowerCase().includes(keyLower)) {
                  updated[item.id] = quantity;
                }
              });
            });
            
            return updated;
          });
        }
        
        // Show reasoning and warnings
        if (result.reasoning) {
          setSmartSelectionReasoning(result.reasoning);
        }
        if (result.warnings && Array.isArray(result.warnings)) {
          setSmartSelectionWarnings(result.warnings);
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

    // Calculate Sundries (percentage of materials total only)
    const sundriesAmount = totals.materials * (sundriesPercent / 100);

    // Calculate costs and profit
    // Base cost = materials + labor + equipment + accessories + sundries
    const baseCost = Object.values(totals).reduce((sum, t) => sum + t, 0) + sundriesAmount;
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
      sundriesPercent,
      sundriesAmount,
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
    setUploadedImages(new Set());
    setJobDescription('');
    setSmartSelectionReasoning('');
    setSmartSelectionWarnings([]);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const getCategoryItems = (category) => priceItems.filter(item => item.category === category);

  // Load saved quotes from Supabase
  const fetchSavedQuotes = async () => {
    setIsLoadingQuotes(true);
    try {
      const quotes = await loadQuotes(user?.id);
      setSavedQuotes(quotes);
    } catch (error) {
      console.error('Failed to load quotes:', error);
      // Don't show alert on mount, only on user action
    } finally {
      setIsLoadingQuotes(false);
    }
  };

  // Save current quote
  const saveCurrentQuote = async () => {
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
      
      await saveQuote(estimateWithCustomerInfo, quoteName.trim(), user?.id);
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
  const loadSavedQuote = async (quoteId: string) => {
    try {
      const savedQuote = await loadQuote(quoteId, user?.id);
      
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
      
      // Restore financial settings
      setMarginPercent(savedQuote.margin_percent);
      setOfficeCostPercent(savedQuote.office_percent);
      
      // Restore sundries percent (calculate from saved estimate if available, otherwise use default)
      // Note: We'll need to store sundriesPercent in the saved quote, but for now calculate from estimate
      const restoredEstimateData = savedQuote as any;
      if (restoredEstimateData.sundries_percent !== undefined) {
        setSundriesPercent(restoredEstimateData.sundries_percent);
      }
      
      // Calculate waste percent from line items (materials waste)
      const materialsItems = savedQuote.line_items.filter(item => item.category === 'materials');
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
      
      restoredLineItems.forEach(item => {
        restoredQuantities[item.id] = item.quantity;
        restoredSelectedItems.push(item.id);
      });
      
      setItemQuantities(restoredQuantities);
      setSelectedItems(restoredSelectedItems);
      
      // Reconstruct estimate object
      const byCategory = {
        materials: restoredLineItems.filter(item => item.category === 'materials'),
        labor: restoredLineItems.filter(item => item.category === 'labor'),
        equipment: restoredLineItems.filter(item => item.category === 'equipment'),
        accessories: restoredLineItems.filter(item => item.category === 'accessories'),
      };
      
      const totals = {
        materials: byCategory.materials.reduce((sum, item) => sum + item.total, 0),
        labor: byCategory.labor.reduce((sum, item) => sum + item.total, 0),
        equipment: byCategory.equipment.reduce((sum, item) => sum + item.total, 0),
        accessories: byCategory.accessories.reduce((sum, item) => sum + item.total, 0),
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
      await deleteQuote(quoteId, user?.id);
      await fetchSavedQuotes();
    } catch (error) {
      console.error('Failed to delete quote:', error);
      alert(`Failed to delete quote: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#00293f] text-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="Northstar Roofing"
                width={40}
                height={40}
                className="h-10 w-auto brightness-0 invert"
              />
              <div>
                <h1 className="text-xl font-bold">Northstar Estimator</h1>
                <p className="text-xs text-gray-300">Roofing Estimate Calculator</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-300 hidden sm:block">
                {user?.email}
              </span>
              <button
                onClick={() => signOut()}
                className="bg-[#B1000F] hover:bg-[#8a000c] px-3 py-1.5 rounded text-sm font-medium transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Navigation Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-[73px] z-10">
        <div className="max-w-5xl mx-auto px-4 py-3">
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
              <div className="relative saved-quotes-dropdown">
                <button
                  onClick={() => setShowSavedQuotes(!showSavedQuotes)}
                  className={`flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-lg transition-colors text-sm ${showSavedQuotes ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 hover:bg-gray-200'}`}
                >
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">Saved Quotes</span>
                  <span className="sm:hidden">Quotes</span>
                  ({savedQuotes.length})
                  {showSavedQuotes ? <ChevronUp className="w-4 h-4 hidden sm:inline" /> : <ChevronDown className="w-4 h-4 hidden sm:inline" />}
                </button>
                {showSavedQuotes && (
                  <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-96 overflow-auto">
                    <div className="p-3 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-900 text-sm">Saved Quotes</h3>
                    </div>
                    {isLoadingQuotes ? (
                      <div className="p-6 text-center text-gray-500 text-sm">Loading...</div>
                    ) : savedQuotes.length === 0 ? (
                      <div className="p-6 text-center text-gray-500 text-sm">No saved quotes yet</div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {savedQuotes.map((quote) => (
                          <div key={quote.id} className="p-3 hover:bg-gray-50">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm text-gray-900 truncate">{quote.name}</div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {new Date(quote.created_at).toLocaleDateString()} • {formatCurrency(quote.sell_price)}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => loadSavedQuote(quote.id)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Load quote"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => deleteSavedQuote(quote.id, quote.name)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Delete quote"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
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

                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Sundries</label>
                  <div className="flex items-center bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <input
                      type="number"
                      value={sundriesPercent}
                      onChange={(e) => setSundriesPercent(parseFloat(e.target.value) || 0)}
                      className="w-14 md:w-16 px-2 py-1.5 md:py-2 text-center font-semibold outline-none"
                      min="0"
                      max="50"
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
                            <input
                              type="number"
                              value={item.coverage || ''}
                              onChange={(e) => updatePriceItem(item.id, { coverage: e.target.value ? parseFloat(e.target.value) : null })}
                              placeholder="Coverage"
                              className="w-20 px-2 py-1 border rounded text-sm"
                            />
                            <select
                              value={item.coverageUnit || ''}
                              onChange={(e) => updatePriceItem(item.id, { coverageUnit: e.target.value || null })}
                              className="px-2 py-1 border rounded text-sm"
                            >
                              <option value="">Unit</option>
                              <option value="lf">lf</option>
                              <option value="sqft">sqft</option>
                              <option value="sq">sq</option>
                            </select>
                            <button
                              onClick={() => setEditingItem(null)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="hidden md:block w-full mt-2">
                            <label className="text-xs text-gray-600 block mb-1">Proposal Description (optional)</label>
                            <textarea
                              value={item.proposalDescription || ''}
                              onChange={(e) => updatePriceItem(item.id, { proposalDescription: e.target.value || null })}
                              placeholder="e.g., Install DaVinci Multi-Width Shake synthetic cedar shake roofing system per manufacturer specifications"
                              className="w-full px-2 py-1 border rounded text-sm"
                              rows={3}
                            />
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
                            <div className="flex gap-2">
                              <input
                                type="number"
                                value={item.coverage || ''}
                                onChange={(e) => updatePriceItem(item.id, { coverage: e.target.value ? parseFloat(e.target.value) : null })}
                                placeholder="Coverage"
                                className="flex-1 px-2 py-1 border rounded text-sm"
                              />
                              <select
                                value={item.coverageUnit || ''}
                                onChange={(e) => updatePriceItem(item.id, { coverageUnit: e.target.value || null })}
                                className="px-2 py-1 border rounded text-sm"
                              >
                                <option value="">Unit</option>
                                <option value="lf">lf</option>
                                <option value="sqft">sqft</option>
                                <option value="sq">sq</option>
                              </select>
                            </div>
                            <div className="w-full mt-2">
                              <label className="text-xs text-gray-600 block mb-1">Proposal Description (optional)</label>
                              <textarea
                                value={item.proposalDescription || ''}
                                onChange={(e) => updatePriceItem(item.id, { proposalDescription: e.target.value || null })}
                                placeholder="e.g., Install DaVinci Multi-Width Shake synthetic cedar shake roofing system per manufacturer specifications"
                                className="w-full px-2 py-1 border rounded text-sm"
                                rows={3}
                              />
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 font-medium text-sm md:text-base truncate">{item.name}</span>
                          <span className="text-gray-400 text-sm hidden md:inline">{item.unit}</span>
                          <span className="font-semibold text-sm md:text-base">{formatCurrency(item.price)}</span>
                          {item.coverage && item.coverageUnit && (
                            <span className="text-gray-400 text-xs hidden md:inline">
                              ({item.coverage} {item.coverageUnit})
                            </span>
                          )}
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

              <button
                onClick={generateAllDescriptions}
                disabled={isGeneratingDescriptions || priceItems.filter(item => !item.proposalDescription?.trim()).length === 0}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors text-sm"
              >
                <Bot className="w-4 h-4" />
                {isGeneratingDescriptions 
                  ? `Generating ${generationProgress?.current || 0} of ${generationProgress?.total || 0}...`
                  : 'Generate Descriptions'
                }
              </button>
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
                <div className="flex items-center gap-3">
                  <h2 className="font-semibold text-gray-900">Roof Measurements</h2>
                  {/* Upload indicators */}
                  <div className="flex items-center gap-2">
                    {uploadedImages.has('summary') && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        <Check className="w-3 h-3" />
                        RoofScope Summary
                      </span>
                    )}
                    {uploadedImages.has('analysis') && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        <Check className="w-3 h-3" />
                        Roof Area Analysis
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={resetEstimator} className="text-xs md:text-sm text-gray-500 hover:text-gray-700">
                  Upload Different
                </button>
              </div>

              {/* Hint for additional image */}
              {uploadedImages.has('summary') && !uploadedImages.has('analysis') && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700 flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    <span>Paste your <strong>Roof Area Analysis</strong> image to extract slope breakdown (steep vs standard squares)</span>
                  </p>
                </div>
              )}

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

            {/* Job Description and Smart Selection */}
            <div className="bg-white rounded-2xl p-4 md:p-6 border border-gray-200">
              <h2 className="font-semibold text-gray-900 mb-4">Job Description</h2>
              <div className="space-y-3">
                <input
                  type="text"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Describe this job (e.g., 'Brava tile, tear-off, Hugo's crew, copper valleys')"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <button
                  onClick={() => generateSmartSelection()}
                  disabled={!jobDescription.trim() || priceItems.length === 0 || isGeneratingSelection}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg flex items-center justify-center gap-2 text-sm"
                >
                  {isGeneratingSelection ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Generating Selection...
                    </>
                  ) : (
                    <>
                      <Calculator className="w-4 h-4" />
                      Generate Smart Selection
                    </>
                  )}
                </button>
                {smartSelectionReasoning && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-medium text-blue-900 mb-1">AI Reasoning:</p>
                    <p className="text-sm text-blue-700">{smartSelectionReasoning}</p>
                  </div>
                )}
                {smartSelectionWarnings.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm font-medium text-amber-900 mb-1">Warnings:</p>
                    <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
                      {smartSelectionWarnings.map((warning, idx) => (
                        <li key={idx}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
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
            {/* View Mode Toggle */}
            <div className="flex gap-2 mb-4 items-center">
              <button 
                onClick={() => setViewMode('internal')}
                className={viewMode === 'internal' ? 'bg-blue-500 text-white px-4 py-2 rounded' : 'bg-gray-200 px-4 py-2 rounded'}
              >
                Internal View
              </button>
              <button 
                onClick={() => setViewMode('client')}
                className={viewMode === 'client' ? 'bg-blue-500 text-white px-4 py-2 rounded' : 'bg-gray-200 px-4 py-2 rounded'}
              >
                Client View
              </button>
              {viewMode === 'client' && (
                <button
                  onClick={async () => {
                    try {
                      const blob = await generateProposalPDF(estimate);
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `Proposal_${estimate.customerInfo.name || 'Customer'}_${new Date().toISOString().split('T')[0]}.pdf`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    } catch (error) {
                      console.error('Error generating PDF:', error);
                      alert('Error generating PDF. Please try again.');
                    }
                  }}
                  className="ml-auto bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center gap-2"
                >
                  📄 Download Proposal PDF
                </button>
              )}
            </div>

            {/* Profit Summary Card - Internal View Only */}
            {viewMode === 'internal' && (
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
            )}

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
              {viewMode === 'client' ? (
                <>
                  {/* Client View: Combine Materials + Accessories */}
                  {(() => {
                    const materialsItems = [...estimate.byCategory.materials, ...estimate.byCategory.accessories];
                    if (materialsItems.length > 0) {
                      return (
                        <div className="mb-4 md:mb-6">
                          <h3 className="text-xs md:text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 md:mb-3">MATERIALS</h3>
                          <div className="space-y-2">
                            {materialsItems.map((item, idx) => {
                              const clientPrice = Math.round(item.total * markupMultiplier * 100) / 100;
                              return (
                                <div key={idx} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                                  <div className="flex-1 min-w-0">
                                    <span className="font-medium text-sm block truncate">
                                      {item.proposalDescription && item.proposalDescription.trim() ? item.proposalDescription : item.name}
                                    </span>
                                  </div>
                                  <span className="font-semibold text-sm ml-2">{formatCurrency(clientPrice)}</span>
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex justify-between mt-2 pt-2 border-t border-gray-200 text-sm">
                            <span className="text-gray-600">Materials Subtotal</span>
                            <span className="font-bold">
                              {formatCurrency(
                                Math.round((estimate.totals.materials + estimate.totals.accessories) * markupMultiplier * 100) / 100
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  {/* Labor */}
                  {estimate.byCategory.labor.length > 0 && (
                    <div className="mb-4 md:mb-6">
                      <h3 className="text-xs md:text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 md:mb-3">{CATEGORIES.labor.label}</h3>
                      <div className="space-y-2">
                        {estimate.byCategory.labor.map((item, idx) => {
                          const clientPrice = Math.round(item.total * markupMultiplier * 100) / 100;
                          return (
                            <div key={idx} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-sm block truncate">
                                  {item.proposalDescription && item.proposalDescription.trim() ? item.proposalDescription : item.name}
                                </span>
                              </div>
                              <span className="font-semibold text-sm ml-2">{formatCurrency(clientPrice)}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-between mt-2 pt-2 border-t border-gray-200 text-sm">
                        <span className="text-gray-600">{CATEGORIES.labor.label} Subtotal</span>
                        <span className="font-bold">
                          {formatCurrency(Math.round(estimate.totals.labor * markupMultiplier * 100) / 100)}
                        </span>
                      </div>
                    </div>
                  )}
                  {/* Equipment */}
                  {estimate.byCategory.equipment.length > 0 && (
                    <div className="mb-4 md:mb-6">
                      <h3 className="text-xs md:text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 md:mb-3">{CATEGORIES.equipment.label}</h3>
                      <div className="space-y-2">
                        {estimate.byCategory.equipment.map((item, idx) => {
                          const clientPrice = Math.round(item.total * markupMultiplier * 100) / 100;
                          return (
                            <div key={idx} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-sm block truncate">
                                  {item.proposalDescription && item.proposalDescription.trim() ? item.proposalDescription : item.name}
                                </span>
                              </div>
                              <span className="font-semibold text-sm ml-2">{formatCurrency(clientPrice)}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-between mt-2 pt-2 border-t border-gray-200 text-sm">
                        <span className="text-gray-600">{CATEGORIES.equipment.label} Subtotal</span>
                        <span className="font-bold">
                          {formatCurrency(Math.round(estimate.totals.equipment * markupMultiplier * 100) / 100)}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Internal View: Show all categories separately */
                Object.entries(CATEGORIES).map(([catKey, { label }]) => {
                  const items = estimate.byCategory[catKey];
                  if (!items || items.length === 0) return null;

                  return (
                    <div key={catKey} className="mb-4 md:mb-6">
                      <h3 className="text-xs md:text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 md:mb-3">{label}</h3>
                      <div className="space-y-2">
                        {items.map((item, idx) => {
                          return (
                            <div key={idx} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-sm block truncate">
                                  {item.name}
                                </span>
                                <span className="text-gray-400 text-xs">
                                  {item.quantity} {item.unit} × {formatCurrency(item.price)}
                                  {item.wasteAdded > 0 && (
                                    <span className="text-orange-500 ml-1">(+{item.wasteAdded} waste)</span>
                                  )}
                                </span>
                              </div>
                              <span className="font-semibold text-sm ml-2">{formatCurrency(item.total)}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-between mt-2 pt-2 border-t border-gray-200 text-sm">
                        <span className="text-gray-600">{label} Subtotal</span>
                        <span className="font-bold">
                          {formatCurrency(estimate.totals[catKey])}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Financial Summary */}
              <div className="border-t-2 border-gray-200 pt-4 mt-4 md:mt-6 space-y-2 md:space-y-3 text-sm">
                {viewMode === 'internal' ? (
                  <>
                    <div className="flex justify-between text-gray-600">
                      <span>Materials Subtotal ({estimate.wastePercent}% waste)</span>
                      <span>{formatCurrency(estimate.totals.materials)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Labor Subtotal</span>
                      <span>{formatCurrency(estimate.totals.labor)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Equipment Subtotal</span>
                      <span>{formatCurrency(estimate.totals.equipment)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Accessories Subtotal</span>
                      <span>{formatCurrency(estimate.totals.accessories)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Materials Allowance ({estimate.sundriesPercent}%)</span>
                      <span>{formatCurrency(estimate.sundriesAmount)}</span>
                    </div>
                    <div className="flex justify-between font-medium border-t border-gray-200 pt-2 md:pt-3">
                      <span>Base Cost</span>
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
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-gray-600">
                      <span>Materials Subtotal</span>
                      <span>{formatCurrency(Math.round((estimate.totals.materials + estimate.totals.accessories) * markupMultiplier * 100) / 100)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Labor Subtotal</span>
                      <span>{formatCurrency(Math.round(estimate.totals.labor * markupMultiplier * 100) / 100)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Equipment Subtotal</span>
                      <span>{formatCurrency(Math.round(estimate.totals.equipment * markupMultiplier * 100) / 100)}</span>
                    </div>
                    <div className="flex justify-between items-center border-t-2 border-gray-900 pt-3 md:pt-4">
                      <div>
                        <p className="text-lg md:text-xl font-bold">TOTAL</p>
                      </div>
                      <p className="text-2xl md:text-3xl font-bold">{formatCurrency(estimate.sellPrice)}</p>
                    </div>
                  </>
                )}
              </div>

              {/* Profit Breakdown (Internal Only) */}
              {viewMode === 'internal' && (
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
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
              {viewMode === 'client' && (
                <button
                  onClick={copyClientViewToClipboard}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 text-sm md:text-base"
                >
                  <Copy className="w-4 h-4" />
                  Copy for Proposal
                </button>
              )}
              <button
                onClick={() => setStep('extracted')}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm md:text-base"
              >
                Edit Estimate
              </button>
              <button
                onClick={saveCurrentQuote}
                disabled={isSavingQuote}
                className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold rounded-xl flex items-center justify-center gap-2 text-sm md:text-base"
              >
                {isSavingQuote ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5" />
                    Save Quote
                  </>
                )}
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
