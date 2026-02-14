'use client'

import React, { useState, useEffect } from 'react';
import { Upload, FileText, X, Check, Edit2, ChevronRight, Plus } from 'lucide-react';
import type { Measurements, CustomerInfo, VendorQuote, VendorQuoteItem, EstimateStructure } from '@/types';
import { formatCurrency, formatVendorName } from '@/lib/estimatorUtils';
import { ROOF_SYSTEM_OPTIONS } from '@/lib/roofSystemConstants';

/** Structure with optional AI fields (hasAnalysisPage from AIDetectedStructure) */
type StructureForDisplay = EstimateStructure & { hasAnalysisPage?: boolean };

interface SetupStepProps {
  /** Extracted measurements (used when no structures detected) */
  measurements: Measurements | null;
  /** Customer information */
  customerInfo: CustomerInfo;
  /** Set of uploaded image types */
  uploadedImages: Set<string>;
  /** Structures from AI detection (or default single structure) */
  structures: EstimateStructure[];
  /** Structures with AI metadata (hasAnalysisPage) for rich card display */
  structuresForDisplay?: StructureForDisplay[];
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
  /** Whether AI structure detection is loading */
  isStructureDetectionLoading?: boolean;
  /** AI detection result for confidence banner */
  lastDetection?: { summary: string; confidence: string } | null;
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
 * Compact layout with side-by-side upload areas and collapsible job description.
 */
export function SetupStep({
  measurements,
  customerInfo,
  uploadedImages,
  structures,
  structuresForDisplay = [],
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
  isStructureDetectionLoading = false,
  lastDetection = null,
  onFileUpload,
  onDrop,
  editingStructureId,
  onStructureNameSave,
  onEditingStructureIdChange,
}: SetupStepProps) {
  const hasSchaferQuote = vendorQuotes.some((q) => q.vendor === 'schafer');
  const displayStructures = structuresForDisplay.length > 0 ? structuresForDisplay : structures;
  const allStructuresHaveRoofSystem = structures.length > 0 && structures.every((s) => structureRoofSystems[s.id]);
  const totalSquares = displayStructures.reduce((sum, s) => sum + (s.measurements?.total_squares ?? 0), 0);

  const [jobDescriptionExpanded, setJobDescriptionExpanded] = useState(false);
  useEffect(() => {
    if (jobDescription.trim()) setJobDescriptionExpanded(true);
  }, [jobDescription]);

  return (
    <div className="space-y-3">
      {/* AI Processing Indicators - inline banners */}
      {isProcessing && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-900">Reading Measurements...</p>
              <p className="text-xs text-blue-700">Extracting roof data from your image</p>
            </div>
          </div>
        </div>
      )}

      {isStructureDetectionLoading && measurements && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-900">
                {displayStructures.length > 0 ? 'Adding structures from new RoofScope...' : 'AI analyzing RoofScope...'}
              </p>
              <p className="text-xs text-blue-700">Detecting structures and extracting measurements</p>
            </div>
          </div>
        </div>
      )}

