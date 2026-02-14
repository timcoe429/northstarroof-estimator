'use client'

import React from 'react';
import type { BuildingEstimate } from '@/types';

interface BuildingTabsProps {
  buildings: BuildingEstimate[];
  activeIndex: number; // -1 = All Combined, 0+ = building index
  onTabChange: (index: number) => void;
}

/**
 * Tab bar for switching between All Combined view and per-building views.
 */
export function BuildingTabs({ buildings, activeIndex, onTabChange }: BuildingTabsProps) {
  const tabs = [
    { index: -1, label: 'All Combined' },
    ...buildings.map((b, i) => ({
      index: i,
      label: `${b.structureName} (${(b.measurements?.total_squares ?? 0).toFixed(1)} SQ)`,
    })),
  ];

  return (
    <div className="overflow-x-auto">
      <div className="flex flex-nowrap gap-1 min-w-0 border-b border-gray-200 pb-px">
        {tabs.map((tab) => {
          const isActive = activeIndex === tab.index;
          return (
            <button
              key={tab.index}
              type="button"
              onClick={() => onTabChange(tab.index)}
              className={`flex-shrink-0 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                isActive
                  ? 'text-[#00293f] border-[#00293f]'
                  : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
