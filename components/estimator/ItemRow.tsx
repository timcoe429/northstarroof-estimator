'use client'

import React from 'react';
import type { SelectableItem } from '@/types/estimator';
import { formatCurrency } from '@/lib/estimatorUtils';

interface ItemRowProps {
  /** The item to display */
  item: SelectableItem;
  /** Whether this item is currently selected */
  isSelected: boolean;
  /** Current quantity for this item */
  quantity: number;
  /** Whether this is a Schafer vendor quote item (read-only) */
  isSchaferVendorItem?: boolean;
  /** Callback when checkbox is toggled */
  onToggleSelection: (itemId: string, selected: boolean) => void;
  /** Callback when quantity changes */
  onQuantityChange: (itemId: string, quantity: number) => void;
}

/**
 * Individual item row in the estimate builder.
 * Shows checkbox, name with badges, quantity input, unit, price, and calculated total.
 * Quantity is read-only for Schafer vendor quote items.
 */
export function ItemRow({
  item,
  isSelected,
  quantity,
  isSchaferVendorItem = false,
  onToggleSelection,
  onQuantityChange,
}: ItemRowProps) {
  const isVendorItem = item.isVendorItem === true;
  const isCustomItem = item.isCustomItem === true;
  const isSchaferItem = item.category === 'schafer' && !isVendorItem;

  return (
    <div
      className={`p-3 rounded-lg border-2 transition-colors ${
        isSelected ? 'border-blue-300 bg-blue-50' : 'border-gray-100 bg-gray-50'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onToggleSelection(item.id, e.target.checked)}
          className="w-5 h-5 rounded flex-shrink-0"
        />
        <div className="flex-1 min-w-[120px]">
          <div className="flex items-center gap-2">
            <span className="font-medium">{item.name}</span>
            {isVendorItem && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                isSchaferVendorItem
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {isSchaferVendorItem ? 'Schafer Quote' : 'Vendor'}
              </span>
            )}
            {isSchaferItem && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                Schafer
              </span>
            )}
            {isCustomItem && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                Custom
              </span>
            )}
          </div>
        </div>
        <input
          type="number"
          value={quantity}
          onChange={(e) => {
            if (!isSchaferVendorItem) {
              onQuantityChange(item.id, parseFloat(e.target.value) || 0);
            }
          }}
          disabled={isSchaferVendorItem}
          className={`w-20 px-2 py-1 border border-gray-200 rounded text-center ${
            isSchaferVendorItem ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''
          }`}
          title={isSchaferVendorItem ? 'Quantity from Schafer quote - cannot be edited' : ''}
        />
        <span className="text-gray-400 text-sm w-14">{item.unit}</span>
        <span className="text-gray-400">×</span>
        <span className={`w-24 text-right ${isSchaferVendorItem ? 'font-semibold' : ''}`}>
          {formatCurrency(item.price)}
        </span>
        <span className="text-gray-400">=</span>
        <span className="w-28 text-right font-semibold text-blue-600">
          {formatCurrency(quantity * item.price)}
        </span>
      </div>
    </div>
  );
}
