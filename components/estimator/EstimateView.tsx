'use client'

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ChevronRight, FileText, Upload, Share2, X, Copy, Check } from 'lucide-react';
import type { Estimate, VendorQuote, VendorQuoteItem } from '@/types';
import type { ValidationWarning } from '@/types/estimator';
import { CATEGORIES } from '@/lib/constants';
import { formatCurrency, formatVendorName } from '@/lib/estimatorUtils';
import { FinancialSummary } from './FinancialSummary';

interface EstimateViewProps {
  /** The generated estimate */
  estimate: Estimate;
  /** Saved estimate ID (if estimate has been saved) */
  estimateId?: string;
  /** Current share token (if sharing is enabled) */
  shareToken?: string | null;
  /** Whether sharing is currently enabled */
  shareEnabled?: boolean;
  /** Whether this is a read-only view (e.g., shared estimate) */
  readOnly?: boolean;
  /** Validation warnings */
  validationWarnings: ValidationWarning[];
  /** Whether PDF is being generated */
  isGeneratingPDF: boolean;
  /** Whether quote is being saved */
  isSavingQuote: boolean;
  /** Expanded sections */
  expandedSections: Set<string>;
  /** Whether to show vendor breakdown */
  showVendorBreakdown: boolean;
  /** Vendor quotes */
  vendorQuotes: VendorQuote[];
  /** Vendor quote items */
  vendorQuoteItems: VendorQuoteItem[];
  /** Map of vendor items */
  vendorItemMap: Map<string, VendorQuoteItem>;
  /** Map of vendor quotes */
  vendorQuoteMap: Map<string, VendorQuote>;
  /** Total vendor tax and fees */
  vendorTaxFeesTotal: number;
  /** Callback to dismiss validation warnings */
  onDismissWarnings: () => void;
  /** Callback to download proposal PDF */
  onDownloadProposal: () => void;
  /** Callback to toggle section */
  onToggleSection: (sectionKey: string) => void;
  /** Callback to toggle vendor breakdown */
  onToggleVendorBreakdown: () => void;
  /** Callback to edit estimate */
  onEditEstimate: () => void;
  /** Callback to save quote */
  onSaveQuote: () => void;
  /** Callback to reset estimator */
  onReset: () => void;
  /** Callback to update share settings */
  onUpdateShareSettings?: (enabled: boolean, token: string | null) => void;
  /** Callback to toggle item selection (deselect from estimate) */
  onToggleItemSelection?: (itemId: string, selected: boolean) => void;
}

/**
 * Final estimate view component showing the complete estimate with line items,
 * financial breakdown, and action buttons.
 */
