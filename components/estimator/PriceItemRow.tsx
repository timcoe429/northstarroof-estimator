'use client'

import React from 'react';
import { Edit2, Trash2, Check } from 'lucide-react';
import type { PriceItem } from '@/types';
import { formatCurrency } from '@/lib/estimatorUtils';
import { UNIT_TYPES } from '@/lib/constants';

interface PriceItemRowProps {
  /** The price item to display/edit */
  item: PriceItem;
  /** Whether this item is currently being edited */
  isEditing: boolean;
  /** Whether this is a vendor item (cannot be deleted) */
  isVendorItem?: boolean;
  /** Callback when edit button is clicked */
  onEdit: (itemId: string) => void;
  /** Callback when save (check) button is clicked */
  onSave: () => void;
  /** Callback when delete button is clicked */
  onDelete: (itemId: string) => void;
  /** Callback when any field is updated */
  onUpdate: (itemId: string, updates: Partial<PriceItem>) => void;
}

/**
 * Individual price item row in the price list management panel.
 * Supports both display mode and inline edit mode with mobile-responsive layout.
 */
export function PriceItemRow({
  item,
  isEditing,
  isVendorItem = false,
  onEdit,
  onSave,
  onDelete,
  onUpdate,
}: PriceItemRowProps) {
  return (
    <div className="flex items-center gap-2 md:gap-3 bg-white rounded-lg p-2 md:p-3 border border-gray-200">
      {isEditing ? (
        <>
          {/* Desktop edit layout */}
          <div className="hidden md:flex flex-1 items-center gap-2">
            <input
              type="text"
              value={item.name}
              onChange={(e) => onUpdate(item.id, { name: e.target.value })}
              className="flex-1 px-2 py-1 border rounded"
              autoFocus
            />
            <select
              value={item.unit}
              onChange={(e) => onUpdate(item.id, { unit: e.target.value })}
              className="px-2 py-1 border rounded"
            >
              {UNIT_TYPES.map(u => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <span>$</span>
              <input
                type="number"
                value={item.price}
                onChange={(e) => onUpdate(item.id, { price: parseFloat(e.target.value) || 0 })}
                className="w-24 px-2 py-1 border rounded"
              />
            </div>
            {!isVendorItem && (
              <>
                <input
                  type="number"
                  value={item.coverage || ''}
                  onChange={(e) => onUpdate(item.id, { coverage: e.target.value ? parseFloat(e.target.value) : null })}
                  placeholder="Coverage"
                  className="w-20 px-2 py-1 border rounded text-sm"
                />
                <select
                  value={item.coverageUnit || ''}
                  onChange={(e) => onUpdate(item.id, { coverageUnit: e.target.value || null })}
                  className="px-2 py-1 border rounded text-sm"
                >
                  <option value="">Unit</option>
                  <option value="lf">lf</option>
                  <option value="sqft">sqft</option>
                  <option value="sq">sq</option>
                </select>
              </>
            )}
            <button
              onClick={onSave}
              className="p-1 text-green-600 hover:bg-green-50 rounded"
            >
              <Check className="w-4 h-4" />
            </button>
          </div>
          {!isVendorItem && (
            <div className="hidden md:block w-full mt-2">
              <label className="text-xs text-gray-600 block mb-1">Proposal Description (optional)</label>
              <textarea
                value={item.proposalDescription || ''}
                onChange={(e) => onUpdate(item.id, { proposalDescription: e.target.value || null })}
                placeholder="e.g., Install DaVinci Multi-Width Shake synthetic cedar shake roofing system per manufacturer specifications"
                className="w-full px-2 py-1 border rounded text-sm"
                rows={3}
              />
            </div>
          )}

          {/* Mobile edit layout */}
          <div className="md:hidden flex-1 flex flex-col gap-2">
            <input
              type="text"
              value={item.name}
              onChange={(e) => onUpdate(item.id, { name: e.target.value })}
              className="flex-1 px-2 py-1 border rounded text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <select
                value={item.unit}
                onChange={(e) => onUpdate(item.id, { unit: e.target.value })}
                className="px-2 py-1 border rounded text-sm"
              >
                {UNIT_TYPES.map(u => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <span className="text-sm">$</span>
                <input
                  type="number"
                  value={item.price}
                  onChange={(e) => onUpdate(item.id, { price: parseFloat(e.target.value) || 0 })}
                  className="w-20 px-2 py-1 border rounded text-sm"
                />
              </div>
              <button
                onClick={onSave}
                className="p-1 text-green-600 hover:bg-green-50 rounded"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
            {!isVendorItem && (
              <>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={item.coverage || ''}
                    onChange={(e) => onUpdate(item.id, { coverage: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="Coverage"
                    className="flex-1 px-2 py-1 border rounded text-sm"
                  />
                  <select
                    value={item.coverageUnit || ''}
                    onChange={(e) => onUpdate(item.id, { coverageUnit: e.target.value || null })}
                    className="px-2 py-1 border rounded text-sm"
                  >
                    <option value="">Unit</option>
                    <option value="lf">lf</option>
                    <option value="sqft">sqft</option>
                    <option value="sq">sq</option>
                  </select>
                </div>
                <div className="w-full mt-2">
                  <label className="text-xs text-gray-600 block mb-1">Proposal Description (optional)</label>
                  <textarea
                    value={item.proposalDescription || ''}
                    onChange={(e) => onUpdate(item.id, { proposalDescription: e.target.value || null })}
                    placeholder="e.g., Install DaVinci Multi-Width Shake synthetic cedar shake roofing system per manufacturer specifications"
                    className="w-full px-2 py-1 border rounded text-sm"
                    rows={3}
                  />
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Display mode */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium text-sm md:text-base truncate">{item.name}</span>
              {isVendorItem && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">
                  Vendor
                </span>
              )}
            </div>
          </div>
          <span className="text-gray-400 text-sm hidden md:inline">{item.unit}</span>
          <span className="font-semibold text-sm md:text-base">{formatCurrency(item.price)}</span>
          {!isVendorItem && item.coverage && item.coverageUnit && (
            <span className="text-gray-400 text-xs hidden md:inline">
              ({item.coverage} {item.coverageUnit})
            </span>
          )}
          <button
            onClick={() => onEdit(item.id)}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          {!isVendorItem && (
            <button
              onClick={() => onDelete(item.id)}
              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
