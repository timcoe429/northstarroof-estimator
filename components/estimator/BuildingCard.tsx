'use client';

import React from 'react';
import { X } from 'lucide-react';
import type {
  BuildingQuickOptions,
  Measurements,
  RoofSystemType,
} from '@/types';
import { ROOF_SYSTEM_LABELS } from '@/types';
import type { BuildingEstimateState } from '@/hooks/useBuildings';

const QUICK_OPTION_LABELS: Record<keyof BuildingQuickOptions, string> = {
  tearOff: 'Tear-Off',
  replaceOSB: 'Replace OSB',
  steepPitch: 'Steep Pitch',
  overnightRequired: 'Overnight',
  complexAccess: 'Complex',
};

const ROOF_SYSTEM_OPTIONS = Object.keys(ROOF_SYSTEM_LABELS) as RoofSystemType[];

interface BuildingCardProps {
  building: BuildingEstimateState;
  onUpdateRoofSystem: (id: string, roofSystem: RoofSystemType) => void;
  onUpdateQuickOption: (
    id: string,
    option: keyof BuildingQuickOptions,
    value: boolean
  ) => void;
  onUpdateMeasurements: (id: string, measurements: Measurements) => void;
  onRemoveBuilding: (id: string) => void;
  showRemoveButton: boolean;
}

export function BuildingCard({
  building,
  onUpdateRoofSystem,
  onUpdateQuickOption,
  onRemoveBuilding,
  showRemoveButton,
}: BuildingCardProps) {
  const m = building.measurements;
  const parts: string[] = [];
  if (m.total_squares != null) parts.push(`${m.total_squares} SQ`);
  if (m.predominant_pitch)
    parts.push(`${m.predominant_pitch} pitch`);
  if (m.eave_length != null) parts.push(`Eave: ${m.eave_length} LF`);
  if (m.valley_length != null) parts.push(`Valley: ${m.valley_length} LF`);
  if (m.ridge_length != null) parts.push(`Ridge: ${m.ridge_length} LF`);
  if (m.rake_length != null) parts.push(`Rake: ${m.rake_length} LF`);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 md:p-4">
      {/* Row 1: Name, measurements, remove */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-gray-900 truncate">{building.name}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {parts.length > 0 ? parts.join('  •  ') : 'No measurements'}
          </div>
        </div>
        {showRemoveButton && (
          <button
            onClick={() => onRemoveBuilding(building.id)}
            className="p-1.5 text-gray-400 hover:text-[#B1000F] hover:bg-red-50 rounded transition-colors"
            title="Remove building"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Row 2: Roof system dropdown */}
      <div className="mb-2">
        <select
          value={building.roofSystem || ''}
          onChange={(e) => {
            const v = e.target.value as RoofSystemType | '';
            if (v) onUpdateRoofSystem(building.id, v);
          }}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
        >
          <option value="">Select roof system...</option>
          {ROOF_SYSTEM_OPTIONS.map((key) => (
            <option key={key} value={key}>
              {ROOF_SYSTEM_LABELS[key]}
            </option>
          ))}
        </select>
      </div>

      {/* Row 3: Quick option pills */}
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(QUICK_OPTION_LABELS) as (keyof BuildingQuickOptions)[]).map(
          (opt) => {
            const isOn = building.quickOptions[opt];
            return (
              <button
                key={opt}
                onClick={() =>
                  onUpdateQuickOption(building.id, opt, !building.quickOptions[opt])
                }
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  isOn
                    ? 'bg-[#00293f] text-white'
                    : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {QUICK_OPTION_LABELS[opt]}
                {opt === 'steepPitch' && isOn ? ' ✓' : ''}
              </button>
            );
          }
        )}
      </div>
    </div>
  );
}