export function EstimateView({
  estimate,
  estimateId,
  shareToken,
  shareEnabled = false,
  readOnly = false,
  validationWarnings,
  isGeneratingPDF,
  isSavingQuote,
  expandedSections,
  showVendorBreakdown,
  vendorQuotes,
  vendorQuoteItems,
  vendorItemMap,
  vendorQuoteMap,
  vendorTaxFeesTotal,
  onDismissWarnings,
  onDownloadProposal,
  onToggleSection,
  onToggleVendorBreakdown,
  onEditEstimate,
  onSaveQuote,
  onReset,
  onUpdateShareSettings,
  onToggleItemSelection,
}: EstimateViewProps) {
  const [showShareModal, setShowShareModal] = useState(false);
  const [localShareEnabled, setLocalShareEnabled] = useState(shareEnabled);
  const [localShareToken, setLocalShareToken] = useState<string | null>(shareToken || null);
  const [copied, setCopied] = useState(false);

  const handleToggleSharing = async (enabled: boolean) => {
    if (!estimateId) {
      alert('Please save the estimate first before enabling sharing.');
      return;
    }

    let token = localShareToken;
    if (enabled && !token) {
      // Generate new token
      token = crypto.randomUUID();
      setLocalShareToken(token);
    }

    setLocalShareEnabled(enabled);
    
    if (onUpdateShareSettings) {
      onUpdateShareSettings(enabled, enabled ? token : null);
    }
  };

  const handleCopyLink = () => {
    if (localShareToken) {
      const shareUrl = `${window.location.origin}/share/${localShareToken}`;
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareUrl = localShareToken ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${localShareToken}` : '';
  return (
    <div className="space-y-4 md:space-y-6">
      {/* Validation Warnings */}
      {validationWarnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="font-medium text-amber-800 mb-2">
                ⚠️ {validationWarnings.length} issue{validationWarnings.length > 1 ? 's' : ''} to review:
              </div>
              <ul className="space-y-1">
                {validationWarnings.map(warning => (
                  <li key={warning.id} className="text-amber-700 text-sm">
                    • {warning.message}
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={onDismissWarnings}
              className="ml-4 text-amber-600 hover:text-amber-800 text-sm font-medium"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Download Proposal PDF and Share Buttons */}
      {onUpdateShareSettings && (
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setShowShareModal(true)}
            disabled={!estimateId}
            className={`flex items-center gap-2 px-4 py-2 rounded text-white transition-colors ${
              !estimateId
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
          <button
            onClick={onDownloadProposal}
            disabled={isGeneratingPDF}
            className={`flex items-center gap-2 px-4 py-2 rounded text-white transition-colors ${
              isGeneratingPDF
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isGeneratingPDF ? 'Generating Proposal...' : '📄 Download Proposal PDF'}
          </button>
        </div>
      )}
      {!onUpdateShareSettings && (
        <div className="flex justify-end">
          <button
            onClick={onDownloadProposal}
            disabled={isGeneratingPDF}
            className={`flex items-center gap-2 px-4 py-2 rounded text-white transition-colors ${
              isGeneratingPDF
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isGeneratingPDF ? 'Generating Proposal...' : '📄 Download Proposal PDF'}
          </button>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Share Estimate</h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!estimateId ? (
              <div className="text-sm text-gray-600 mb-4">
                Please save the estimate first before enabling sharing.
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localShareEnabled}
                      onChange={(e) => handleToggleSharing(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">Enable sharing</span>
                  </label>
                </div>

                {localShareEnabled ? (
                  <div className="space-y-3">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">Shareable Link</div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={shareUrl}
                          readOnly
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded bg-white"
                        />
                        <button
                          onClick={handleCopyLink}
                          className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                        >
                          {copied ? (
                            <>
                              <Check className="w-4 h-4" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">
                      Anyone with this link can view the estimate. Disable sharing to revoke access.
                    </p>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">
                    Sharing is disabled. Enable sharing to generate a shareable link.
                  </div>
                )}
              </>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profit Summary Card */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-4 md:p-6 text-white">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <div>
            <p className="text-green-100 text-xs md:text-sm">Total Cost</p>
            <p className="text-lg md:text-2xl font-bold">{formatCurrency(estimate.totalCost)}</p>
          </div>
          <div>
            <p className="text-green-100 text-xs md:text-sm">Sell Price</p>
            <p className="text-lg md:text-2xl font-bold">{formatCurrency(estimate.sellPrice)}</p>
          </div>
          <div>
            <p className="text-green-100 text-xs md:text-sm">Net Profit</p>
            <p className="text-lg md:text-2xl font-bold">{formatCurrency(estimate.grossProfit)}</p>
          </div>
          <div>
            <p className="text-green-100 text-xs md:text-sm">Profit Margin</p>
            <p className="text-lg md:text-2xl font-bold">{estimate.profitMargin.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      {/* Vendor Breakdown */}
      {vendorQuotes.length > 0 && (
        <div className="bg-white rounded-2xl p-4 md:p-6 border border-gray-200">
          <button
            onClick={onToggleVendorBreakdown}
            className="w-full flex items-center justify-between text-left"
          >
            <div>
              <h3 className="text-sm md:text-base font-semibold text-gray-900">Vendor Breakdown</h3>
              <p className="text-xs md:text-sm text-gray-500">Quote details and vendor totals</p>
            </div>
            {showVendorBreakdown ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </button>
          {showVendorBreakdown && (
            <div className="mt-4 space-y-2">
              {vendorQuotes.map(quote => (
                <div key={quote.id} className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-lg">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {formatVendorName(quote.vendor)} {quote.quote_number ? `• ${quote.quote_number}` : ''}
                    </div>
                    <div className="text-xs text-gray-500">
                      {quote.quote_date || 'Date unknown'}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-gray-900">
                    {formatCurrency(quote.total > 0 ? quote.total : (quote.subtotal > 0 ? quote.subtotal : 0))}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-gray-200 text-sm font-semibold">
                <span>Total Vendor Cost</span>
                <span>
                  {formatCurrency(
                    vendorQuotes.reduce((sum, quote) => sum + (quote.total > 0 ? quote.total : (quote.subtotal > 0 ? quote.subtotal : 0)), 0)
                  )}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Line Items */}
      <div className="bg-white rounded-2xl p-4 md:p-6 border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">Roofing Estimate</h2>
            <p className="text-gray-500 text-sm">
              {estimate.customerInfo.name || 'Customer'} • {estimate.customerInfo.address || 'Address'}
            </p>
            <p className="text-xs md:text-sm text-gray-400">{estimate.generatedAt}</p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs md:text-sm text-gray-500">Quote to Customer</p>
            <p className="text-2xl md:text-4xl font-bold text-gray-900">{formatCurrency(estimate.finalPrice)}</p>
          </div>
        </div>

        {/* Line Items by Category - Collapsible Sections */}
        {Object.entries(CATEGORIES).map(([catKey, { label }]) => {
          const items = estimate.byCategory[catKey];
          if (!items || items.length === 0) return null;
          const isExpanded = expandedSections.has(catKey);
          // Use custom section header if available, otherwise use default
          const sectionHeader = estimate.sectionHeaders?.[catKey as keyof typeof estimate.sectionHeaders] || label;

          return (
            <div key={catKey} className="mb-4 md:mb-6">
              <button
                onClick={() => onToggleSection(catKey)}
                className="w-full flex items-center justify-between py-2 px-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors mb-2"
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  )}
                  <h3 className="text-xs md:text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    {sectionHeader} ({items.length} {items.length === 1 ? 'item' : 'items'})
                  </h3>
                </div>
                <span className="font-bold text-sm">{formatCurrency(estimate.totals[catKey])}</span>
              </button>

              {isExpanded && (
                <div className="mt-2 space-y-2">
                  {items.map((item, idx) => {
                    const vendorItem = vendorItemMap.get(item.id);
                    const vendorQuote = vendorItem ? vendorQuoteMap.get(vendorItem.vendor_quote_id) : null;
                    const displayPrice = vendorItem ? (vendorItem.price || 0) : item.price;
                    const displayTotal = vendorItem ? (item.quantity * displayPrice) : item.total;

                    return (
                      <div key={idx} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {onToggleItemSelection && (
                              <input
                                type="checkbox"
                                checked={true}
                                onChange={() => onToggleItemSelection(item.id, false)}
                                className="mr-1"
                              />
                            )}
                            <span className="font-medium text-sm block truncate">
                              {item.name}
                            </span>
                            {vendorItem && vendorQuote && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">
                                {formatVendorName(vendorQuote.vendor)} Vendor
                              </span>
                            )}
                          </div>
                          <span className="text-gray-400 text-xs">
                            {item.quantity} {item.unit} × {formatCurrency(displayPrice)}
                            {item.wasteAdded > 0 && (
                              <span className="text-orange-500 ml-1">(+{item.wasteAdded} waste)</span>
                            )}
                          </span>
                        </div>
                        <span className="font-semibold text-sm ml-2">{formatCurrency(displayTotal)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Optional Items Section */}
        {estimate.optionalItems && estimate.optionalItems.length > 0 && (
          <div className="mb-4 md:mb-6">
            <button
              onClick={() => onToggleSection('optional')}
              className="w-full flex items-center justify-between py-2 px-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors mb-2"
            >
              <div className="flex items-center gap-2">
                {expandedSections.has('optional') ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
                <h3 className="text-xs md:text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  OPTIONAL ITEMS (Not Included in Quote Total) ({estimate.optionalItems.length} {estimate.optionalItems.length === 1 ? 'item' : 'items'})
                </h3>
              </div>
              <span className="font-bold text-sm">{formatCurrency(estimate.optionalItems.reduce((sum, item) => sum + item.total, 0))}</span>
            </button>

            {expandedSections.has('optional') && (
              <div className="mt-2 space-y-2">
                {estimate.optionalItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg opacity-75">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {onToggleItemSelection && (
                          <input
                            type="checkbox"
                            checked={true}
                            onChange={() => onToggleItemSelection(item.id, false)}
                            className="mr-1"
                          />
                        )}
                        <div className="font-medium text-sm text-gray-600 block truncate">
                          {item.name}
                        </div>
                      </div>
                      <span className="text-gray-400 text-xs">
                        {item.quantity} {item.unit} × {formatCurrency(item.price)}
                      </span>
                    </div>
                    <span className="font-semibold text-sm text-gray-600 ml-2">{formatCurrency(item.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Financial Summary */}
        <div className="border-t-2 border-gray-200 pt-4 mt-4 md:mt-6 space-y-2 md:space-y-3 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Materials Subtotal ({estimate.wastePercent}% waste)</span>
            <span>{formatCurrency(estimate.totals.materials)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Labor Subtotal</span>
            <span>{formatCurrency(estimate.totals.labor)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Equipment Subtotal</span>
            <span>{formatCurrency(estimate.totals.equipment)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Accessories Subtotal</span>
            <span>{formatCurrency(estimate.totals.accessories)}</span>
          </div>
          {vendorTaxFeesTotal > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Vendor Tax & Fees (included)</span>
              <span>{formatCurrency(vendorTaxFeesTotal)}</span>
            </div>
          )}
          <div className="flex justify-between text-gray-600">
            <span>Materials Allowance ({estimate.sundriesPercent}%)</span>
            <span>{formatCurrency(estimate.sundriesAmount)}</span>
          </div>
          <div className="flex justify-between font-medium border-t border-gray-200 pt-2 md:pt-3">
            <span>Base Cost</span>
            <span>{formatCurrency(estimate.baseCost)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Office ({estimate.officeCostPercent}%)</span>
            <span>+{formatCurrency(estimate.officeAllocation)}</span>
          </div>
          <div className="flex justify-between font-medium border-t border-gray-200 pt-2 md:pt-3">
            <span>Total Cost</span>
            <span>{formatCurrency(estimate.totalCost)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Margin ({estimate.marginPercent}%)</span>
            <span>+{formatCurrency(estimate.grossProfit)}</span>
          </div>
          <div className="flex justify-between font-medium border-t border-gray-200 pt-2 md:pt-3">
            <span>Sell Price</span>
            <span>{formatCurrency(estimate.sellPrice)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Sales Tax ({estimate.salesTaxPercent}%)</span>
            <span>+{formatCurrency(estimate.salesTaxAmount)}</span>
          </div>
          <div className="flex justify-between items-center border-t-2 border-gray-900 pt-3 md:pt-4">
            <div>
              <p className="text-lg md:text-xl font-bold">Final Price</p>
              <p className="text-xs md:text-sm text-gray-500">
                {estimate.measurements.total_squares} sq • {estimate.measurements.predominant_pitch}
              </p>
            </div>
            <p className="text-2xl md:text-3xl font-bold">{formatCurrency(estimate.finalPrice)}</p>
          </div>
        </div>

        {/* Financial Summary Component */}
        <FinancialSummary
          totalCost={estimate.totalCost}
          grossProfit={estimate.grossProfit}
          profitMargin={estimate.profitMargin}
          sellPrice={estimate.sellPrice}
        />
      </div>

      {/* Actions */}
      {!readOnly && (
        <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
          <button
            onClick={onEditEstimate}
            className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm md:text-base"
          >
            Edit Estimate
          </button>
          <button
            onClick={onSaveQuote}
            disabled={isSavingQuote}
            className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold rounded-xl flex items-center justify-center gap-2 text-sm md:text-base"
          >
            {isSavingQuote ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                Save Quote
              </>
            )}
          </button>
          <button
            onClick={onReset}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 text-sm md:text-base"
          >
            <Upload className="w-5 h-5" />
            New Estimate
          </button>
        </div>
      )}
    </div>
  );
}
