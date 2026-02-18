'use client';

import { useState, useCallback, useRef } from 'react';
import type { BuildingEstimate, PriceItem, RoofSystemType } from '@/types';
import type { BuildingEstimateState } from '@/hooks/useBuildings';
import type { SelectableItem } from '@/types/estimator';
import type { VendorQuoteItem } from '@/types';
import { ROOF_SYSTEM_LABELS } from '@/types';
import { mapRoofSystemToApiFormat } from '@/lib/roofSystemMapping';

const JOB_LEVEL_CATEGORIES = new Set(['labor', 'equipment']);

function buildJobDescription(building: BuildingEstimateState): string {
  const parts: string[] = [];
  if (building.roofSystem) {
    const label = ROOF_SYSTEM_LABELS[building.roofSystem as RoofSystemType];
    if (label) parts.push(label);
  }
  if (building.quickOptions.tearOff) parts.push('tear-off');
  if (building.quickOptions.replaceOSB) parts.push('replace OSB');
  if (building.quickOptions.steepPitch) parts.push('steep pitch');
  if (building.quickOptions.overnightRequired) parts.push('overnight');
  if (building.quickOptions.complexAccess) parts.push('complex access');
  return parts.join(', ');
}

const SELECTION_PROMPT_RULES = `
RULES:
1. METAL ROOF: If the job description mentions "metal roof", do NOT select Brava or DaVinci products.
2. PRODUCT LINES: Only select ONE system (Brava OR DaVinci, never both)
3. LABOR: Only select ONE crew. DEFAULT to Hugo (pick Hugo rate based on pitch). Only select Alfredo/Chris/Sergio if explicitly requested.
4. SLOPE-AWARE: If pitch >= 8/12, use High Slope/Hinged H&R variants. If < 8/12, use regular H&R.
5. TEAR-OFF: If mentioned, include Landfill Charge (NOT "Rolloff") and OSB. Calculate OSB as (total_squares * 3) sheets. Landfill Charge quantity = 1 on EVERY job.
6. DELIVERY: If Brava selected, include Brava Delivery ($5,000 flat fee).
7. UNDERLAYMENT — CRITICAL RULES:
   a) OC Titanium PSU 30 — ALWAYS select on EVERY roof (metal and non-metal), no exceptions
   b) For NON-METAL roofs (Brava, DaVinci, asphalt, cedar): ALSO select SolarHide Radiant Barrier IN ADDITION to PSU 30
   c) For METAL roofs (with Schafer vendor quote): ALSO select GAF VersaShield IN ADDITION to PSU 30
   d) NEVER select Sharkskin (replaced by SolarHide)
   e) NEVER select Grace Ice & Water High Temp as primary underlayment (it is supplemental only for valleys/eaves)
8. FLASHING — CRITICAL RULES:
   a) For NON-METAL roofs (Brava, DaVinci, asphalt, cedar): DEFAULT to standard aluminum flashing (D-Style Eave, D-Style Rake, Valley, Step Flash, Headwall or Pitch Change, Hip & Ridge). Do NOT select Flat Sheet (custom only).
   b) NEVER auto-select copper flashing UNLESS user explicitly says "copper" in job description
   c) For METAL roofs (with Schafer vendor quote): Do NOT select ANY flashing from price list — all flashing comes from Schafer vendor quote
9. FASTENERS — CRITICAL RULES:
   a) Synthetic systems (Brava, DaVinci): select 1 3/4" ringshank nails (look for "1.75" or "1 3/4"" with "ringshank" or "RS" or "HDG")
   b) Presidential asphalt: select 1 3/4" non-ringshank nails
   c) Basic/standard asphalt: select 1 1/2" non-ringshank nails
   d) Metal roofs (with Schafer vendor quote): Do NOT select nails from price list — fasteners come from Schafer vendor quote
   e) Do NOT select Plasticap or other accessories — covered by Sundries %
10. EQUIPMENT & FEES — Use exact names:
   a) Landfill Charge (NOT "Rolloff") — $750, quantity 1 on EVERY job (always include)
   b) Porto Potty — $600, quantity 1 on EVERY job (always include)
   c) Fuel Charge — $194, quantity 1 on EVERY job (always include)
   d) Overnight Charge — $387/night, quantity 1, auto-include when Hugo or Sergio labor crew is selected
   e) Do NOT select accessories/consumables (nails, caulk, sealant, plasticap, coil screws) — covered by Sundries %
11. OPTIONAL ITEMS — Do NOT auto-select these (user adds manually via Calculated Accessories):
   a) Heat Tape (material and labor)
   b) Snow Guards (material and install)
   c) Snow Fence / ColorGard (material and install)
   d) Skylights
12. ACCESSORIES/CONSUMABLES: Do NOT select items like caulk, sealant, spray paint unless:
   a) Explicitly mentioned in job description (e.g., "need 5 tubes of sealant")
   b) Part of a vendor quote (vendor items always get selected)
   These are covered by the Sundries/Misc Materials percentage.
13. ZERO QUANTITY RULE: Do NOT select items with 0 quantity EXCEPT flat-fee items (delivery, fuel, porto potty, landfill charge, overnights).
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

export interface SmartSelectionProgress {
  isRunning: boolean;
  completedBuildingIds: string[];
  currentBuildingId: string | null;
}

interface UseMultiBuildingSmartSelectionProps {
  buildings: BuildingEstimateState[];
  allSelectableItems: SelectableItem[];
  vendorQuoteItems: VendorQuoteItem[];
  vendorItemMap: Map<string, VendorQuoteItem | any>;
  onUpdateBuilding: (id: string, updates: Partial<BuildingEstimateState>) => void;
  onUpdateBuildingsBatch?: (updatesByBuildingId: Record<string, Partial<BuildingEstimateState>>) => void;
  calculateItemQuantities?: (measurements: { total_squares?: number | null; eave_length?: number; rake_length?: number; valley_length?: number; ridge_length?: number; hip_length?: number }) => Record<string, number>;
}

export function useMultiBuildingSmartSelection({
  buildings,
  allSelectableItems,
  vendorQuoteItems,
  vendorItemMap,
  onUpdateBuilding,
  onUpdateBuildingsBatch,
  calculateItemQuantities,
}: UseMultiBuildingSmartSelectionProps) {
  const [progress, setProgress] = useState<SmartSelectionProgress>({
    isRunning: false,
    completedBuildingIds: [],
    currentBuildingId: null,
  });
  const isRunningRef = useRef(false);

  const runAllBuildingSelections = useCallback(async () => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;


    if (allSelectableItems.length === 0) {
      isRunningRef.current = false;
      return;
    }

    setProgress({ isRunning: true, completedBuildingIds: [], currentBuildingId: null });
    const completed: string[] = [];
    const vendorItemIds = vendorQuoteItems.map((item) => item.id);
    const batchUpdates: Record<string, Partial<BuildingEstimateState>> = {};

    try {
      for (const building of buildings) {
        if (building.roofSystem === '') continue;

        setProgress((p) => ({ ...p, currentBuildingId: building.id }));

        const roofSystemApi = mapRoofSystemToApiFormat(building.roofSystem);
        let knowledgeContext = '';
        try {
          const knowledgeRes = await fetch('/api/smart-selection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roofSystem: roofSystemApi }),
          });
          if (knowledgeRes.ok) {
            const data = await knowledgeRes.json();
            knowledgeContext = data.knowledge || '';
          }
        } catch (err) {
          console.warn('Failed to load knowledge for', building.name, err);
        }

        const jobDesc = buildJobDescription(building);
        const selectionItems = allSelectableItems.map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          unit: item.unit,
          price: item.price,
          source: item.isVendorItem ? 'vendor' : 'price-list',
        }));

        const prompt = `You are a roofing estimator assistant. Based on the job description and measurements, select the appropriate items from the price list.

