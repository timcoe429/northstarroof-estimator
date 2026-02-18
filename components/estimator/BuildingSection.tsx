'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import { ROOF_SYSTEM_LABELS } from '@/types';
import { formatCurrency } from '@/lib/estimatorUtils';
import type { RoofSystemType } from '@/types';
import type { SelectableItem } from '@/types/estimator';

type BuildingLike = {
  id: string;
  name: string;
  roofSystem: RoofSystemType | '';
  measurements: { total_squares?: number | null };
};

interface BuildingSectionProps {
  building: BuildingLike;
  isExpanded: boolean;
  onToggleExpanded: (id: string) => void;
  selectedItems: string[];
  itemQuantities: Record<string, number>;
  allSelectableItems: SelectableItem[];
  onToggleSelection: (itemId: string) => void;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onUpdateItem: (itemId: string, field: string, value: unknown) => void;
  sectionHeaders?: Record<string, string>;
  aiReasoning?: string;
  warnings?: string[];
  onRegenerate: (buildingId: string) => void;
  materialsSubtotal: number;
  showCollapsibleHeader?: boolean;
}

function getRoofSystemLabel(roofSystem: RoofSystemType | ''): string {
  if (!roofSystem) return '—';
  return ROOF_SYSTEM_LABELS[roofSystem] ?? roofSystem;
}

export function BuildingSection({
  building,
  isExpanded,
  onToggleExpanded,
  selectedItems,
  itemQuantities,
  allSelectableItems,
  onRegenerate,
  materialsSubtotal,
  aiReasoning,
  sectionHeaders,
  showCollapsibleHeader = true,
}: BuildingSectionProps) {
  const [aiNotesExpanded, setAiNotesExpanded] = useState(false);

  const roofLabel = getRoofSystemLabel(building.roofSystem);
  const squares = building.measurements?.total_squares ?? 0;
  const materialsHeader = sectionHeaders?.materials ?? 'MATERIALS';

  const itemMap = new Map(allSelectableItems.map((i) => [i.id, i]));
  const materialsItems = selectedItems
    .map((id) => itemMap.get(id))
    .filter((i): i is SelectableItem => i != null && i.category === 'materials');

  const headerContent = (
    <div
      className={`flex items-center gap-2 cursor-pointer select-none ${showCollapsibleHeader ? 'py-3 px-4' : ''}`}
      onClick={() => showCollapsibleHeader && onToggleExpanded(building.id)}
    >
      {showCollapsibleHeader && (
        isExpanded ? (
          <ChevronDown className="w-5 h-5 text-white flex-shrink-0" />
        ) : (
          <ChevronRight className="w-5 h-5 text-white flex-shrink-0" />
        )
      )}
      <div className="flex-1 min-w-0">
        <span className="font-semibold text-white">
          {building.name} — {roofLabel}
        </span>
        {squares > 0 && (
          <span className="text-white/90 ml-2">
            ({squares} SQ)
          </span>
        )}
      </div>
      <span className="font-semibold text-white tabular-nums">
        {formatCurrency(materialsSubtotal)}
      </span>
    </div>
  );

  const bodyContent = (
    <div className="p-4 space-y-4">
      {(aiReasoning || onRegenerate) && (
        <div className="flex items-center gap-2">
          {aiReasoning && (
            <button
              type="button"
              onClick={() => setAiNotesExpanded(!aiNotesExpanded)}
              className="text-sm px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50"
            >
              {aiNotesExpanded ? '▾' : '▸'} AI Notes
            </button>
          )}
          {onRegenerate && (
            <button
              type="button"
              onClick={() => onRegenerate(building.id)}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Regenerate
            </button>
          )}
        </div>
      )}

      {aiReasoning && aiNotesExpanded && (
        <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
          {aiReasoning}
        </div>
      )}

      <div>
        <h4 className="text-sm font-semibold uppercase tracking-wide text-[#00293f] mb-2">
          {materialsHeader}
        </h4>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-2 px-3 font-medium text-gray-700">Item</th>
                <th className="text-right py-2 px-3 font-medium text-gray-700 w-16">Qty</th>
                <th className="text-right py-2 px-3 font-medium text-gray-700 w-24">Price</th>
                <th className="text-right py-2 px-3 font-medium text-gray-700 w-24">Total</th>
              </tr>
            </thead>
            <tbody>
              {materialsItems.map((item) => {
                const qty = itemQuantities[item.id] ?? 0;
                const total = qty * item.price;
                return (
                  <tr key={item.id} className="border-t border-gray-100">
                    <td className="py-2 px-3 text-gray-900">{item.name}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{qty}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{formatCurrency(item.price)}</td>
                    <td className="py-2 px-3 text-right tabular-nums font-medium">{formatCurrency(total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end text-sm font-semibold text-gray-700">
        Building Materials Subtotal: {formatCurrency(materialsSubtotal)}
      </div>
    </div>
  );

  if (!showCollapsibleHeader) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="bg-[#00293f] px-4 py-3 flex items-center justify-between">
          <span className="font-semibold text-white">
            {building.name} — {roofLabel}
            {squares > 0 && ` (${squares} SQ)`}
          </span>
          <span className="font-semibold text-white tabular-nums">{formatCurrency(materialsSubtotal)}</span>
        </div>
        {bodyContent}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div
        className="bg-[#00293f]"
        role="button"
        tabIndex={0}
        onClick={() => onToggleExpanded(building.id)}
        onKeyDown={(e) => e.key === 'Enter' && onToggleExpanded(building.id)}
      >
        {headerContent}
      </div>
      {isExpanded && bodyContent}
    </div>
  );
}
