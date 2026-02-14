'use client'

import React from 'react';
import { Upload, FileText, X, Check, Edit2, ChevronRight } from 'lucide-react';
import type { Measurements, CustomerInfo, VendorQuote, VendorQuoteItem, EstimateStructure } from '@/types';
import { formatCurrency, formatVendorName } from '@/lib/estimatorUtils';
import { ROOF_SYSTEM_OPTIONS } from '@/lib/roofSystemConstants';

interface SetupStepProps {
  /** Extracted measurements (used when no structures detected) */
  measurements: Measurements | null;
  /** Customer information */
  customerInfo: CustomerInfo;
  /** Set of uploaded image types */
  uploadedImages: Set<string>;
  /** Structures from AI detection (or default single structure) */
  structures: EstimateStructure[];
  /** Per-structure roof system selection */
  structureRoofSystems: Record<string, string>;
  /** Callback when user changes roof system for a structure */
  onStructureRoofSystemChange: (structureId: string, roofSystem: string) => void;
  /** Vendor quotes */
  vendorQuotes: VendorQuote[];
  /** Vendor quote items */
  vendorQuoteItems: VendorQuoteItem[];
  /** Whether vendor quote is being extracted */
  isExtractingVendorQuote: boolean;
  /** Job description text */
  jobDescription: string;
  /** Callback to update customer info */
  onCustomerInfoChange: (field: keyof CustomerInfo, value: string) => void;
  /** Callback for job description change */
  onJobDescriptionChange: (value: string) => void;
  /** Callback to reset estimator */
  onReset: () => void;
  /** Callback for vendor quote upload */
  onVendorQuoteUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Callback to remove vendor quote */
  onRemoveVendorQuote: (quoteId: string) => void;
  /** Callback when user clicks Build Estimate */
  onBuildEstimate: () => void;
  /** Whether RoofScope is being processed */
  isProcessing?: boolean;
  /** Callback for file upload (RoofScope) */
  onFileUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Callback for drag and drop */
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
  /** Editable structure name - structure being edited */
  editingStructureId: string | null;
  /** Callback when user saves structure name */
  onStructureNameSave: (structureId: string, newName: string) => void;
  /** Callback when user starts editing structure name */
  onEditingStructureIdChange: (id: string | null) => void;
}

/**
 * Setup step: RoofScope upload, structure configuration, vendor quotes, customer info.
 * User configures the project before building the estimate.
 */
