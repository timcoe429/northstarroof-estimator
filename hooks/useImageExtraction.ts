import { useState } from 'react';
import type { Measurements, CustomerInfo, PriceItem } from '@/types';
import { fileToBase64, mergeMeasurements } from '@/lib/estimatorUtils';

interface UseImageExtractionProps {
  measurements: Measurements | null;
  uploadedImages: Set<string>;
  onSetMeasurements: (measurements: Measurements | null | ((prev: Measurements | null) => Measurements | null)) => void;
  onSetCustomerInfo: (info: CustomerInfo | ((prev: CustomerInfo) => CustomerInfo)) => void;
  onSetUploadedImages: (images: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  onSetStep: (step: string) => void;
  onSetExtractedItems: (items: PriceItem[] | null) => void;
  onSetPriceSheetProcessing: (processing: boolean) => void;
  onAnalyzeJobForQuickSelections: (m: Measurements, descriptionOverride?: string) => void;
  onApplyAutoSelection: (m: Measurements) => void;
  onExtractVendorQuoteFromPdf: (file: File) => Promise<{ quote: any; items: any[] }>;
  onSetVendorQuotes: (quotes: any[] | ((prev: any[]) => any[])) => void;
  onSetVendorQuoteItems: (items: any[] | ((prev: any[]) => any[])) => void;
  onSetIsExtractingVendorQuote: (extracting: boolean) => void;
  onSetSelectedItems: (items: string[] | ((prev: string[]) => string[])) => void;
  onSetItemQuantities: (quantities: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void;
  onRoofScopeImageExtracted?: (dataUrl: string) => void;
}

export const useImageExtraction = ({
  measurements,
  uploadedImages,
  onSetMeasurements,
  onSetCustomerInfo,
  onSetUploadedImages,
  onSetStep,
  onSetExtractedItems,
  onSetPriceSheetProcessing,
  onAnalyzeJobForQuickSelections,
  onApplyAutoSelection,
  onExtractVendorQuoteFromPdf,
  onSetVendorQuotes,
  onSetVendorQuoteItems,
  onSetIsExtractingVendorQuote,
  onSetSelectedItems,
  onSetItemQuantities,
  onRoofScopeImageExtracted,
}: UseImageExtractionProps) => {
  const [isProcessing, setIsProcessing] = useState(false);

  // Extract prices from screenshot using Claude vision
  const extractPricesFromImage = async (file: File) => {
    onSetPriceSheetProcessing(true);

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

Extract each item with: name, category, unit, price, and coverage information if available.

COVERAGE EXTRACTION:
Look for coverage information in the item description or notes:
- "10' length" or "10 ft" → coverage: 10, coverageUnit: "lf"
- "2 sq per roll" or "2 squares" → coverage: 2, coverageUnit: "sq"
- "200 sq ft per roll" or "200 sqft" → coverage: 200, coverageUnit: "sqft"
- "4 linear feet per piece" → coverage: 4, coverageUnit: "lf"
- "14.3 sq ft per bundle" → coverage: 14.3, coverageUnit: "sqft"
- If no coverage info found, use coverage: null, coverageUnit: null

Return ONLY a JSON array like this:
[
  {"name": "Brava Field Tile", "unit": "bundle", "price": 43.25, "coverage": 14.3, "coverageUnit": "sqft", "category": "materials"},
  {"name": "Copper D-Style Eave", "unit": "each", "price": 25.00, "coverage": 10, "coverageUnit": "lf", "category": "materials"},
  {"name": "Hugo (standard)", "unit": "sq", "price": 550, "coverage": null, "coverageUnit": null, "category": "labor"},
  {"name": "Rolloff", "unit": "sq", "price": 48, "coverage": null, "coverageUnit": null, "category": "equipment"},
  {"name": "4\" Boot Galv", "unit": "each", "price": 20, "coverage": null, "coverageUnit": null, "category": "accessories"}
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
        onSetExtractedItems(extracted);
      } else {
        alert('Could not extract prices. Please try a clearer screenshot.');
      }
    } catch (error) {
      console.error('Price extraction error:', error);
      alert('Error processing image. Please try again.');
    }

    onSetPriceSheetProcessing(false);
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

PROJECT INFORMATION (found at top of RoofScope report):
- project_address: The FULL project address including street, city, state, zip (e.g., "39 W Lupine Dr, Aspen, CO 81611") - DO NOT include "USA"
- street_name: Just the street number and name for the customer name field (e.g., "39 W Lupine Dr")

ROOFING KNOWLEDGE:
- 1 square = 100 sq ft of roof area
- Starter is used along eaves and rakes
- H&R (Hip & Ridge) covers the hips and ridges
- Valleys need valley metal or ice & water shield
- Penetrations need pipe boots/flashings
- Labor is priced per square, varies by pitch difficulty

Return ONLY a JSON object:
{
  "project_address": "<full address - street, city, state zip>",
  "street_name": "<just street number and name>",
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

Use 0 for any values not visible. Use empty string for address fields if not visible. Return only JSON.`;

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
        if (extracted.street_name || extracted.project_address) {
          onSetCustomerInfo(prev => ({
            ...prev,
            name: extracted.street_name || prev.name || '',
            address: extracted.project_address || prev.address || '',
          }));
        }
        const newMeasurements = { ...extracted, fileName: file.name || 'Pasted image' };

        if (measurements) {
          // Merge with existing measurements
          const merged = mergeMeasurements(measurements, newMeasurements);
          onSetMeasurements(merged);
          onAnalyzeJobForQuickSelections(merged);
          onApplyAutoSelection(merged);
        } else {
          // Set initial measurements
          onSetMeasurements(newMeasurements);
          onAnalyzeJobForQuickSelections(newMeasurements);
          onApplyAutoSelection(newMeasurements);
          onSetStep('extracted');
        }

        onSetUploadedImages(prev => new Set(Array.from(prev).concat('summary')));
        try {
          onRoofScopeImageExtracted?.(dataUrl);
        } catch (aiError) {
          console.error('AI structure detection callback error:', aiError);
        }
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
          onSetMeasurements(merged);
        } else {
          // If no existing measurements, this shouldn't happen but handle gracefully
          alert('Please upload the RoofScope Summary first, then the Roof Area Analysis.');
          setIsProcessing(false);
          return;
        }
        
        onSetUploadedImages(prev => new Set(Array.from(prev).concat('analysis')));
        try {
          onRoofScopeImageExtracted?.(dataUrl);
        } catch (aiError) {
          console.error('AI structure detection callback error:', aiError);
        }
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
    if (file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')) {
      onSetIsExtractingVendorQuote(true);
      try {
        const { quote, items } = await onExtractVendorQuoteFromPdf(file);
        if (quote) {
          onSetVendorQuotes(prev => [...prev, quote]);
        }
        if (items.length > 0) {
          // Add all quote items directly - no matching logic
          // Schafer quotes are the source of truth, all items are included
          const newItemIds = items.map(item => item.id);
          onSetVendorQuoteItems(prev => [...prev, ...items]);
          onSetSelectedItems(prev => Array.from(new Set([...prev, ...newItemIds])));
          onSetItemQuantities(prev => {
            const updated = { ...prev };
            items.forEach(item => {
              updated[item.id] = item.quantity || 0;
            });
            return updated;
          });
        }
      } catch (error) {
        console.error('Vendor quote extraction error:', error);
        alert('Error extracting vendor quote. Please try again.');
      } finally {
        onSetIsExtractingVendorQuote(false);
      }
      return;
    }

    // If measurements already exist and summary has been uploaded, assume this is an analysis image
    // Otherwise, assume it's a summary image
    if (measurements && uploadedImages.has('summary') && !uploadedImages.has('analysis')) {
      await extractAnalysisImage(file);
    } else {
      await extractSummaryImage(file);
    }
  };

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

  return {
    isProcessing,
    extractPricesFromImage,
    extractSummaryImage,
    extractAnalysisImage,
    extractFromImage,
    handleFileUpload,
    handlePriceSheetUpload,
    handleDrop,
  };
};
