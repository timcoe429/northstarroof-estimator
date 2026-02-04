'use client'

import React from 'react';
import { Check, Plus, Calculator, AlertCircle } from 'lucide-react';
import type { PriceItem } from '@/types';
import type { SelectableItem, CustomItem } from '@/types/estimator';
import { CATEGORIES } from '@/lib/constants';
import { CollapsibleSection } from './CollapsibleSection';
import { ItemRow } from './ItemRow';

type CustomItemDraft = {
  category: PriceItem['category'];
  name: string;
  quantity: number;
  unit: string;
  price: number;
};

interface EstimateBuilderProps {
  /** All selectable items (price items + vendor items + custom items) */
  allSelectableItems: SelectableItem[];
  /** IDs of currently selected items */
  selectedItems: string[];
  /** Quantities for each item */
  itemQuantities: Record<string, number>;
  /** Collapsed state for each section */
  collapsedSections: Record<string, boolean>;
  /** Current custom item being drafted */
  customItemDraft: CustomItemDraft | null;
  /** Sort configuration for each section */
  sectionSort: Record<string, { key: 'name' | 'price' | 'total'; direction: 'asc' | 'desc' }>;
  /** Map of vendor items for checking Schafer quotes */
  vendorItemMap: Map<string, any>;
  /** Map of vendor quotes */
  vendorQuoteMap: Map<string, any>;
  /** Missing accessory items from Calculated Accessories */
  missingAccessoryItems?: string[];
  /** Calculated Accessories component to render */
  calculatedAccessories?: React.ReactNode;
  /** Callback to toggle item selection */
  onToggleSelection: (itemId: string, selected: boolean) => void;
  /** Callback to update item quantity */
  onQuantityChange: (itemId: string, quantity: number) => void;
  /** Callback to toggle section collapse */
  onToggleCollapse: (sectionKey: string) => void;
  /** Callback to start creating custom item */
  onStartCustomItem: (category: PriceItem['category']) => void;
  /** Callback to cancel custom item creation */
  onCancelCustomItem: () => void;
  /** Callback to add custom item */
  onAddCustomItem: () => void;
  /** Callback to update custom item draft */
  onUpdateCustomItemDraft: (updates: Partial<CustomItemDraft>) => void;
  /** Callback to toggle section sort */
  onToggleSectionSort: (category: string, key: 'name' | 'price' | 'total') => void;
  /** Callback to calculate estimate */
  onCalculateEstimate: () => void;
  /** Function to get sorted items for a category */
  getEstimateCategoryItems: (category: string) => SelectableItem[];
}

/**
 * Main estimate builder component with selected items green box and available items by category.
 * Handles item selection, quantity changes, custom items, and sorting.
 */
