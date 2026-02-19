'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { Upload, FileText, AlertTriangle } from 'lucide-react';
import { Package, Users, Truck, Wrench } from 'lucide-react';
import { parseEstimateCSV, downloadCSVTemplate } from '@/lib/csvParser';
import { validateEstimate } from '@/lib/estimateValidator';
import { recalculateFinancials } from '@/lib/recalculateFinancials';
import { generateProposalPDF } from '@/lib/generateProposal';
import { formatCurrency } from '@/lib/estimatorUtils';
import { groupItemsIntoKits } from '@/lib/kitGrouping';
import { CollapsibleSection } from '@/components/estimator/CollapsibleSection';
import { FinancialSummary } from '@/components/estimator/FinancialSummary';
import type { Estimate } from '@/types';
import { CATEGORIES } from '@/lib/constants';

const SLIDER_CONFIGS = [
  {
    key: 'margin',
    label: 'Profit Margin',
    help: 'How much profit to add on top of cost',
    min: 20,
    max: 60,
    default: 40,
  },
  {
    key: 'waste',
    label: 'Material Waste',
    help: '% overage for material waste/cuts',
    min: 0,
    max: 20,
    default: 10,
  },
  {
    key: 'office',
    label: 'Office Overhead',
    help: '% for office operations',
    min: 5,
    max: 15,
    default: 10,
  },
  {
    key: 'tax',
    label: 'Sales Tax',
    help: 'Local tax rate',
    min: 0,
    max: 20,
    default: 10,
  },
];