      {/* Upload grid: RoofScope (or status bar) | Vendor Quote */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {measurements ? (
          /* RoofScope status bar when measurements exist */
          <div className="flex items-center justify-between gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 min-w-0">
              <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span className="text-sm font-medium text-green-800 truncate">
                RoofScope: {totalSquares.toFixed(1)} SQ total • {displayStructures.length} structure{displayStructures.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={onReset}
                className="text-xs text-gray-600 hover:text-gray-900"
              >
                Upload Different
              </button>
              {onFileUpload && (
                <>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={onFileUpload}
                    className="hidden"
                    id="setup-add-another-roofscope"
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById('setup-add-another-roofscope')?.click()}
                    disabled={isProcessing}
                    className="text-xs text-[#00293f] font-medium hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:no-underline"
                  >
                    Add Another
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          /* RoofScope upload area when no measurements */
          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => document.getElementById('setup-file-upload')?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center bg-white hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
          >
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={onFileUpload}
              className="hidden"
              id="setup-file-upload"
            />
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <Upload className="w-4 h-4 text-blue-600" />
            </div>
            <h2 className="text-sm font-semibold text-gray-900">Upload RoofScope</h2>
            <p className="text-xs text-gray-400 mt-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">Ctrl+V</kbd> to paste
            </p>
          </div>
        )}

        {/* Vendor Quote Upload - compact dashed box */}
        <div
          onClick={() => document.getElementById('setup-vendor-quote-upload')?.click()}
          className="border-2 border-dashed border-gray-200 rounded-lg p-4 bg-white hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
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
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <FileText className="w-4 h-4 text-blue-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Upload Vendor Quotes</h3>
            <p className="text-xs text-gray-500">Schafer, TRA, Rocky Mountain</p>
            {isExtractingVendorQuote && (
              <div className="flex items-center justify-center gap-2 text-xs text-blue-600 mt-2">
                <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                Extracting...
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
      </div>

      {/* Multi-Structure Overview Panel / Detected Structures */}
      {displayStructures.length > 0 && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">
            {displayStructures.length > 1 ? 'Multi-Structure Property Detected' : 'Detected Structure'}
          </h3>
          {displayStructures.length > 1 && (
            <p className="text-xs text-gray-700 mb-3">
              AI detected {displayStructures.length} structures. Review each building below.
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {displayStructures.map((structure) => {
              const sq = structure.measurements?.total_squares ?? 0;
              const roofSystem = structureRoofSystems[structure.id] ?? '';
              const showSchaferHint = hasSchaferQuote && !roofSystem;
              const isEditing = editingStructureId === structure.id;
              const hasAnalysisPage = 'hasAnalysisPage' in structure ? structure.hasAnalysisPage : true;

              return (
                <div
                  key={structure.id}
                  className="p-3 bg-white border border-gray-200 rounded-lg"
                >
                  <div className="flex items-start justify-between mb-2">
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
                      <p className="text-sm text-gray-600 mt-0.5">
                        Type: {structure.type} • {sq.toFixed(1)} SQ
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        hasAnalysisPage ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {hasAnalysisPage ? 'Detailed' : 'Estimated'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1 mb-2">
                    <div>Pitch: {structure.measurements?.predominant_pitch || 'N/A'}</div>
                    <div>Eave: {structure.measurements?.eave_length ?? 0} LF</div>
                    <div>Valley: {structure.measurements?.valley_length ?? 0} LF</div>
                    <div>Ridge: {structure.measurements?.ridge_length ?? 0} LF</div>
                    {!hasAnalysisPage && (
                      <p className="text-yellow-700 mt-2">No analysis page - measurements estimated</p>
                    )}
                  </div>
                  <div className="pt-2 border-t border-gray-100">
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
          {displayStructures.length > 1 && (
            <div className="mt-3 p-2 bg-white border border-gray-300 rounded">
              <p className="text-xs text-gray-700">
                <strong>Total Combined:</strong> {totalSquares.toFixed(1)} SQ across {displayStructures.length} buildings
              </p>
            </div>
          )}
        </div>
      )}

      {/* AI Detection Confidence */}
      {lastDetection && (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-sm text-gray-700">
            <strong>AI Detection Summary:</strong> {lastDetection.summary}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Confidence: {lastDetection.confidence === 'high' ? 'High' : lastDetection.confidence === 'medium' ? 'Medium' : 'Low'}
          </p>
          {lastDetection.confidence === 'low' && (
            <p className="text-xs text-yellow-700 mt-1">
              Low confidence - recommend uploading analysis pages for accurate measurements
            </p>
          )}
        </div>
      )}

      {/* Hint for additional image */}
      {uploadedImages.has('summary') && !uploadedImages.has('analysis') && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-700 flex items-center gap-2">
            <Upload className="w-4 h-4 flex-shrink-0" />
            <span>Paste your <strong>Roof Area Analysis</strong> image to extract slope breakdown (steep vs standard squares)</span>
          </p>
        </div>
      )}

      {/* Customer Info - compact */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg">
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

      {/* Job Description - collapsible, default closed */}
      {!jobDescriptionExpanded ? (
        <button
          type="button"
          onClick={() => setJobDescriptionExpanded(true)}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          + Add job description (optional)
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Job Description</span>
            <button
              type="button"
              onClick={() => setJobDescriptionExpanded(false)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              − Hide
            </button>
          </div>
          <input
            type="text"
            value={jobDescription}
            onChange={(e) => onJobDescriptionChange(e.target.value)}
            placeholder="Describe this job (e.g., 'Brava tile, tear-off, Hugo's crew, copper valleys')"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
      )}

      {/* Build Estimate Button */}
      <button
        onClick={onBuildEstimate}
        disabled={!allStructuresHaveRoofSystem}
        className="w-full py-2.5 bg-[#00293f] hover:bg-[#00293f]/90 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
      >
        Build Estimate
        <ChevronRight className="w-5 h-5" />
      </button>
      {!allStructuresHaveRoofSystem && structures.length > 0 && (
        <p className="text-xs text-gray-500 text-center">Select a roof system for each structure to continue</p>
      )}
    </div>
  );
}