export function EstimateBuilder({
  allSelectableItems,
  selectedItems,
  itemQuantities,
  collapsedSections,
  customItemDraft,
  sectionSort,
  vendorItemMap,
  vendorQuoteMap,
  missingAccessoryItems = [],
  calculatedAccessories,
  onToggleSelection,
  onQuantityChange,
  onToggleCollapse,
  onStartCustomItem,
  onCancelCustomItem,
  onAddCustomItem,
  onUpdateCustomItemDraft,
  onToggleSectionSort,
  onCalculateEstimate,
  getEstimateCategoryItems,
}: EstimateBuilderProps) {
  // Helper to check if item is Schafer vendor item
  const isSchaferVendorItem = (itemId: string): boolean => {
    const vendorItem = vendorItemMap.get(itemId);
    if (!vendorItem) return false;
    const vendorQuote = vendorQuoteMap.get(vendorItem.vendor_quote_id);
    return vendorQuote?.vendor === 'schafer';
  };

  // Get quantity for an item
  const getItemQuantity = (itemId: string): number => {
    if (itemQuantities[itemId] !== undefined) {
      return itemQuantities[itemId];
    }
    const vendorItem = vendorItemMap.get(itemId);
    return vendorItem?.quantity ?? 0;
  };

  if (allSelectableItems.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-2xl">
        <p className="text-gray-500 mb-4 text-sm md:text-base">
          No items available. Add prices to start building your estimate.
        </p>
        <button
          onClick={() => {/* This would need to be passed as prop or use context */}}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm"
        >
          Add your prices first →
        </button>
      </div>
    );
  }

  const selectedItemsList = allSelectableItems.filter(item => selectedItems.includes(item.id));
  const selectedByCategory = Object.entries(CATEGORIES).map(([catKey, { label, icon: Icon }]) => {
    const items = selectedItemsList.filter(item => item.category === catKey);
    return { catKey, label, icon: Icon, items };
  }).filter(({ items }) => items.length > 0);

  return (
    <div className="space-y-6">
      {/* Selected Items - Green Box */}
      {selectedItemsList.length > 0 && (
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 md:p-6">
          <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Check className="w-5 h-5" />
            In This Estimate ({selectedItemsList.length})
          </h3>
          <div className="space-y-4">
            {selectedByCategory.map(({ catKey, label, icon: Icon, items }) => (
              <div key={catKey}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-[#00293f]" />
                  <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    {label}
                  </h4>
                </div>
                <div className="space-y-2">
                  {items.map(item => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      isSelected={true}
                      quantity={getItemQuantity(item.id)}
                      isSchaferVendorItem={isSchaferVendorItem(item.id)}
                      onToggleSelection={onToggleSelection}
                      onQuantityChange={onQuantityChange}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Items */}
      <div>
        <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-4">Available Items</h3>
        <div className="space-y-4">
          {Object.entries(CATEGORIES).map(([catKey, { label, icon: Icon }]) => {
            const allItems = getEstimateCategoryItems(catKey);
            const availableItems = allItems.filter(item => !selectedItems.includes(item.id));
            const isCollapsed = collapsedSections[catKey] ?? true;
            const itemCount = availableItems.length;

            if (availableItems.length === 0 && allItems.length === 0) {
              return null;
            }

            return (
              <div key={catKey}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <CollapsibleSection
                    sectionKey={catKey}
                    label={label}
                    icon={Icon}
                    itemCount={itemCount}
                    isCollapsed={isCollapsed}
                    onToggle={onToggleCollapse}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onStartCustomItem(catKey as PriceItem['category'])}
                      className="p-1 rounded text-gray-500 hover:bg-gray-100"
                      title="Add custom item"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    {(['name', 'price', 'total'] as const).map((key) => {
                      const sortState = sectionSort[catKey];
                      const isActive = sortState?.key === key;
                      const arrow = isActive ? (sortState.direction === 'desc' ? '↓' : '↑') : '';
                      return (
                        <button
                          key={key}
                          onClick={() => onToggleSectionSort(catKey, key)}
                          className={`text-xs px-2 py-1 rounded border transition-colors ${
                            isActive
                              ? 'bg-blue-500 text-white border-blue-500'
                              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {key === 'name' ? 'Name' : key === 'price' ? 'Price' : 'Total'} {arrow}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {customItemDraft?.category === catKey && (
                  <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                      <input
                        type="text"
                        value={customItemDraft.name}
                        onChange={(e) => onUpdateCustomItemDraft({ name: e.target.value })}
                        placeholder="Item name"
                        className="px-2 py-1 border border-gray-200 rounded text-sm"
                      />
                      <input
                        type="number"
                        value={customItemDraft.quantity}
                        onChange={(e) => onUpdateCustomItemDraft({ quantity: parseFloat(e.target.value) || 0 })}
                        placeholder="Qty"
                        className="px-2 py-1 border border-gray-200 rounded text-sm"
                      />
                      <input
                        type="text"
                        value={customItemDraft.unit}
                        onChange={(e) => onUpdateCustomItemDraft({ unit: e.target.value })}
                        placeholder="Unit"
                        className="px-2 py-1 border border-gray-200 rounded text-sm"
                      />
                      <input
                        type="number"
                        value={customItemDraft.price}
                        onChange={(e) => onUpdateCustomItemDraft({ price: parseFloat(e.target.value) || 0 })}
                        placeholder="Unit price"
                        className="px-2 py-1 border border-gray-200 rounded text-sm"
                      />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={onAddCustomItem}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm"
                      >
                        Add
                      </button>
                      <button
                        onClick={onCancelCustomItem}
                        className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {availableItems.length === 0 ? (
                  <div className="text-sm text-gray-400 py-3">
                    No available items in this section.
                  </div>
                ) : !isCollapsed ? (
                  <div className="space-y-2">
                    {availableItems.map(item => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        isSelected={false}
                        quantity={getItemQuantity(item.id)}
                        isSchaferVendorItem={isSchaferVendorItem(item.id)}
                        onToggleSelection={onToggleSelection}
                        onQuantityChange={onQuantityChange}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Calculated Accessories */}
      {calculatedAccessories}

      {/* Missing Price Items Warning */}
      {missingAccessoryItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 mb-1">Missing Price Items</p>
              <p className="text-xs text-amber-700">
                Add these items to your price list: {missingAccessoryItems.join(', ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Generate Button */}
      {allSelectableItems.length > 0 && (
        <button
          onClick={onCalculateEstimate}
          disabled={selectedItems.length === 0}
          className="w-full py-3 md:py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <Calculator className="w-5 h-5" />
          Generate Estimate ({selectedItems.length} items)
        </button>
      )}
    </div>
  );
}
