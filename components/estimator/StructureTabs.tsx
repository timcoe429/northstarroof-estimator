'use client';

import React from 'react';
import type { EstimateStructure } from '@/types';

interface StructureTabsProps {
  structures: EstimateStructure[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function StructureTabs({ structures, activeTab, onTabChange }: StructureTabsProps) {
  const tabs = [
    { id: 'combined', label: 'All Combined' },
    ...structures.map((s) => ({
      id: s.id,
      label: `${s.name} (${(s.measurements?.total_squares ?? 0).toFixed(1)} SQ)`,
    })),
  ];

  return (
    <div className="overflow-x-auto">
      <div className="flex flex-nowrap gap-1 min-w-0 border-b border-gray-200 pb-px">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
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
