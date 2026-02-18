'use client';

import React, { useState } from 'react';
import { Upload, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import type {
  AIDetectedStructure,
  BuildingQuickOptions,
  CustomerInfo,
  Measurements,
  RoofSystemType,
  VendorQuote,
} from '@/types';
import type { BuildingEstimateState } from '@/hooks/useBuildings';
import { BuildingCard } from './BuildingCard';

interface SetupStepProps {
  lastDetection?: { structures: AIDetectedStructure[]; summary: string; confidence: string } | null;
  onUploadRoofScope: (file: File | string) => void;
  isProcessingRoofScope: boolean;
  buildings: BuildingEstimateState[];
  onUpdateRoofSystem: (id: string, roofSystem: RoofSystemType) => void;
  onUpdateQuickOption: (
    id: string,
    option: keyof BuildingQuickOptions,
    value: boolean
  ) => void;
  onUpdateMeasurements: (id: string, measurements: Measurements) => void;
  onRemoveBuilding: (id: string) => void;
  onAddAnotherRoofScope: () => void;
  onUploadVendorQuote: (file: File) => void;
  vendorQuotes: VendorQuote[];
  customerInfo: CustomerInfo;
  onUpdateCustomerInfo: (info: CustomerInfo) => void;
  allBuildingsReady: boolean;
  onProceedToBuild: () => void;
}

export function SetupStep({
  lastDetection,
  onUploadRoofScope,
  isProcessingRoofScope,
  buildings,
  onUpdateRoofSystem,
  onUpdateQuickOption,
  onUpdateMeasurements,
  onRemoveBuilding,
  onAddAnotherRoofScope,
  onUploadVendorQuote,
  vendorQuotes,
  customerInfo,
  onUpdateCustomerInfo,
  allBuildingsReady,
  onProceedToBuild,
}: SetupStepProps) {
  const [jobDescOpen, setJobDescOpen] = useState(false);
  const [jobDescription, setJobDescription] = useState('');

  const handleRoofScopeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUploadRoofScope(file);
    e.target.value = '';
  };

  const handleVendorQuoteFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUploadVendorQuote(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Upload areas */}
      {isProcessingRoofScope ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Reading Measurements...
          </h2>
          <p className="text-gray-500">Extracting roof data from your image</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div
            onClick={() =>
              document.getElementById('setup-roofscope-upload')?.click()
            }
            className="border-2 border-dashed border-gray-300 rounded-2xl p-8 md:p-10 text-center bg-white hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
          >
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={handleRoofScopeFile}
              className="hidden"
              id="setup-roofscope-upload"
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
              <kbd className="px-2 py-1 bg-gray-100 rounded text-xs md:text-sm font-mono">
                Ctrl+V
              </kbd>{' '}
              to paste, or tap to upload
            </p>
          </div>

          <div
            onClick={() =>
              document.getElementById('setup-vendor-upload')?.click()
            }
            className="border-2 border-dashed border-gray-300 rounded-2xl p-8 md:p-10 bg-white hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
          >
            <input
              type="file"
              accept="application/pdf,.pdf"
              multiple
              onChange={handleVendorQuoteFile}
              className="hidden"
              id="setup-vendor-upload"
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
              {vendorQuotes.length > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  {vendorQuotes.length} quote{vendorQuotes.length !== 1 ? 's' : ''}{' '}
                  uploaded
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI multi-structure summary - compact, above building cards */}
      {lastDetection && lastDetection.structures.length > 1 && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm font-medium text-gray-800">
            AI detected {lastDetection.structures.length} structures. Confidence:{' '}
            {lastDetection.confidence.charAt(0).toUpperCase() +
              lastDetection.confidence.slice(1)}
          </p>
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
            &quot;{lastDetection.summary}&quot;
          </p>
        </div>
      )}

      {/* Building cards */}
      <div className="space-y-3">
        {buildings.map((building) => (
          <BuildingCard
            key={building.id}
            building={building}
            onUpdateRoofSystem={onUpdateRoofSystem}
            onUpdateQuickOption={onUpdateQuickOption}
            onUpdateMeasurements={onUpdateMeasurements}
            onRemoveBuilding={onRemoveBuilding}
            showRemoveButton={buildings.length > 1}
          />
        ))}
      </div>

      {/* Add Another RoofScope - show when buildings.length >= 1 */}
      {buildings.length >= 1 && (
        <button
          onClick={onAddAnotherRoofScope}
          className="text-sm text-blue-600 hover:text-blue-700 hover:underline font-medium"
        >
          + Add Another RoofScope
        </button>
      )}

      {/* Customer info */}
      <div className="p-3 md:p-4 bg-gray-50 rounded-xl border border-gray-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            value={customerInfo.name}
            onChange={(e) =>
              onUpdateCustomerInfo({ ...customerInfo, name: e.target.value })
            }
            placeholder="Customer Name"
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
          <input
            type="text"
            value={customerInfo.address}
            onChange={(e) =>
              onUpdateCustomerInfo({ ...customerInfo, address: e.target.value })
            }
            placeholder="Address"
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
      </div>

      {/* Job description - collapsible, closed by default */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setJobDescOpen(!jobDescOpen)}
          className="w-full px-4 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
        >
          {jobDescOpen ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          + Add job description (optional)
        </button>
        {jobDescOpen && (
          <div className="px-4 pb-4">
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Describe this job (e.g., tear-off, Hugo's crew, copper valleys)"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm min-h-[80px]"
              rows={3}
            />
          </div>
        )}
      </div>

      {/* Build Estimate CTA */}
      <button
        onClick={onProceedToBuild}
        disabled={!allBuildingsReady}
        className={`w-full py-3 px-4 rounded-xl font-semibold text-white text-center transition-colors ${
          allBuildingsReady
            ? 'bg-[#00293f] hover:bg-[#003d5c]'
            : 'bg-gray-300 cursor-not-allowed'
        }`}
      >
        Build Estimate →
      </button>
    </div>
  );
}
