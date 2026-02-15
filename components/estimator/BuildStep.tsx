'use client'

import React from 'react';
import { Calculator, ClipboardList } from 'lucide-react';
import type { Measurements, BuildingEstimate, Estimate } from '@/types';
import type { QuickSelectOption } from '@/types/estimator';
import { roofSystemIdToDisplayName } from '@/lib/roofSystemConstants';
import { formatCurrency } from '@/lib/estimatorUtils';

interface AllBuildingsProgress {
  isRunning: boolean;
  current: number;
  total: number;
  skipped: string[];
  failed: string[];
  completeMessage: string | null;
}

interface BuildStepProps {
  /** Active building when editing (null = All Combined read-only view) */
  activeBuilding: BuildingEstimate | null;
  /** True when showing All Combined tab */
  isAllCombinedTab: boolean;
  /** Measurements to display (per-building or merged) */
  measurements: Measurements | null;
  /** Number of structures for display */
  structureCount?: number;
  /** Smart selection - roof system for this building */
  roofSystem: string;
  /** Quick selection options */
  quickSelections: QuickSelectOption[];
  /** Smart selection reasoning */
  smartSelectionReasoning: string;
  /** Smart selection warnings */
  smartSelectionWarnings: string[];
  /** Whether smart selection is generating */
  isGeneratingSelection: boolean;
  /** Number of selectable items */
  allSelectableItemsLength: number;
  /** Combined estimate for All Combined tab (read-only) */
  combinedEstimate?: Estimate | null;
  /** Buildings for per-building subtotals in All Combined view */
  buildings?: BuildingEstimate[];
  /** Callback to generate smart selection */
  onGenerateSmartSelection: () => void;
  /** Callback to generate smart selection for all buildings (All Combined tab) */
  onGenerateSmartSelectionForAll?: () => void;
  /** Progress state when running smart selection for all buildings */
  allBuildingsProgress?: AllBuildingsProgress | null;
  /** Callback to toggle quick selection */
  onToggleQuickSelection: (optionId: string) => void;
  /** Content to render when editing a building (EstimateBuilder + CalculatedAccessories) */
  children: React.ReactNode;
}

/**
 * Build step: Per-building material selection or All Combined read-only summary.
 * Renders roof system badge, smart selection, measurements, and either
 * the editable EstimateBuilder or a read-only combined summary.
 */
