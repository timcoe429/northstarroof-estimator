import { useState } from 'react';
import type { Measurements, CustomerInfo } from '@/types';

type ExtractCallbacks = {
  setCustomerInfo: React.Dispatch<React.SetStateAction<CustomerInfo>>;
  setStep: React.Dispatch<React.SetStateAction<string>>;
  analyzeJobForQuickSelections: (m: Measurements, descriptionOverride?: string) => void;
  initializeEstimateItems: (m: Measurements) => void;
};

export function useMeasurements(callbacks: ExtractCallbacks) {
  const [measurements, setMeasurements] = useState<Measurements | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<Set<string>>(new Set());

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
          callbacks.setCustomerInfo(prev => ({
            ...prev,
            name: extracted.street_name || prev.name || '',
            address: extracted.project_address || prev.address || '',
          }));
        }
        const newMeasurements = { ...extracted, fileName: file.name || 'Pasted image' };
        
        if (measurements) {
          // Merge with existing measurements
          const merged = mergeMeasurements(measurements, newMeasurements);
          setMeasurements(merged);
          callbacks.analyzeJobForQuickSelections(merged);
        } else {
          // Set initial measurements
          setMeasurements(newMeasurements);
          callbacks.analyzeJobForQuickSelections(newMeasurements);
          callbacks.initializeEstimateItems(newMeasurements);
          callbacks.setStep('extracted');
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
          callbacks.initializeEstimateItems(merged);
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

  return {
    measurements,
    setMeasurements,
    isProcessing,
    setIsProcessing,
    uploadedImages,
    setUploadedImages,
    fileToBase64,
    mergeMeasurements,
    extractSummaryImage,
    extractAnalysisImage,
    extractFromImage,
  };
}
