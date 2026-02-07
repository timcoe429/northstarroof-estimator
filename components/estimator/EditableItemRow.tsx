'use client'

import React, { useState, useRef, useEffect } from 'react';
import { Pencil, RotateCcw } from 'lucide-react';
import type { LineItem } from '@/types';
import { formatCurrency } from '@/lib/estimatorUtils';
import { UNIT_TYPES } from '@/lib/constants';

interface EditableItemRowProps {
  /** The line item to display */
  item: LineItem;
  /** Manual override flags */
  manualOverrides?: {
    quantity?: boolean;
    price?: boolean;
    name?: boolean;
  };
  /** Whether this is a Schafer vendor quote item (read-only) */
  isSchaferVendorItem?: boolean;
  /** Callback when item is updated */
  onUpdateItem: (itemId: string, field: 'name' | 'quantity' | 'price' | 'unit', value: string | number) => void;
  /** Callback to reset manual override */
  onResetOverride: (itemId: string, field: 'quantity' | 'price' | 'name') => void;
  /** Callback to deselect this item from estimate */
  onDeselect?: () => void;
}

/**
 * Editable item row for estimate builder's selected items.
 * Supports inline editing with visual indicators for manual overrides.
 */
export function EditableItemRow({
  item,
  manualOverrides = {},
  isSchaferVendorItem = false,
  onUpdateItem,
  onResetOverride,
  onDeselect,
}: EditableItemRowProps) {
  const [editingField, setEditingField] = useState<'name' | 'quantity' | 'price' | 'unit' | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);

  // Start editing a field
  const startEditing = (field: 'name' | 'quantity' | 'price' | 'unit') => {
    if (isSchaferVendorItem && (field === 'quantity' || field === 'price')) {
      return; // Can't edit Schafer vendor items
    }
    setEditingField(field);
    if (field === 'name') {
      setEditValue(item.name);
    } else if (field === 'quantity') {
      setEditValue(item.quantity.toString());
    } else if (field === 'price') {
      setEditValue(item.price.toString());
    } else if (field === 'unit') {
      setEditValue(item.unit);
    }
  };

  // Save edit
  const saveEdit = () => {
    if (!editingField) return;

    if (editingField === 'name') {
      onUpdateItem(item.id, 'name', editValue.trim());
    } else if (editingField === 'quantity') {
      const numValue = parseFloat(editValue) || 0;
      onUpdateItem(item.id, 'quantity', numValue);
    } else if (editingField === 'price') {
      const numValue = parseFloat(editValue) || 0;
      onUpdateItem(item.id, 'price', numValue);
    } else if (editingField === 'unit') {
      onUpdateItem(item.id, 'unit', editValue);
    }

    setEditingField(null);
    setEditValue('');
  };

  // Cancel edit
  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  // Focus input when editing starts
  useEffect(() => {
    if (editingField === 'name' && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    } else if (editingField === 'quantity' && quantityInputRef.current) {
      quantityInputRef.current.focus();
      quantityInputRef.current.select();
    } else if (editingField === 'price' && priceInputRef.current) {
      priceInputRef.current.focus();
      priceInputRef.current.select();
    }
  }, [editingField]);

  const hasOverride = (field: 'quantity' | 'price' | 'name') => {
    return manualOverrides?.[field] === true;
  };

  const getOverrideClass = (field: 'quantity' | 'price' | 'name') => {
    return hasOverride(field) ? 'bg-yellow-50 border-yellow-300' : '';
  };

  return (
    <div className={`p-3 rounded-lg border-2 transition-colors ${getOverrideClass('name')} border-green-300 bg-green-50`}>
      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        {/* Deselect Checkbox */}
        {onDeselect && (
          <input
            type="checkbox"
            checked={true}
            onChange={() => onDeselect()}
            className="w-5 h-5 rounded flex-shrink-0"
          />
        )}
        {/* Item Name */}
        <div className={`flex-1 min-w-[120px] ${getOverrideClass('name')} rounded px-2 py-1`}>
          {editingField === 'name' ? (
            <div className="flex items-center gap-1">
              <input
                ref={nameInputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={handleKeyPress}
                className="flex-1 px-1 py-0.5 border border-gray-300 rounded text-sm"
              />
            </div>
          ) : (
            <div
              className="flex items-center gap-1 group cursor-pointer"
              onClick={() => startEditing('name')}
              title="Click to edit name"
            >
              <span className="font-medium">{item.name}</span>
              <Pencil className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              {hasOverride('name') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onResetOverride(item.id, 'name');
                  }}
                  className="ml-1 text-yellow-600 hover:text-yellow-800"
                  title="Reset to original"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Quantity */}
        <div className={`${getOverrideClass('quantity')} rounded`}>
          {editingField === 'quantity' ? (
            <input
              ref={quantityInputRef}
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={handleKeyPress}
              disabled={isSchaferVendorItem}
              className="w-20 px-2 py-1 border border-gray-300 rounded text-center text-sm"
            />
          ) : (
            <div
              className={`flex items-center gap-1 group ${isSchaferVendorItem ? '' : 'cursor-pointer'}`}
              onClick={() => !isSchaferVendorItem && startEditing('quantity')}
              title={isSchaferVendorItem ? 'Quantity from Schafer quote - cannot be edited' : 'Click to edit quantity'}
            >
              <span className="w-20 px-2 py-1 text-center text-sm">{item.quantity}</span>
              {!isSchaferVendorItem && (
                <>
                  <Pencil className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  {hasOverride('quantity') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onResetOverride(item.id, 'quantity');
                      }}
                      className="text-yellow-600 hover:text-yellow-800"
                      title="Reset to calculated value"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Unit */}
        <div>
          {editingField === 'unit' ? (
            <select
              value={editValue}
              onChange={(e) => {
                setEditValue(e.target.value);
                onUpdateItem(item.id, 'unit', e.target.value);
                setEditingField(null);
              }}
              onBlur={() => setEditingField(null)}
              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
            >
              {UNIT_TYPES.map((unit) => (
                <option key={unit.value} value={unit.value}>
                  {unit.value}
                </option>
              ))}
            </select>
          ) : (
            <span
              className="text-gray-400 text-sm w-14 cursor-pointer hover:text-gray-600"
              onClick={() => !isSchaferVendorItem && startEditing('unit')}
              title={isSchaferVendorItem ? '' : 'Click to change unit'}
            >
              {item.unit}
            </span>
          )}
        </div>

        <span className="text-gray-400">×</span>

        {/* Price */}
        <div className={`${getOverrideClass('price')} rounded`}>
          {editingField === 'price' ? (
            <input
              ref={priceInputRef}
              type="number"
              step="0.01"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={handleKeyPress}
              disabled={isSchaferVendorItem}
              className="w-24 px-2 py-1 border border-gray-300 rounded text-right text-sm"
            />
          ) : (
            <div
              className={`flex items-center gap-1 group ${isSchaferVendorItem ? '' : 'cursor-pointer'}`}
              onClick={() => !isSchaferVendorItem && startEditing('price')}
              title={isSchaferVendorItem ? 'Price from Schafer quote - cannot be edited' : 'Click to edit price'}
            >
              <span className="w-24 text-right text-sm">{formatCurrency(item.price)}</span>
              {!isSchaferVendorItem && (
                <>
                  <Pencil className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  {hasOverride('price') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onResetOverride(item.id, 'price');
                      }}
                      className="text-yellow-600 hover:text-yellow-800"
                      title="Reset to original price"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <span className="text-gray-400">=</span>

        {/* Total (read-only) */}
        <span className="w-28 text-right font-semibold text-blue-600">
          {formatCurrency(item.total)}
        </span>
      </div>
    </div>
  );
}