export function SetupStep({
  measurements,
  customerInfo,
  uploadedImages,
  structures,
  structureRoofSystems,
  onStructureRoofSystemChange,
  vendorQuotes,
  vendorQuoteItems,
  isExtractingVendorQuote,
  jobDescription,
  onCustomerInfoChange,
  onJobDescriptionChange,
  onReset,
  onVendorQuoteUpload,
  onRemoveVendorQuote,
  onBuildEstimate,
  isProcessing = false,
  onFileUpload,
  onDrop,
  editingStructureId,
  onStructureNameSave,
  onEditingStructureIdChange,
}: SetupStepProps) {
  const hasSchaferQuote = vendorQuotes.some((q) => q.vendor === 'schafer');
  const allStructuresHaveRoofSystem = structures.length > 0 && structures.every((s) => structureRoofSystems[s.id]);
  const totalSquares = structures.reduce((sum, s) => sum + (s.measurements?.total_squares ?? 0), 0);

  if (isProcessing) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Reading Measurements...</h2>
        <p className="text-gray-500">Extracting roof data from your image</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* RoofScope Upload Area */}
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => document.getElementById('setup-file-upload')?.click()}
        className="border-2 border-dashed border-gray-300 rounded-2xl p-8 md:p-10 text-center bg-white hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
      >
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={onFileUpload}
          className="hidden"
          id="setup-file-upload"
        />
        <div className="w-14 h-14 md:w-16 md:h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Upload className="w-7 h-7 md:w-8 md:h-8 text-blue-600" />
        </div>
        <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-2">Upload RoofScope</h2>
        <p className="text-gray-500 mb-2 text-sm md:text-base">For measurements</p>
        {measurements && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg inline-block">
            <p className="text-sm font-medium text-green-800">
              <Check className="w-4 h-4 inline mr-1" />
              {totalSquares.toFixed(1)} SQ total • {structures.length} structure{structures.length !== 1 ? 's' : ''} detected
            </p>
            {uploadedImages.has('summary') && (
              <span className="text-xs text-green-600">RoofScope Summary</span>
            )}
            {uploadedImages.has('analysis') && (
              <span className="text-xs text-green-600 ml-2">Roof Area Analysis</span>
            )}
          </div>
        )}
        <p className="text-xs md:text-sm text-gray-400 mt-2">
          <kbd className="px-2 py-1 bg-gray-100 rounded text-xs md:text-sm font-mono">Ctrl+V</kbd> to paste, or tap to upload
        </p>
        <div className="mt-4 flex items-center gap-2 justify-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReset();
            }}
            className="text-xs md:text-sm text-gray-500 hover:text-gray-700"
          >
            Upload Different
          </button>
          {measurements && onFileUpload && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                document.getElementById('setup-file-upload')?.click();
              }}
              className="text-xs md:text-sm text-[#00293f] font-medium hover:underline"
            >
              Add Another RoofScope
            </button>
          )}
        </div>
      </div>

      {/* Detected Structures Panel */}
      {structures.length > 0 && (
        <div className="bg-white rounded-2xl p-4 md:p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Detected Structures</h3>
          <div className="space-y-3">
            {structures.map((structure) => {
              const sq = structure.measurements?.total_squares ?? 0;
              const roofSystem = structureRoofSystems[structure.id] ?? '';
              const showSchaferHint = hasSchaferQuote && !roofSystem;
              const isEditing = editingStructureId === structure.id;

              return (
                <div
                  key={structure.id}
                  className="p-4 border border-gray-200 rounded-xl"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      {isEditing ? (
                        <input
                          type="text"
                          defaultValue={structure.name}
                          autoFocus
                          onBlur={(e) => onStructureNameSave(structure.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              onStructureNameSave(structure.id, (e.target as HTMLInputElement).value);
                            }
                          }}
                          className="font-semibold text-gray-900 w-full max-w-[200px] border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => onEditingStructureIdChange(structure.id)}
                          className="inline-flex items-center gap-1.5 text-left group"
                        >
                          <span className="font-semibold text-gray-900 group-hover:text-[#00293f]">
                            {structure.name}
                          </span>
                          <Edit2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        </button>
                      )}
                      <p className="text-sm text-gray-600 mt-0.5">{sq.toFixed(1)} SQ</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Roof System</label>
                    <select
                      value={roofSystem}
                      onChange={(e) => onStructureRoofSystemChange(structure.id, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                    >
                      {ROOF_SYSTEM_OPTIONS.map((opt) => (
                        <option key={opt.value || 'empty'} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {showSchaferHint && (
                      <p className="text-xs text-amber-700 mt-1">
                        Schafer quote detected — Standing Seam Metal recommended
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Vendor Quote Upload */}
      <div
        onClick={() => document.getElementById('setup-vendor-quote-upload')?.click()}
        className="border-2 border-dashed border-gray-200 rounded-2xl p-4 md:p-6 bg-white hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
      >
        <input
          type="file"
          accept="application/pdf,.pdf"
          multiple
          onChange={onVendorQuoteUpload}
          className="hidden"
          id="setup-vendor-quote-upload"
        />
        <div className="text-center">
          <div className="w-12 h-12 md:w-14 md:h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <FileText className="w-6 h-6 md:w-7 md:h-7 text-blue-600" />
          </div>
          <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-1">Upload Vendor Quotes</h3>
          <p className="text-gray-500 mb-2 text-sm">Optional - Schafer, TRA, Rocky Mountain</p>
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
              const itemCount = vendorQuoteItems.filter((item) => item.vendor_quote_id === quote.id).length;
              return (
                <div
                  key={quote.id}
                  className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-gray-900 truncate">
                      {formatVendorName(quote.vendor)} {quote.quote_number ? `• ${quote.quote_number}` : ''}
                    </div>
                    <div className="text-xs text-gray-500">
                      {itemCount} items • {formatCurrency(quote.total > 0 ? quote.total : quote.subtotal > 0 ? quote.subtotal : 0)}
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
      <div className="bg-white rounded-2xl p-4 md:p-6 border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-3">Customer Info</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
      </div>

      {/* Job Description */}
      <div className="bg-white rounded-2xl p-4 md:p-6 border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-2">Job Description</h3>
        <input
          type="text"
          value={jobDescription}
          onChange={(e) => onJobDescriptionChange(e.target.value)}
          placeholder="Describe this job (e.g., 'Brava tile, tear-off, Hugo's crew, copper valleys')"
          className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm"
        />
      </div>

      {/* Build Estimate Button */}
      <button
        onClick={onBuildEstimate}
        disabled={!allStructuresHaveRoofSystem}
        className="w-full py-3 bg-[#00293f] hover:bg-[#00293f]/90 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
      >
        Build Estimate
        <ChevronRight className="w-5 h-5" />
      </button>
      {!allStructuresHaveRoofSystem && structures.length > 0 && (
        <p className="text-sm text-gray-500 text-center">Select a roof system for each structure to continue</p>
      )}
    </div>
  );
}
