'use client'

import React from 'react';
import { Check, Upload, FileText, X, Calculator } from 'lucide-react';
import type { Measurements, CustomerInfo, VendorQuote, VendorQuoteItem } from '@/types';
import type { QuickSelectOption } from '@/types/estimator';
import { formatCurrency, formatVendorName, removeKeywordFromDescription } from '@/lib/estimatorUtils';

interface ReviewStepProps {
  /** Extracted measurements */
  measurements: Measurements;
  /** Customer information */
  customerInfo: CustomerInfo;
  /** Set of uploaded image types */
  uploadedImages: Set<string>;
  /** Vendor quotes */
  vendorQuotes: VendorQuote[];
  /** Vendor quote items */
  vendorQuoteItems: VendorQuoteItem[];
  /** Whether vendor quote is being extracted */
  isExtractingVendorQuote: boolean;
  /** Job description text */
  jobDescription: string;
  /** Quick selection options */
  quickSelections: QuickSelectOption[];
  /** Smart selection reasoning */
  smartSelectionReasoning: string;
  /** Smart selection warnings */
  smartSelectionWarnings: string[];
  /** Whether smart selection is being generated */
  isGeneratingSelection: boolean;
  /** Number of selectable items */
  allSelectableItemsLength: number;
  /** Callback to update customer info */
  onCustomerInfoChange: (field: keyof CustomerInfo, value: string) => void;
  /** Callback to reset estimator */
  onReset: () => void;
  /** Callback for vendor quote upload */
  onVendorQuoteUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Callback to remove vendor quote */
  onRemoveVendorQuote: (quoteId: string) => void;
  /** Callback to update job description */
  onJobDescriptionChange: (value: string) => void;
  /** Callback to toggle quick selection */
  onToggleQuickSelection: (optionId: string) => void;
  /** Callback to generate smart selection */
  onGenerateSmartSelection: () => void;
}

/**
 * Review step component for reviewing measurements, customer info, and job description.
 * Includes vendor quote upload, quick selections, and smart selection generation.
 */
