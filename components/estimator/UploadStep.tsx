'use client'

import React from 'react';
import { Upload, FileText, X, Check } from 'lucide-react';
import type { VendorQuote, VendorQuoteItem } from '@/types';
import { formatCurrency, formatVendorName } from '@/lib/estimatorUtils';

interface UploadStepProps {
  /** Currently uploaded vendor quotes */
  vendorQuotes: VendorQuote[];
  /** Vendor quote items */
  vendorQuoteItems: VendorQuoteItem[];
  /** Whether vendor quote is being extracted */
  isExtractingVendorQuote: boolean;
  /** Whether roofscope is being processed */
  isProcessing: boolean;
  /** Callback for file upload (RoofScope) */
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Callback for drag and drop */
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  /** Callback for vendor quote upload */
  onVendorQuoteUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Callback to remove vendor quote */
  onRemoveVendorQuote: (quoteId: string) => void;
}

/**
 * Upload step component for RoofScope images and vendor quotes.
 * Handles file uploads, drag & drop, and displays uploaded vendor quotes.
 */
export function UploadStep({
  vendorQuotes,
  vendorQuoteItems,
  isExtractingVendorQuote,
  isProcessing,
  onFileUpload,
  onDrop,
  onVendorQuoteUpload,
  onRemoveVendorQuote,
}: UploadStepProps) {
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
      {/* RoofScope Upload */}
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => document.getElementById('file-upload')?.click()}
        className="border-2 border-dashed border-gray-300 rounded-2xl p-8 md:p-10 text-center bg-white hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
      >
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={onFileUpload}
          className="hidden"
          id="file-upload"
        />
        <div className="w-14 h-14 md:w-16 md:h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Upload className="w-7 h-7 md:w-8 md:h-8 text-blue-600" />
        </div>
        <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-2">
          Upload RoofScope
        </h2>
        <p className="text-gray-500 mb-2 text-sm md:text-base">
          For measurements
        </p>
        <p className="text-xs md:text-sm text-gray-400">
          <kbd className="px-2 py-1 bg-gray-100 rounded text-xs md:text-sm font-mono">Ctrl+V</kbd> to paste, or tap to upload
        </p>
      </div>

      {/* Vendor Quote Upload */}
      <div
        onClick={() => document.getElementById('vendor-quote-upload')?.click()}
        className="border-2 border-dashed border-gray-300 rounded-2xl p-8 md:p-10 bg-white hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
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
          <div className="w-14 h-14 md:w-16 md:h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-7 h-7 md:w-8 md:h-8 text-blue-600" />
          </div>
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-2">
            Upload Vendor Quotes
          </h2>
          <p className="text-gray-500 mb-2 text-sm md:text-base">
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
          <div className="mt-4 space-y-2">
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
    </div>
  );
}
