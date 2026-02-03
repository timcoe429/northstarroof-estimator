'use client'

import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Plus, Minus, AlertCircle } from 'lucide-react';
import type { Measurements, PriceItem } from '@/types';
import { 
  calculateHeatTape, 
  calculateSnowGuards, 
  calculateSnowFence,
  getAccessoryPrices,
  findPriceItemByName,
  type HeatTapeCalc,
  type SnowRetentionCalc
} from '@/lib/accessoryCalculations';
import { formatCurrency } from '@/lib/estimatorUtils';

interface CalculatedAccessoriesProps {
  measurements: Measurements | null;
  isMetalRoof: boolean;
  priceItems: PriceItem[];
  selectedItems: string[];
  onAddToEstimate: (materialItemId: string, laborItemId: string, materialQty: number, laborQty: number) => void;
  skylightCount: number;
  onAddSkylight: () => void;
  onRemoveSkylight: () => void;
}

export function CalculatedAccessories({
  measurements,
  isMetalRoof,
  priceItems,
  selectedItems,
  onAddToEstimate,
  skylightCount,
  onAddSkylight,
  onRemoveSkylight,
}: CalculatedAccessoriesProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [heatTapeQty, setHeatTapeQty] = useState<number | null>(null);
  const [snowRetentionQty, setSnowRetentionQty] = useState<number | null>(null);

  // Get prices from price list
  const prices = useMemo(() => getAccessoryPrices(priceItems), [priceItems]);

  // Calculate accessories
  const calculations = useMemo(() => {
    if (!measurements || !measurements.eave_length) return null;

    const eave = measurements.eave_length;
    const valley = measurements.valley_length || 0;
    const pitch = measurements.predominant_pitch || '7/12';

    const heatTape = calculateHeatTape(eave, valley, prices.heatTapeMaterial, prices.heatTapeLabor);
    
    const snowRetention = isMetalRoof
      ? calculateSnowFence(eave, pitch, prices.snowFenceMaterial, prices.snowFenceLabor)
      : calculateSnowGuards(eave, pitch, prices.snowGuardMaterial, prices.snowGuardLabor);

    return { heatTape, snowRetention };
  }, [measurements, isMetalRoof, prices]);

  // Find price items
  const heatTapeMaterialItem = useMemo(() => 
    findPriceItemByName(priceItems, 'Heat Tape', 'materials') || 
    findPriceItemByName(priceItems, 'Heat Tape', 'accessories'),
    [priceItems]
  );
  const heatTapeLaborItem = useMemo(() => 
    findPriceItemByName(priceItems, 'Heat Tape Install', 'labor') ||
    findPriceItemByName(priceItems, 'Heat Tape', 'labor'),
    [priceItems]
  );

  const snowRetentionMaterialItem = useMemo(() => {
    if (isMetalRoof) {
      return findPriceItemByName(priceItems, 'Snow Fence', 'materials') ||
             findPriceItemByName(priceItems, 'ColorGard', 'materials') ||
             findPriceItemByName(priceItems, 'Snow Fence', 'accessories');
    } else {
      return findPriceItemByName(priceItems, 'RMSG Yeti Snowguard', 'materials') ||
             findPriceItemByName(priceItems, 'Snowguard', 'materials') ||
             findPriceItemByName(priceItems, 'Snow Guard', 'materials');
    }
  }, [priceItems, isMetalRoof]);

  const snowRetentionLaborItem = useMemo(() => {
    if (isMetalRoof) {
      return findPriceItemByName(priceItems, 'Snow Fence Install', 'labor') ||
             findPriceItemByName(priceItems, 'Snow Fence', 'labor');
    } else {
      return findPriceItemByName(priceItems, 'Snowguard Install', 'labor') ||
             findPriceItemByName(priceItems, 'Snow Guard Install', 'labor');
    }
  }, [priceItems, isMetalRoof]);

  const skylightItem = useMemo(() => 
    findPriceItemByName(priceItems, 'Skylight', 'accessories') ||
    findPriceItemByName(priceItems, 'Skylight', 'materials'),
    [priceItems]
  );

  // Check if items are already added
  const heatTapeAdded = heatTapeMaterialItem && heatTapeLaborItem &&
    selectedItems.includes(heatTapeMaterialItem.id) && 
    selectedItems.includes(heatTapeLaborItem.id);

  const snowRetentionAdded = snowRetentionMaterialItem && snowRetentionLaborItem &&
    selectedItems.includes(snowRetentionMaterialItem.id) &&
    selectedItems.includes(snowRetentionLaborItem.id);

  // Check for missing price items
  const missingItems: string[] = [];
  if (!heatTapeMaterialItem) missingItems.push('Heat Tape (materials)');
  if (!heatTapeLaborItem) missingItems.push('Heat Tape Install (labor)');
  if (!snowRetentionMaterialItem) {
    missingItems.push(isMetalRoof ? 'Snow Fence (materials)' : 'Snow Guard (materials)');
  }
  if (!snowRetentionLaborItem) {
    missingItems.push(isMetalRoof ? 'Snow Fence Install (labor)' : 'Snow Guard Install (labor)');
  }

  if (!calculations || !measurements?.eave_length) {
    return null;
  }

  const { heatTape, snowRetention } = calculations;
  const displayHeatTapeQty = heatTapeQty ?? heatTape.totalLF;
  const displaySnowRetentionQty = snowRetentionQty ?? snowRetention.totalQuantity;

  return (
    <div className="bg-white rounded-2xl p-4 md:p-6 border border-gray-200 mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between mb-4"
      >
        <h3 className="text-lg font-semibold text-gray-900">Calculated Accessories</h3>
        {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
      </button>

      {isExpanded && (
        <div className="space-y-4">
          {missingItems.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800 mb-1">Missing Price Items</p>
                  <p className="text-xs text-amber-700">
                    Add these items to your price list: {missingItems.join(', ')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Heat Tape */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900">Heat Tape</h4>
              <span className="text-sm text-gray-600">
                <input
                  type="number"
                  value={displayHeatTapeQty}
                  onChange={(e) => setHeatTapeQty(parseFloat(e.target.value) || null)}
                  className="w-20 px-2 py-1 border rounded text-right text-sm"
                  min="0"
                />
                {' '}LF
              </span>
            </div>
            <div className="text-xs text-gray-600 mb-3 space-y-1">
              <div>Eave: {heatTape.eaveLength} ÷ 3 × 6 = {heatTape.eaveCable} LF</div>
              {heatTape.valleyLength > 0 && (
                <div>Valley: {heatTape.valleyLength} LF</div>
              )}
              <div className="font-medium">
                Material: {formatCurrency(displayHeatTapeQty * prices.heatTapeMaterial)} | 
                Labor: {formatCurrency(displayHeatTapeQty * prices.heatTapeLabor)}
              </div>
            </div>
            {heatTapeMaterialItem && heatTapeLaborItem ? (
              <button
                onClick={() => {
                  if (displayHeatTapeQty > 0) {
                    onAddToEstimate(
                      heatTapeMaterialItem.id,
                      heatTapeLaborItem.id,
                      displayHeatTapeQty,
                      displayHeatTapeQty
                    );
                  }
                }}
                disabled={heatTapeAdded || displayHeatTapeQty <= 0}
                className={`w-full py-2 px-4 rounded-lg font-medium text-sm ${
                  heatTapeAdded
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : displayHeatTapeQty > 0
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {heatTapeAdded ? 'Already Added' : 'Add to Estimate'}
              </button>
            ) : (
              <div className="text-xs text-amber-600 py-2">
                Missing price items: {!heatTapeMaterialItem && 'Heat Tape (materials)'} {!heatTapeLaborItem && 'Heat Tape Install (labor)'}
              </div>
            )}
          </div>

          {/* Snow Guards / Snow Fence */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900">
                {isMetalRoof ? 'Snow Fence' : 'Snow Guards'}
              </h4>
              <span className="text-sm text-gray-600">
                <input
                  type="number"
                  value={displaySnowRetentionQty}
                  onChange={(e) => setSnowRetentionQty(parseFloat(e.target.value) || null)}
                  className="w-20 px-2 py-1 border rounded text-right text-sm"
                  min="0"
                />
                {' '}{snowRetention.unit === 'lf' ? 'LF' : 'ea'}
              </span>
            </div>
            <div className="text-xs text-gray-600 mb-3 space-y-1">
              <div>
                {snowRetention.eaveLength} LF eave × {snowRetention.numRows} row{snowRetention.numRows > 1 ? 's' : ''} ({snowRetention.pitch} pitch)
              </div>
              <div className="font-medium">
                Material: {formatCurrency(displaySnowRetentionQty * (isMetalRoof ? prices.snowFenceMaterial : prices.snowGuardMaterial))} | 
                Labor: {formatCurrency(displaySnowRetentionQty * (isMetalRoof ? prices.snowFenceLabor : prices.snowGuardLabor))}
              </div>
            </div>
            {snowRetentionMaterialItem && snowRetentionLaborItem ? (
              <button
                onClick={() => {
                  if (displaySnowRetentionQty > 0) {
                    onAddToEstimate(
                      snowRetentionMaterialItem.id,
                      snowRetentionLaborItem.id,
                      displaySnowRetentionQty,
                      displaySnowRetentionQty
                    );
                  }
                }}
                disabled={snowRetentionAdded || displaySnowRetentionQty <= 0}
                className={`w-full py-2 px-4 rounded-lg font-medium text-sm ${
                  snowRetentionAdded
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : displaySnowRetentionQty > 0
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {snowRetentionAdded ? 'Already Added' : 'Add to Estimate'}
              </button>
            ) : (
              <div className="text-xs text-amber-600 py-2">
                Missing price items: {!snowRetentionMaterialItem && (isMetalRoof ? 'Snow Fence (materials)' : 'Snow Guard (materials)')} {!snowRetentionLaborItem && (isMetalRoof ? 'Snow Fence Install (labor)' : 'Snow Guard Install (labor)')}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 pt-4">
            <h4 className="font-medium text-gray-900 mb-3">Optional (not included in total)</h4>

            {/* Skylights */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">Skylights</div>
                <div className="text-xs text-gray-600">
                  {formatCurrency(prices.skylight)} each
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={onRemoveSkylight}
                  disabled={skylightCount <= 0}
                  className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-12 text-center font-medium">{skylightCount}</span>
                <button
                  onClick={onAddSkylight}
                  className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-50"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <span className="w-24 text-right font-medium">
                  {formatCurrency(skylightCount * prices.skylight)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