export function BuildStep({
  activeBuilding,
  isAllCombinedTab,
  measurements,
  structureCount,
  roofSystem,
  quickSelections,
  smartSelectionReasoning,
  smartSelectionWarnings,
  isGeneratingSelection,
  allSelectableItemsLength,
  combinedEstimate,
  buildings = [],
  onGenerateSmartSelection,
  onGenerateSmartSelectionForAll,
  allBuildingsProgress,
  onToggleQuickSelection,
  children,
}: BuildStepProps) {
  if (isAllCombinedTab) {
    // Read-only All Combined view
    const totals = combinedEstimate?.totals;
    const isGeneratingForAll = allBuildingsProgress?.isRunning ?? false;
    const hasCompleteMessage = allBuildingsProgress?.completeMessage && !allBuildingsProgress?.isRunning;

    return (
      <div className="bg-white rounded-2xl p-4 md:p-6 border border-gray-200">
        <h2 className="font-semibold text-gray-900 mb-4">All Combined — Read Only</h2>
        <p className="text-sm text-gray-500 mb-4">
          Total across all {buildings.length} building{buildings.length !== 1 ? 's' : ''}. Switch to individual building tabs to edit.
        </p>

        {/* Generate Smart Selection for All Buildings button */}
        {onGenerateSmartSelectionForAll && allSelectableItemsLength > 0 && (
          <div className="space-y-2 mb-4">
            <button
              onClick={onGenerateSmartSelectionForAll}
              disabled={isGeneratingForAll || buildings.length === 0}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg flex items-center justify-center gap-2 text-sm"
            >
              {isGeneratingForAll ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating selections... {allBuildingsProgress?.current ?? 0} of {allBuildingsProgress?.total ?? 0} buildings
                </>
              ) : (
                <>
                  <ClipboardList className="w-4 h-4" />
                  Generate Smart Selection for All Buildings
                </>
              )}
            </button>
            {isGeneratingForAll && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-900">
                  Generating selections... {allBuildingsProgress?.current ?? 0} of {allBuildingsProgress?.total ?? 0} buildings
                </p>
              </div>
            )}
            {hasCompleteMessage && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-900">{allBuildingsProgress?.completeMessage}</p>
              </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          {totals && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-gray-50 rounded-xl">
              <div>
                <div className="text-xs text-gray-500">Materials</div>
                <div className="font-semibold text-gray-900">{formatCurrency(totals.materials)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Labor</div>
                <div className="font-semibold text-gray-900">{formatCurrency(totals.labor)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Equipment</div>
                <div className="font-semibold text-gray-900">{formatCurrency(totals.equipment)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Accessories</div>
                <div className="font-semibold text-gray-900">{formatCurrency(totals.accessories)}</div>
              </div>
              {totals.schafer > 0 && (
                <div>
                  <div className="text-xs text-gray-500">Vendor Quote</div>
                  <div className="font-semibold text-gray-900">{formatCurrency(totals.schafer)}</div>
                </div>
              )}
            </div>
          )}
          {combinedEstimate && (
            <div>
              <div className="text-lg font-bold text-[#00293f]">
                Total: {formatCurrency(combinedEstimate.sellPrice)}
              </div>
            </div>
          )}
          {buildings.length > 1 && combinedEstimate?.lineItems && (
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Per-building breakdown</h4>
              {buildings.map((b) => {
                const buildingItemIds = new Set([...b.selectedItems, ...b.vendorQuoteItemIds]);
                const buildingTotal = combinedEstimate.lineItems
                  .filter((item) => buildingItemIds.has(item.id))
                  .reduce((sum, item) => sum + item.total, 0);
                return (
                  <div key={b.structureId} className="flex justify-between text-sm py-2 border-b border-gray-100">
                    <span className="text-gray-700">{b.structureName}</span>
                    <span className="font-medium">{formatCurrency(buildingTotal)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Per-building editable view
  return (
    <div className="space-y-4">
      {/* Roof system badge */}
      {roofSystem && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Roof System:</span>
          <span className="px-2 py-1 bg-[#00293f] text-white text-sm font-medium rounded">
            {roofSystemIdToDisplayName(roofSystem)}
          </span>
        </div>
      )}

      {/* Quick Selection Options */}
      {quickSelections.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-gray-200">
          <h3 className="font-medium text-gray-900 mb-3 text-sm">Quick Options</h3>
          <div className="flex flex-wrap gap-2">
            {quickSelections.map((option) => (
              <button
                key={option.id}
                onClick={() => onToggleQuickSelection(option.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  option.selected
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Measurements summary */}
      {measurements && (
        <div className="p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-900 font-medium mb-2">
            {activeBuilding ? `Measurements for ${activeBuilding.structureName}` : 'Measurements'}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <div>
              <span className="text-gray-500">Squares:</span>{' '}
              {(measurements.total_squares ?? 0).toFixed(1)}
            </div>
            <div>
              <span className="text-gray-500">Eave:</span> {measurements.eave_length ?? 0} ft
            </div>
            <div>
              <span className="text-gray-500">Valley:</span> {measurements.valley_length ?? 0} ft
            </div>
            <div>
              <span className="text-gray-500">Ridge:</span> {measurements.ridge_length ?? 0} ft
            </div>
          </div>
        </div>
      )}

      {/* Smart Selection */}
      <div className="space-y-2">
        <button
          onClick={onGenerateSmartSelection}
          disabled={!roofSystem || allSelectableItemsLength === 0 || isGeneratingSelection}
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

      {/* Line items (EstimateBuilder + CalculatedAccessories) */}
      {children}
    </div>
  );
}
