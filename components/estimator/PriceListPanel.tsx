'use client'

import React from 'react';
import { Plus, Upload, Bot } from 'lucide-react';
import type { PriceItem } from '@/types';
import { CATEGORIES } from '@/lib/constants';
import { PriceItemRow } from './PriceItemRow';

interface PriceListPanelProps {
  /** Currently active category tab */
  activeCategory: string;
  /** ID of item currently being edited */
  editingItem: string | null;
  /** Whether price sheet is currently processing */
  priceSheetProcessing: boolean;
  /** Whether descriptions are being generated */
  isGeneratingDescriptions: boolean;
  /** Generation progress for descriptions */
  generationProgress: { current: number; total: number } | null;
  /** Callback to set active category */
  onCategoryChange: (category: string) => void;
  /** Callback when edit button clicked */
  onEditItem: (itemId: string) => void;
  /** Callback when save button clicked in edit mode */
  onSaveItem: () => void;
  /** Callback to add new price item */
  onAddItem: () => void;
  /** Callback to delete price item */
  onDeleteItem: (itemId: string) => void;
  /** Callback to update price item */
  onUpdateItem: (itemId: string, updates: Partial<PriceItem>) => void;
  /** Callback for price sheet upload */
  onPriceSheetUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Callback to generate all descriptions */
  onGenerateDescriptions: () => void;
  /** Function to get items for a category */
  getPriceListItems: (category: string) => PriceItem[];
}

/**
 * Price list management panel with category tabs and item list.
 * Supports adding items manually, uploading price sheets, and generating descriptions with AI.
 */
export function PriceListPanel({
  activeCategory,
  editingItem,
  priceSheetProcessing,
  isGeneratingDescriptions,
  generationProgress,
  onCategoryChange,
  onEditItem,
  onSaveItem,
  onAddItem,
  onDeleteItem,
  onUpdateItem,
  onPriceSheetUpload,
  onGenerateDescriptions,
  getPriceListItems,
}: PriceListPanelProps) {
  const currentCategoryItems = getPriceListItems(activeCategory);
  const itemsWithoutDescriptions = currentCategoryItems.filter(item => !item.proposalDescription?.trim());

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="max-w-5xl mx-auto px-4 py-4 md:py-6">
        {/* Category Tabs - Scrollable on mobile */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
          {Object.entries(CATEGORIES).map(([key, { label, icon: Icon, color }]) => {
            const itemCount = getPriceListItems(key).length;
            return (
              <button
                key={key}
                onClick={() => onCategoryChange(key)}
                className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-lg font-medium transition-colors whitespace-nowrap text-sm ${
                  activeCategory === key
                    ? key === 'schafer'
                      ? 'bg-red-100 text-red-700 border-2 border-red-300'
                      : `bg-${color}-100 text-${color}-700 border-2 border-${color}-300`
                    : key === 'schafer'
                      ? 'bg-red-50 text-red-700 hover:bg-red-100'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={activeCategory === key ? {
                  backgroundColor: key === 'schafer'
                    ? '#dc2626'
                    : color === 'blue'
                      ? '#dbeafe'
                      : color === 'green'
                        ? '#dcfce7'
                        : color === 'orange'
                          ? '#ffedd5'
                          : '#f3e8ff',
                  color: key === 'schafer'
                    ? '#ffffff'
                    : color === 'blue'
                      ? '#1d4ed8'
                      : color === 'green'
                        ? '#15803d'
                        : color === 'orange'
                          ? '#c2410c'
                          : '#7e22ce',
                } : {}}
              >
                <Icon className="w-4 h-4" />
                {label} ({itemCount})
              </button>
            );
          })}
        </div>

        {/* Items List */}
        <div className="bg-gray-50 rounded-xl p-3 md:p-4 max-h-64 overflow-auto">
          {currentCategoryItems.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">
              No items yet. Paste a price sheet or add manually.
            </p>
          ) : (
            <div className="space-y-2">
              {currentCategoryItems.map(item => (
                <PriceItemRow
                  key={item.id}
                  item={item}
                  isEditing={editingItem === item.id}
                  isVendorItem={false}
                  onEdit={onEditItem}
                  onSave={onSaveItem}
                  onDelete={onDeleteItem}
                  onUpdate={onUpdateItem}
                />
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4">
          <button
            onClick={onAddItem}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>

          <input
            type="file"
            accept="image/*"
            onChange={onPriceSheetUpload}
            className="hidden"
            id="price-sheet-upload"
          />
          <label
            htmlFor="price-sheet-upload"
            className={`flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium cursor-pointer text-sm ${
              priceSheetProcessing ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            {priceSheetProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Extracting...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Paste or Upload Price Sheet
              </>
            )}
          </label>

          <button
            onClick={onGenerateDescriptions}
            disabled={isGeneratingDescriptions || itemsWithoutDescriptions.length === 0}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors text-sm"
          >
            <Bot className="w-4 h-4" />
            {isGeneratingDescriptions
              ? `Generating ${generationProgress?.current || 0} of ${generationProgress?.total || 0}...`
              : 'Generate Descriptions'
            }
          </button>
        </div>

        <p className="text-xs text-gray-400 mt-3 hidden sm:block">
          💡 Tip: Copy your price sheet and press <kbd className="px-1.5 py-0.5 bg-gray-200 rounded">Ctrl+V</kbd> to auto-extract
        </p>
      </div>
    </div>
  );
}