export default function EstimatePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [uploadedEstimate, setUploadedEstimate] = useState<Estimate | null>(null);
  const [recalculatedEstimate, setRecalculatedEstimate] = useState<Estimate | null>(null);
  const [validationResult, setValidationResult] = useState<ReturnType<typeof validateEstimate> | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [currentMargin, setCurrentMargin] = useState(40);
  const [currentWaste, setCurrentWaste] = useState(10);
  const [currentOffice, setCurrentOffice] = useState(10);
  const [currentTax, setCurrentTax] = useState(10);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const handleFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setParseErrors(['File must be a .csv file']);
      return;
    }
    setIsParsing(true);
    setParseErrors([]);
    setValidationResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const result = parseEstimateCSV(text);
      setIsParsing(false);
      if (!result.success) {
        setParseErrors(result.errors || ['Failed to parse CSV']);
        setUploadedEstimate(null);
        setRecalculatedEstimate(null);
        return;
      }
      setUploadedEstimate(result.estimate!);
      const validation = validateEstimate(result.estimate!);
      setValidationResult(validation);
      setCurrentMargin(result.estimate!.marginPercent);
      setCurrentWaste(result.estimate!.wastePercent);
      setCurrentOffice(result.estimate!.officeCostPercent);
      setCurrentTax(result.estimate!.salesTaxPercent);
      setRecalculatedEstimate(result.estimate!);
    };
    reader.onerror = () => {
      setIsParsing(false);
      setParseErrors(['Failed to read file']);
    };
    reader.readAsText(file);
  }, []);

  useEffect(() => {
    if (!uploadedEstimate) return;
    const next = recalculateFinancials(uploadedEstimate, {
      marginPercent: currentMargin,
      wastePercent: currentWaste,
      officePercent: currentOffice,
      salesTaxPercent: currentTax,
    });
    setRecalculatedEstimate(next);
  }, [uploadedEstimate, currentMargin, currentWaste, currentOffice, currentTax]);

  const handleReupload = () => {
    setUploadedEstimate(null);
    setRecalculatedEstimate(null);
    setValidationResult(null);
    setParseErrors([]);
    setCurrentMargin(40);
    setCurrentWaste(10);
    setCurrentOffice(10);
    setCurrentTax(10);
  };

  const handleDownloadPDF = async () => {
    if (!recalculatedEstimate || !validationResult?.isValid) return;
    setIsGeneratingPDF(true);
    try {
      const blob = await generateProposalPDF(recalculatedEstimate);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const name = recalculatedEstimate.customerInfo.name || 'Customer';
      const addr = (recalculatedEstimate.customerInfo.address || 'estimate')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .slice(0, 30);
      const date = new Date().toISOString().split('T')[0];
      a.download = `Proposal_${name}_${addr}_${date}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to generate PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00293f]" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const showReview = uploadedEstimate !== null && (validationResult?.isValid ?? false);
  const hasWarnings = (validationResult?.warnings?.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl md:text-3xl font-bold text-[#00293f] mb-6">
          New Roofing Estimate
        </h1>

        {/* Upload Section */}
        {!uploadedEstimate && (
          <div
            className={`border-2 border-dashed rounded-xl p-8 md:p-12 text-center transition-colors ${
              dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
          >
            <input
              type="file"
              accept=".csv"
              className="hidden"
              id="csv-upload"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = '';
              }}
            />
            {isParsing ? (
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#00293f]" />
                <p className="text-gray-600">Parsing CSV...</p>
              </div>
            ) : (
              <>
                <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-700 mb-2">
                  Drag & drop your CSV file here, or
                </p>
                <label
                  htmlFor="csv-upload"
                  className="inline-block px-4 py-2 bg-[#00293f] text-white rounded-lg cursor-pointer hover:bg-[#003d5c]"
                >
                  Choose File
                </label>
                <p className="text-sm text-gray-500 mt-4">
                  File must be .csv with columns: Name, Address, Description, Quantity, Unit, Unit Price, Total, Category, Notes
                </p>
                <button
                  type="button"
                  onClick={downloadCSVTemplate}
                  className="mt-2 text-sm text-[#00293f] underline hover:no-underline"
                >
                  Download CSV template
                </button>
              </>
            )}
            {parseErrors.length > 0 && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-left">
                <p className="font-semibold text-red-800 mb-2">Parse or validation errors:</p>
                <ul className="list-disc list-inside text-red-700 text-sm space-y-1">
                  {parseErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
                {validationResult?.errors?.map((err, i) => (
                  <li key={`v-${i}`}>{err}</li>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Review Section */}
        {uploadedEstimate && (
          <div className="space-y-6">
            {!validationResult?.isValid && validationResult && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="font-semibold text-red-800 mb-2">
                  Validation errors — fix your CSV and re-upload:
                </p>
                <ul className="list-disc list-inside text-red-700 text-sm space-y-1">
                  {validationResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {showReview && recalculatedEstimate && (
              <>
                {/* Header */}
                <div className="bg-white rounded-xl p-6 border border-gray-200">
                  <p className="text-lg font-semibold text-gray-900">
                    {recalculatedEstimate.customerInfo.name || 'Customer'} — {recalculatedEstimate.customerInfo.address || 'No address'}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Estimate Date: {recalculatedEstimate.generatedAt}
                  </p>
                  <p className="text-2xl font-bold text-[#00293f] mt-4 text-right">
                    Quote to Customer: {formatCurrency(recalculatedEstimate.finalPrice)}
                  </p>
                </div>

                {hasWarnings && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    {validationResult!.warnings.map((w, i) => (
                      <p key={i} className="text-amber-800 text-sm flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        {w}
                      </p>
                    ))}
                  </div>
                )}

                {/* Collapsible Categories */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <h2 className="text-lg font-bold text-[#00293f]">Line Items by Category</h2>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {(['materials', 'consumables', 'accessories', 'labor', 'equipment', 'schafer'] as const).map((cat) => {
                      const items = recalculatedEstimate.byCategory[cat] ?? [];
                      if (items.length === 0) return null;
                      const label = CATEGORIES[cat]?.label ?? cat;
                      const total =
                        cat === 'materials'
                          ? recalculatedEstimate.totals.materials
                          : cat === 'consumables'
                            ? (recalculatedEstimate.totals.consumables ?? recalculatedEstimate.sundriesAmount ?? 0)
                            : cat === 'labor'
                              ? recalculatedEstimate.totals.labor
                              : cat === 'equipment'
                                ? recalculatedEstimate.totals.equipment
                                : cat === 'accessories'
                                  ? recalculatedEstimate.totals.accessories
                                  : recalculatedEstimate.totals.schafer;
                      const count = items.length;
                      const icon = CATEGORIES[cat]?.icon ?? Package;
                      return (
                        <div key={cat}>
                          <CollapsibleSection
                            sectionKey={cat}
                            label={label}
                            icon={icon}
                            itemCount={count}
                            isCollapsed={collapsedSections.has(cat)}
                            onToggle={toggleSection}
                            subtotal={total}
                          />
                          {!collapsedSections.has(cat) && (
                            <div className="px-4 pb-4 space-y-2">
                              {(cat === 'accessories' ? groupItemsIntoKits(items) : items).map((item) => (
                                <div
                                  key={item.id}
                                  className="flex flex-col py-1 border-b border-gray-100 last:border-0"
                                >
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-800">{item.name}</span>
                                    <span className="font-medium">{formatCurrency(item.total)}</span>
                                  </div>
                                  {(item as { subtitle?: string }).subtitle && (
                                    <span className="text-xs text-gray-500 mt-0.5 pl-2">
                                      {(item as { subtitle?: string }).subtitle}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {recalculatedEstimate.optionalItems.length > 0 && (
                      <div>
                        <CollapsibleSection
                          sectionKey="optional"
                          label="Optional Items (Not Included)"
                          icon={FileText}
                          itemCount={recalculatedEstimate.optionalItems.length}
                          isCollapsed={collapsedSections.has('optional')}
                          onToggle={toggleSection}
                          subtotal={recalculatedEstimate.optionalItems.reduce((s, i) => s + i.total, 0)}
                        />
                        {!collapsedSections.has('optional') && (
                          <div className="px-4 pb-4 space-y-2">
                            {recalculatedEstimate.optionalItems.map((item) => (
                              <div
                                key={item.id}
                                className="flex justify-between text-sm py-1 text-gray-500"
                              >
                                <span>{item.name}</span>
                                <span>{formatCurrency(item.total)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Financial Breakdown */}
                <div className="bg-white rounded-xl p-6 border border-gray-200 space-y-2">
                  <h2 className="text-lg font-bold text-[#00293f] mb-4">Financial Breakdown</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                    <div>Materials Subtotal: <span className="font-medium">{formatCurrency(recalculatedEstimate.totals.materials)}</span></div>
                    <div>Labor Subtotal: <span className="font-medium">{formatCurrency(recalculatedEstimate.totals.labor)}</span></div>
                    <div>Equipment Subtotal: <span className="font-medium">{formatCurrency(recalculatedEstimate.totals.equipment)}</span></div>
                    <div>Accessories Subtotal: <span className="font-medium">{formatCurrency(recalculatedEstimate.totals.accessories)}</span></div>
                    <div>Sundries (10%): <span className="font-medium">{formatCurrency(recalculatedEstimate.sundriesAmount)}</span></div>
                    <div>Base Cost: <span className="font-medium">{formatCurrency(recalculatedEstimate.baseCost)}</span></div>
                    <div>Office ({currentOffice}%): <span className="font-medium">{formatCurrency(recalculatedEstimate.officeAllocation)}</span></div>
                    <div>Total Cost: <span className="font-medium">{formatCurrency(recalculatedEstimate.totalCost)}</span></div>
                    <div>Margin ({currentMargin}%): <span className="font-medium text-green-700">+{formatCurrency(recalculatedEstimate.sellPrice - recalculatedEstimate.totalCost)}</span></div>
                    <div>Sell Price: <span className="font-medium">{formatCurrency(recalculatedEstimate.sellPrice)}</span></div>
                    <div>Sales Tax ({currentTax}%): <span className="font-medium">+{formatCurrency(recalculatedEstimate.salesTaxAmount)}</span></div>
                    <div className="col-span-2 md:col-span-3 pt-2 border-t font-bold text-lg">
                      FINAL PRICE: {formatCurrency(recalculatedEstimate.finalPrice)}
                    </div>
                  </div>
                </div>

                {/* Sliders */}
                <div className="bg-white rounded-xl p-6 border border-gray-200 space-y-6">
                  <h2 className="text-lg font-bold text-[#00293f]">Adjust Financials</h2>
                  {SLIDER_CONFIGS.map((config) => {
                    const value =
                      config.key === 'margin' ? currentMargin
                      : config.key === 'waste' ? currentWaste
                      : config.key === 'office' ? currentOffice
                      : currentTax;
                    const setter =
                      config.key === 'margin' ? setCurrentMargin
                      : config.key === 'waste' ? setCurrentWaste
                      : config.key === 'office' ? setCurrentOffice
                      : setCurrentTax;
                    return (
                      <div key={config.key}>
                        <div className="flex justify-between items-center mb-1">
                          <label className="font-medium text-gray-800">{config.label}</label>
                          <span className="text-sm text-gray-600">{value}%</span>
                        </div>
                        <input
                          type="range"
                          min={config.min}
                          max={config.max}
                          value={value}
                          onChange={(e) => setter(parseFloat(e.target.value))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#00293f]"
                        />
                        <p className="text-xs text-gray-500 mt-1">{config.help}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Profit Split */}
                <FinancialSummary
                  totalCost={recalculatedEstimate.totalCost}
                  grossProfit={recalculatedEstimate.grossProfit}
                  profitMargin={recalculatedEstimate.profitMargin}
                  sellPrice={recalculatedEstimate.sellPrice}
                />

                {/* Actions */}
                <div className="flex gap-4">
                  <button
                    onClick={handleReupload}
                    className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
                  >
                    Re-upload CSV
                  </button>
                  <button
                    onClick={handleDownloadPDF}
                    disabled={!validationResult?.isValid || isGeneratingPDF}
                    className="px-6 py-3 bg-[#00293f] text-white rounded-lg font-medium hover:bg-[#003d5c] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGeneratingPDF ? 'Generating...' : 'Download PDF'}
                  </button>
                </div>
              </>
            )}

            {uploadedEstimate && !validationResult?.isValid && (
              <button
                onClick={handleReupload}
                className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
              >
                Re-upload CSV
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
