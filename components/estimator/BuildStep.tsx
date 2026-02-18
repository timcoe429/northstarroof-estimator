'use client';

import React, { useState, useEffect } from 'react';
import { Calculator } from 'lucide-react';
import { BuildingProgress } from './BuildingProgress';
import { BuildingSection } from './BuildingSection';
import { JobLevelSection, type JobLevelSectionProps } from './JobLevelSection';
import type { BuildingEstimate } from '@/types';
import type { BuildingEstimateState } from '@/hooks/useBuildings';
import type { SelectableItem } from '@/types/estimator';

type BuildingLike = BuildingEstimate | BuildingEstimateState;

export interface BuildStepProps {
  buildings: BuildingLike[];
  onToggleBuildingExpanded: (id: string) => void;
  smartSelectionProgress: {
    isRunning: boolean;
    completedBuildingIds: string[];
    currentBuildingId: string | null;
  };
  buildingMaterials: Record<
    string,
    {
      selectedItems: string[];
      itemQuantities: Record<string, number>;
      materialsSubtotal: number;
      aiReasoning?: string;
      warnings?: string[];
    }
  >;
  allSelectableItems: SelectableItem[];
  onToggleSelection: (buildingId: string, itemId: string) => void;
  onQuantityChange: (buildingId: string, itemId: string, quantity: number) => void;
  onUpdateItem: (buildingId: string, itemId: string, field: string, value: unknown) => void;
  onRegenerateBuildingSelection: (buildingId: string) => void;
  jobLevelProps: JobLevelSectionProps;
  onGenerateEstimate: () => void;
  isCalculating: boolean;
}

export function BuildStep({
  buildings,
  onToggleBuildingExpanded,
  smartSelectionProgress,
  buildingMaterials,
  allSelectableItems,
  onToggleSelection,
  onQuantityChange,
  onUpdateItem,
  onRegenerateBuildingSelection,
  jobLevelProps,
  onGenerateEstimate,
  isCalculating,
}: BuildStepProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (buildings.length > 0 && expandedIds.size === 0) {
      setExpandedIds(new Set([buildings[0].id]));
    }
  }, [buildings, expandedIds.size]);

  const handleToggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    onToggleBuildingExpanded(id);
  };

  const isSingleBuilding = buildings.length === 1;
  const isDisabled = smartSelectionProgress.isRunning || isCalculating;

  return (
    <div className="space-y-6">
      {smartSelectionProgress.isRunning && (
        <BuildingProgress
          buildings={buildings}
          completedBuildingIds={smartSelectionProgress.completedBuildingIds}
          currentBuildingId={smartSelectionProgress.currentBuildingId}
          isRunning={smartSelectionProgress.isRunning}
        />
      )}

      {buildings.map((building) => {
        const materials = buildingMaterials[building.id] ?? {
          selectedItems: [],
          itemQuantities: {},
          materialsSubtotal: 0,
          aiReasoning: undefined,
          warnings: undefined,
        };

        return (
          <BuildingSection
            key={building.id}
            building={building}
            isExpanded={isSingleBuilding || expandedIds.has(building.id)}
            onToggleExpanded={handleToggleExpanded}
            selectedItems={materials.selectedItems}
            itemQuantities={materials.itemQuantities}
            allSelectableItems={allSelectableItems}
            onToggleSelection={(itemId) => onToggleSelection(building.id, itemId)}
            onQuantityChange={(itemId, qty) => onQuantityChange(building.id, itemId, qty)}
            onUpdateItem={(itemId, field, value) => onUpdateItem(building.id, itemId, field, value)}
            onRegenerate={onRegenerateBuildingSelection}
            materialsSubtotal={materials.materialsSubtotal}
            aiReasoning={materials.aiReasoning}
            warnings={materials.warnings}
            showCollapsibleHeader={!isSingleBuilding}
          />
        );
      })}

      <JobLevelSection {...jobLevelProps} />

      <button
        onClick={onGenerateEstimate}
        disabled={isDisabled}
        className="w-full py-3 md:py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        <Calculator className="w-5 h-5" />
        Generate Estimate →
      </button>
    </div>
  );
}