export function ReviewStep({
  measurements,
  customerInfo,
  uploadedImages,
  vendorQuotes,
  vendorQuoteItems,
  isExtractingVendorQuote,
  jobDescription,
  quickSelections,
  smartSelectionReasoning,
  smartSelectionWarnings,
  isGeneratingSelection,
  allSelectableItemsLength,
  onCustomerInfoChange,
  onReset,
  onVendorQuoteUpload,
  onRemoveVendorQuote,
  onJobDescriptionChange,
  onToggleQuickSelection,
  onGenerateSmartSelection,
}: ReviewStepProps) {
  return (
    <div className="bg-white rounded-2xl p-4 md:p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-gray-900">Roof Measurements</h2>
          {/* Upload indicators */}
          <div className="flex items-center gap-2">
            {uploadedImages.has('summary') && (
              <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                <Check className="w-3 h-3" />
                RoofScope Summary
              </span>
            )}
            {uploadedImages.has('analysis') && (
              <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                <Check className="w-3 h-3" />
                Roof Area Analysis
              </span>
            )}
          </div>
        </div>
        <button onClick={onReset} className="text-xs md:text-sm text-gray-500 hover:text-gray-700">
          Upload Different
        </button>
      </div>

      {/* Hint for additional image */}
      {uploadedImages.has('summary') && !uploadedImages.has('analysis') && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700 flex items-center gap-2">
            <Upload className="w-4 h-4" />
            <span>Paste your <strong>Roof Area Analysis</strong> image to extract slope breakdown (steep vs standard squares)</span>
          </p>
        </div>
      )}

      {/* Vendor Quote Upload */}
      <div
        onClick={() => document.getElementById('vendor-quote-upload')?.click()}
        className="border-2 border-dashed border-gray-200 rounded-2xl p-4 md:p-6 bg-white hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer mb-4"
      >
        <input
          type="file"
          accept="application/pdf,.pdf"
          multiple
          onChange={onVendorQuoteUpload}
          className="hidden"
          id="vendor-quote-upload"
        />
        <div className="text-center">
          <div className="w-12 h-12 md:w-14 md:h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <FileText className="w-6 h-6 md:w-7 md:h-7 text-blue-600" />
          </div>
          <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-1">
            Upload Vendor Quotes
          </h3>
          <p className="text-gray-500 mb-2 text-sm">
            Optional - Schafer, TRA, Rocky Mountain
          </p>
          {isExtractingVendorQuote && (
            <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              Extracting quote...
            </div>
          )}
        </div>

        {vendorQuotes.length > 0 && (
          <div className="mt-3 space-y-2">
            {vendorQuotes.map((quote) => {
              const itemCount = vendorQuoteItems.filter(item => item.vendor_quote_id === quote.id).length;
              return (
                <div key={quote.id} className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-gray-900 truncate">
                      {formatVendorName(quote.vendor)} {quote.quote_number ? `• ${quote.quote_number}` : ''}
                    </div>
                    <div className="text-xs text-gray-500">
                      {itemCount} items • {formatCurrency(quote.total > 0 ? quote.total : (quote.subtotal > 0 ? quote.subtotal : 0))}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveVendorQuote(quote.id);
                    }}
                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                    title="Remove quote"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Customer Info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6 p-3 md:p-4 bg-gray-50 rounded-xl">
        <input
          type="text"
          value={customerInfo.name}
          onChange={(e) => onCustomerInfoChange('name', e.target.value)}
          placeholder="Customer Name"
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
        />
        <input
          type="text"
          value={customerInfo.address}
          onChange={(e) => onCustomerInfoChange('address', e.target.value)}
          placeholder="Address"
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
        />
        <input
          type="text"
          value={customerInfo.phone}
          onChange={(e) => onCustomerInfoChange('phone', e.target.value)}
          placeholder="Phone"
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
        />
      </div>

      {/* Quick Selection Options */}
      {quickSelections.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-gray-200 mb-4 md:mb-6">
          <h3 className="font-medium text-gray-900 mb-3 text-sm">Quick Options</h3>
          <div className="flex flex-wrap gap-2">
            {quickSelections.map(option => (
              <button
                key={option.id}
                onClick={() => onToggleQuickSelection(option.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  option.selected
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Measurements Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4">
        {[
          { key: 'total_squares', label: 'Squares', unit: 'sq' },
          { key: 'predominant_pitch', label: 'Pitch', unit: '' },
          { key: 'ridge_length', label: 'Ridge', unit: 'ft' },
          { key: 'hip_length', label: 'Hips', unit: 'ft' },
          { key: 'valley_length', label: 'Valleys', unit: 'ft' },
          { key: 'eave_length', label: 'Eaves', unit: 'ft' },
          { key: 'rake_length', label: 'Rakes', unit: 'ft' },
          { key: 'penetrations', label: 'Penetrations', unit: '' },
        ].map(({ key, label, unit }) => (
          <div key={key} className="bg-gray-50 rounded-lg p-2 md:p-3">
            <div className="text-xs text-gray-500">{label}</div>
            <div className="text-lg md:text-xl font-bold">
              {measurements[key]} <span className="text-xs md:text-sm font-normal text-gray-400">{unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Job Description and Smart Selection */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900">Job Description</h3>
        <input
          type="text"
          value={jobDescription}
          onChange={(e) => onJobDescriptionChange(e.target.value)}
          placeholder="Describe this job (e.g., 'Brava tile, tear-off, Hugo's crew, copper valleys')"
          className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm"
        />
        <button
          onClick={onGenerateSmartSelection}
          disabled={!jobDescription.trim() || allSelectableItemsLength === 0 || isGeneratingSelection}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg flex items-center justify-center gap-2 text-sm"
        >
          {isGeneratingSelection ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Generating Selection...
            </>
          ) : (
            <>
              <Calculator className="w-4 h-4" />
              Generate Smart Selection
            </>
          )}
        </button>
        {smartSelectionReasoning && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-medium text-blue-900 mb-1">AI Reasoning:</p>
            <p className="text-sm text-blue-700">{smartSelectionReasoning}</p>
          </div>
        )}
        {smartSelectionWarnings.length > 0 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm font-medium text-amber-900 mb-1">Warnings:</p>
            <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
              {smartSelectionWarnings.map((warning, idx) => (
                <li key={idx}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