${knowledgeContext ? `ROOF SYSTEM KNOWLEDGE:
${knowledgeContext}

Use the knowledge above to guide your selections. Follow these rules as fallback:

` : ''}JOB DESCRIPTION:
${jobDesc}

MEASUREMENTS:
${JSON.stringify(building.measurements, null, 2)}

PRICE LIST:
${JSON.stringify(selectionItems, null, 2)}
${SELECTION_PROMPT_RULES}`;

        const response = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, max_tokens: 2000 }),
        });

        if (!response.ok) throw new Error('Failed to generate smart selection');

        const data = await response.json();
        const text = data.content?.[0]?.text || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Could not parse smart selection response');

        const result = JSON.parse(jsonMatch[0]);
        const selectedFromAI = Array.isArray(result.selectedItemIds) ? result.selectedItemIds : [];
        const mergedSelection = Array.from(new Set([...selectedFromAI, ...vendorItemIds]));
        const updatedQuantities: Record<string, number> = {};

        if (calculateItemQuantities && building.measurements) {
          const calculatedQtys = calculateItemQuantities(building.measurements);
          Object.assign(updatedQuantities, calculatedQtys);
        }

        if (result.explicitQuantities && typeof result.explicitQuantities === 'object') {
          const synonymMap: Record<string, string[]> = {
            dumpster: ['rolloff', 'dumpster'],
            rolloff: ['rolloff', 'dumpster'],
            porto: ['porto', 'porto potty', 'portable'],
            'porto potty': ['porto', 'porto potty', 'portable'],
            portable: ['porto', 'porto potty', 'portable'],
          };
          Object.entries(result.explicitQuantities).forEach(([key, value]) => {
            const q = typeof value === 'number' ? value : parseFloat(value as string);
            if (isNaN(q) || q <= 0) return;
            const keyLower = key.toLowerCase();
            const searchTerms = synonymMap[keyLower] || [keyLower];
            allSelectableItems.forEach((item) => {
              const nameLower = item.name.toLowerCase();
              if (searchTerms.some((term) => nameLower.includes(term))) {
                updatedQuantities[item.id] = q;
              }
            });
          });
        }

        mergedSelection.forEach((id) => {
          const vendorItem = vendorItemMap.get(id);
          if (vendorItem) updatedQuantities[id] = vendorItem.quantity || 0;
        });

        const cleanedSelection = mergedSelection.filter((id) => {
          const item = allSelectableItems.find((i) => i.id === id);
          const qty = updatedQuantities[id] ?? 0;
          if (item?.isVendorItem) return true;
          const name = item?.name?.toLowerCase() || '';
          if (name.includes('delivery') || name.includes('rolloff') || name.includes('dumpster') || name.includes('overnight')) return true;
          return qty > 0;
        });

        const perBuildingSelection = cleanedSelection.filter((id) => {
          const item = allSelectableItems.find((i) => i.id === id);
          return item && !JOB_LEVEL_CATEGORIES.has(item.category);
        });

        const matchedPriceItems: PriceItem[] = perBuildingSelection
          .map((id) => allSelectableItems.find((i) => i.id === id))
          .filter((i): i is PriceItem => i != null);

        const quantitiesForBuilding: Record<string, number> = {};
        perBuildingSelection.forEach((id) => {
          quantitiesForBuilding[id] = updatedQuantities[id] ?? 0;
        });


        batchUpdates[building.id] = {
          selectedItems: matchedPriceItems,
          itemQuantities: quantitiesForBuilding,
          aiReasoning: result.reasoning,
          warnings: Array.isArray(result.warnings) ? result.warnings : [],
          smartSelectionComplete: true,
        };
        if (!onUpdateBuildingsBatch) {
          onUpdateBuilding(building.id, batchUpdates[building.id]!);
        }

        completed.push(building.id);
        setProgress((p) => ({ ...p, completedBuildingIds: [...completed] }));
      }

      if (onUpdateBuildingsBatch && Object.keys(batchUpdates).length > 0) {
        onUpdateBuildingsBatch(batchUpdates);
      }
    } catch (error) {
      console.error('Multi-building smart selection error:', error);
    } finally {
      isRunningRef.current = false;
      setProgress((p) => ({ ...p, isRunning: false, currentBuildingId: null }));
    }
  }, [buildings, allSelectableItems, vendorQuoteItems, vendorItemMap, onUpdateBuilding, onUpdateBuildingsBatch, calculateItemQuantities]);

  return { progress, runAllBuildingSelections };
}
