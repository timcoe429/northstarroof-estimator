'use client';

import React from 'react';
import { Check, Loader2, Circle } from 'lucide-react';
import { ROOF_SYSTEM_LABELS } from '@/types';
import type { RoofSystemType } from '@/types';

type BuildingLike = {
  id: string;
  name: string;
  roofSystem: RoofSystemType | '';
};

interface BuildingProgressProps {
  buildings: BuildingLike[];
  completedBuildingIds: string[];
  currentBuildingId: string | null;
  isRunning: boolean;
}

function getRoofSystemLabel(roofSystem: RoofSystemType | ''): string {
  if (!roofSystem) return '—';
  return ROOF_SYSTEM_LABELS[roofSystem] ?? roofSystem;
}

export function BuildingProgress({
  buildings,
  completedBuildingIds,
  currentBuildingId,
  isRunning,
}: BuildingProgressProps) {
  const allCompleted = buildings.length > 0 && buildings.every((b) => completedBuildingIds.includes(b.id));
  if (!isRunning && allCompleted) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
      <p className="text-sm font-medium text-gray-700 mb-2">Generating materials...</p>
      <ul className="space-y-1.5">
        {buildings.map((b) => {
          const isCompleted = completedBuildingIds.includes(b.id);
          const isCurrent = currentBuildingId === b.id;
          const label = getRoofSystemLabel(b.roofSystem);

          return (
            <li key={b.id} className="flex items-center gap-2 text-sm">
              {isCompleted && <Check className="w-4 h-4 text-green-600 flex-shrink-0" />}
              {isCurrent && <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />}
              {!isCompleted && !isCurrent && <Circle className="w-4 h-4 text-gray-400 flex-shrink-0" />}
              <span className={isCompleted ? 'text-gray-700' : isCurrent ? 'text-gray-900 font-medium' : 'text-gray-500'}>
                {b.name} ({label})
                {isCurrent && '...'}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
