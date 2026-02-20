'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { Upload, FileText, AlertTriangle, Share2, Copy, Check } from 'lucide-react';
import { Package, Users, Truck, Wrench } from 'lucide-react';
import { parseEstimateCSV, downloadCSVTemplate } from '@/lib/csvParser';
import { validateEstimate } from '@/lib/estimateValidator';
import { recalculateFinancials } from '@/lib/recalculateFinancials';
import { generateProposalPDF } from '@/lib/generateProposal';
import { formatCurrency } from '@/lib/estimatorUtils';
import { groupItemsIntoKits } from '@/lib/kitGrouping';
import { CollapsibleSection } from '@/components/estimator/CollapsibleSection';
import { FinancialSummary } from '@/components/estimator/FinancialSummary';
import type { Estimate, LineItem } from '@/types';
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
  const { user, loading, session, companyId } = useAuth();
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
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareExpiresAt, setShareExpiresAt] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [sectionHeaders, setSectionHeaders] = useState({
    materials: 'Materials',
    consumables: 'Consumables & Hardware',
    accessories: 'Accessories',
    labor: 'Labor',
    equipment: 'Equipment & Fees',
    schafer: 'Vendor Quote',
  });

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
    setSectionHeaders({ materials: 'Materials', consumables: 'Consumables & Hardware', accessories: 'Accessories', labor: 'Labor', equipment: 'Equipment & Fees', schafer: 'Vendor Quote' });
    setCurrentMargin(40);
    setCurrentWaste(10);
    setCurrentOffice(10);
    setCurrentTax(10);
  };

  const handleDownloadPDF = async () => {
    if (!recalculatedEstimate || !validationResult?.isValid) return;
    setIsGeneratingPDF(true);
    try {
      const estimateWithHeaders = { ...recalculatedEstimate, sectionHeaders };
      const blob = await generateProposalPDF(estimateWithHeaders);
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

  const handleShare = async () => {
    if (!recalculatedEstimate || !validationResult?.isValid || !user?.id || !companyId || !session?.access_token) {
      setShareError('Unable to share: please ensure you are logged in.');
      return;
    }
    setIsSharing(true);
    setShareError(null);
    try {
      const estimateWithHeaders = { ...recalculatedEstimate, sectionHeaders };
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          estimate: estimateWithHeaders,
          userId: user.id,
          companyId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create share link');
      setShareUrl(data.shareUrl);
      setShareExpiresAt(data.expiresAt);
      setShowShareModal(true);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Failed to create share link');
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyShareLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFB]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066CC]" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const showReview = uploadedEstimate !== null && (validationResult?.isValid ?? false);
  const hasWarnings = (validationResult?.warnings?.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-[#F8FAFB]">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-2xl md:text-3xl font-bold text-[#1F2937] mb-8">
          New Roofing Estimate
        </h1>

        {/* Upload Section */}
        {!uploadedEstimate && (
          <div
            className={`border-2 border-dashed rounded-xl p-8 md:p-12 text-center transition-colors bg-white ${
              dragActive ? 'border-[#0066CC] bg-blue-50' : 'border-[#E5E7EB]'
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
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0066CC]" />
                <p className="text-[#6B7280]">Parsing CSV...</p>
              </div>
            ) : (
              <>
                <Upload className="w-12 h-12 mx-auto text-[#6B7280] mb-4" />
                <p className="text-[#1F2937] mb-2">
                  Drag &amp; drop your CSV file here, or
                </p>
                <label
                  htmlFor="csv-upload"
                  className="inline-block px-4 py-2 bg-[#003366] text-white rounded-lg cursor-pointer hover:bg-[#003366]/90 transition-colors font-medium"
                >
                  Choose File
                </label>
                <p className="text-sm text-[#6B7280] mt-4">
                  File must be .csv with columns: Name, Address, Description, Quantity, Unit, Unit Price, Total, Category, Notes
                </p>
                <button
                  type="button"
                  onClick={downloadCSVTemplate}
                  className="mt-2 text-sm text-[#0066CC] underline hover:no-underline font-medium"
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
                <div className="mb-12">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
                    <div>
                      <h2 className="text-3xl font-bold text-[#1F2937]">
                        {recalculatedEstimate.customerInfo.name || 'Customer'}
                      </h2>
                      <p className="text-lg text-[#6B7280] mt-1">
                        {recalculatedEstimate.customerInfo.address || 'No address'}
                      </p>
                      <p className="text-sm text-[#6B7280] mt-3">
                        Estimate Date: {recalculatedEstimate.generatedAt}
                      </p>
                    </div>
                    <div className="text-left sm:text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-[#6B7280]">Quote to Customer</p>
                      <p className="text-4xl font-bold text-[#0066CC] mt-2">
                        {formatCurrency(recalculatedEstimate.finalPrice)}
                      </p>
                    </div>
                  </div>
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

                {/* PDF Section Headers */}
                <div className="my-10 p-6 bg-white border border-[#E5E7EB] rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                  <h3 className="text-lg font-bold text-[#1F2937] mb-2">PDF Section Headers</h3>
                  <p className="text-sm text-[#6B7280] mb-6">
                    Customize section titles in the PDF (e.g., &quot;MATERIALS - GAF Shingles&quot;)
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    {(['materials', 'consumables', 'accessories', 'labor', 'equipment', 'schafer'] as const).map((key) => (
                      <div key={key}>
                        <label className="block text-sm font-semibold text-[#374151] mb-2 capitalize">
                          {key === 'schafer' ? 'Vendor Quote' : key}
                        </label>
                        <input
                          type="text"
                          value={sectionHeaders[key]}
                          onChange={(e) => setSectionHeaders((prev) => ({ ...prev, [key]: e.target.value }))}
                          className="w-full px-4 py-2 border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC] focus:border-transparent text-sm"
                          placeholder={key === 'materials' ? 'Materials' : key === 'consumables' ? 'Consumables & Hardware' : key === 'labor' ? 'Labor' : key === 'equipment' ? 'Equipment & Fees' : key === 'accessories' ? 'Accessories' : 'Vendor Quote'}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Line Items by Category */}
                <div className="space-y-4 mb-10">
                  <h2 className="text-lg font-bold text-[#1F2937]">Line Items by Category</h2>
                  {(['materials', 'consumables', 'accessories', 'labor', 'equipment', 'schafer'] as const).map((cat) => {
                    const items = recalculatedEstimate.byCategory[cat] ?? [];
                    if (items.length === 0) return null;
                    const label = sectionHeaders[cat] || (CATEGORIES[cat]?.label ?? cat);
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
                    const icon = CATEGORIES[cat]?.icon ?? Package;
                    const displayItems = cat === 'accessories' ? groupItemsIntoKits(items) : items;
                    return (
                      <div key={cat} className="mb-10">
                        <CollapsibleSection
                          sectionKey={cat}
                          label={label}
                          icon={icon}
                          itemCount={items.length}
                          isCollapsed={collapsedSections.has(cat)}
                          onToggle={toggleSection}
                          subtotal={total}
                          onLabelChange={(value) => setSectionHeaders((prev) => ({ ...prev, [cat]: value }))}
                        />
                        {!collapsedSections.has(cat) && (
                          <div className="mt-2 rounded-lg border border-[#E5E7EB] overflow-hidden bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                            <table className="w-full">
                              <tbody className="divide-y divide-[#E5E7EB]">
                                {cat === 'materials' &&
                                recalculatedEstimate.buildings &&
                                recalculatedEstimate.buildings.length > 1 ? (
                                  <>
                                    {recalculatedEstimate.buildings.map((building, bIdx) => (
                                      <React.Fragment key={building.name}>
                                        <tr>
                                          <td
                                            colSpan={2}
                                            className={`text-sm font-semibold text-gray-500 uppercase tracking-wide px-4 ${
                                              bIdx === 0 ? 'pt-0 pb-1' : 'pt-4 pb-1'
                                            }`}
                                          >
                                            {building.name}
                                          </td>
                                        </tr>
                                        {building.items.map((item, idx) => (
                                          <tr
                                            key={item.id}
                                            className={idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFB]'}
                                          >
                                            <td className="px-6 py-4 text-sm font-medium text-[#1F2937]">
                                              <span className="font-semibold">{item.name}</span>
                                              {(item as LineItem).proposalDescription && (
                                                <>
                                                  <span> — </span>
                                                  <span className="italic">{(item as LineItem).proposalDescription}</span>
                                                </>
                                              )}
                                              {(item as { subtitle?: string }).subtitle && (
                                                <p className="text-xs text-[#6B7280] font-normal mt-1">
                                                  {(item as { subtitle?: string }).subtitle}
                                                </p>
                                              )}
                                            </td>
                                            <td className="px-6 py-4 text-right text-sm font-semibold text-[#1F2937] whitespace-nowrap">
                                              {formatCurrency(item.total)}
                                            </td>
                                          </tr>
                                        ))}
                                        <tr>
                                          <td
                                            colSpan={2}
                                            className="text-sm text-gray-500 text-right px-4 py-1 border-t border-gray-100"
                                          >
                                            {building.name} Subtotal: {formatCurrency(building.subtotal)}
                                          </td>
                                        </tr>
                                      </React.Fragment>
                                    ))}
                                    {(() => {
                                      const buildingItemIds = new Set(
                                        recalculatedEstimate.buildings!.flatMap((b) => b.items.map((i) => i.id))
                                      );
                                      const orphanMaterials = (recalculatedEstimate.byCategory.materials ?? []).filter(
                                        (m) => !buildingItemIds.has(m.id)
                                      );
                                      return orphanMaterials.map((item, idx) => (
                                        <tr
                                          key={item.id}
                                          className={idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFB]'}
                                        >
                                          <td className="px-6 py-4 text-sm font-medium text-[#1F2937]">
                                            <span className="font-semibold">{item.name}</span>
                                            {(item as LineItem).proposalDescription && (
                                              <>
                                                <span> — </span>
                                                <span className="italic">{(item as LineItem).proposalDescription}</span>
                                              </>
                                            )}
                                            {(item as { subtitle?: string }).subtitle && (
                                              <p className="text-xs text-[#6B7280] font-normal mt-1">
                                                {(item as { subtitle?: string }).subtitle}
                                              </p>
                                            )}
                                          </td>
                                          <td className="px-6 py-4 text-right text-sm font-semibold text-[#1F2937] whitespace-nowrap">
                                            {formatCurrency(item.total)}
                                          </td>
                                        </tr>
                                      ));
                                    })()}
                                  </>
                                ) : (
                                  displayItems.map((item, idx) => (
                                    <tr
                                      key={item.id}
                                      className={idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFB]'}
                                    >
                                      <td className="px-6 py-4 text-sm font-medium text-[#1F2937]">
                                        <span className="font-semibold">{item.name}</span>
                                        {(item as LineItem).proposalDescription && (
                                          <>
                                            <span> — </span>
                                            <span className="italic">{(item as LineItem).proposalDescription}</span>
                                          </>
                                        )}
                                        {(item as { subtitle?: string }).subtitle && (
                                          <p className="text-xs text-[#6B7280] font-normal mt-1">
                                            {(item as { subtitle?: string }).subtitle}
                                          </p>
                                        )}
                                      </td>
                                      <td className="px-6 py-4 text-right text-sm font-semibold text-[#1F2937] whitespace-nowrap">
                                        {formatCurrency(item.total)}
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {recalculatedEstimate.optionalItems.length > 0 && (
                    <div className="mb-10">
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
                        <div className="mt-2 rounded-lg border border-[#E5E7EB] overflow-hidden bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                          <table className="w-full">
                            <tbody className="divide-y divide-[#E5E7EB]">
                              {recalculatedEstimate.optionalItems.map((item, idx) => (
                                <tr
                                  key={item.id}
                                  className={idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFB]'}
                                >
                                  <td className="px-6 py-4 text-sm text-[#6B7280]">
                                    <span className="font-semibold">{item.name}</span>
                                    {(item as LineItem).proposalDescription && (
                                      <>
                                        <span> — </span>
                                        <span className="italic">{(item as LineItem).proposalDescription}</span>
                                      </>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 text-right text-sm font-semibold text-[#6B7280] whitespace-nowrap">
                                    {formatCurrency(item.total)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 my-10">
                  <div className="p-6 bg-white border-2 border-[#E5E7EB] rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                    <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Total Cost</p>
                    <p className="text-3xl font-bold text-[#1F2937] mt-3">
                      {formatCurrency(recalculatedEstimate.totalCost)}
                    </p>
                  </div>
                  <div className="p-6 bg-white border-2 border-[#0066CC]/30 rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                    <p className="text-xs font-semibold text-[#0066CC] uppercase tracking-wide">Sell Price</p>
                    <p className="text-3xl font-bold text-[#0066CC] mt-3">
                      {formatCurrency(recalculatedEstimate.sellPrice)}
                    </p>
                  </div>
                  <div className="p-6 bg-[#4CAF50]/10 border-2 border-[#4CAF50]/40 rounded-lg col-span-2 md:col-span-1 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                    <p className="text-xs font-semibold text-[#4CAF50] uppercase tracking-wide">Final Quote</p>
                    <p className="text-3xl font-bold text-[#4CAF50] mt-3">
                      {formatCurrency(recalculatedEstimate.finalPrice)}
                    </p>
                  </div>
                </div>

                {/* Financial Breakdown */}
                <div className="p-8 bg-white border border-[#E5E7EB] rounded-lg space-y-4 my-10 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                  <h3 className="font-bold text-[#1F2937] text-lg">Financial Breakdown</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b border-[#E5E7EB]">
                      <span className="text-[#6B7280]">Materials Subtotal</span>
                      <span className="font-semibold text-[#1F2937]">{formatCurrency(recalculatedEstimate.totals.materials)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#E5E7EB]">
                      <span className="text-[#6B7280]">Labor Subtotal</span>
                      <span className="font-semibold text-[#1F2937]">{formatCurrency(recalculatedEstimate.totals.labor)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#E5E7EB]">
                      <span className="text-[#6B7280]">Equipment & Accessories</span>
                      <span className="font-semibold text-[#1F2937]">{formatCurrency(recalculatedEstimate.totals.equipment + recalculatedEstimate.totals.accessories)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#E5E7EB]">
                      <span className="text-[#6B7280]">Sundries (10%)</span>
                      <span className="font-semibold text-[#1F2937]">{formatCurrency(recalculatedEstimate.sundriesAmount)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#E5E7EB]">
                      <span className="text-[#6B7280]">Base Cost</span>
                      <span className="font-semibold text-[#1F2937]">{formatCurrency(recalculatedEstimate.baseCost)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#E5E7EB]">
                      <span className="text-[#6B7280]">Office ({currentOffice}%)</span>
                      <span className="font-semibold text-[#1F2937]">{formatCurrency(recalculatedEstimate.officeAllocation)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#E5E7EB]">
                      <span className="text-[#6B7280]">Gross Profit ({currentMargin}%)</span>
                      <span className="font-semibold text-[#4CAF50]">{formatCurrency(recalculatedEstimate.sellPrice - recalculatedEstimate.totalCost)}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-[#6B7280]">Sales Tax ({currentTax}%)</span>
                      <span className="font-semibold text-[#1F2937]">{formatCurrency(recalculatedEstimate.salesTaxAmount)}</span>
                    </div>
                  </div>
                </div>

                {/* Sliders */}
                <div className="my-10 p-8 bg-gradient-to-br from-blue-50 to-white border-2 border-[#0066CC]/20 rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                  <h3 className="text-lg font-bold text-[#1F2937] mb-8">Adjust Financials</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                          <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-semibold text-[#374151]">{config.label}</label>
                            <span className="text-2xl font-bold text-[#0066CC]">{value}%</span>
                          </div>
                          <input
                            type="range"
                            min={config.min}
                            max={config.max}
                            value={value}
                            onChange={(e) => setter(parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-[#0066CC]"
                          />
                          <div className="flex justify-between text-xs text-[#6B7280] mt-2">
                            <span>{config.min}%</span>
                            <span>{config.max}%</span>
                          </div>
                          <p className="text-xs text-[#6B7280] mt-1">{config.help}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Profit Split */}
                <FinancialSummary
                  totalCost={recalculatedEstimate.totalCost}
                  grossProfit={recalculatedEstimate.grossProfit}
                  profitMargin={recalculatedEstimate.profitMargin}
                  sellPrice={recalculatedEstimate.sellPrice}
                />

                {/* Actions */}
                <div className="my-12 flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={handleReupload}
                    className="flex-1 px-6 py-3 bg-white border-2 border-[#E5E7EB] rounded-lg font-semibold text-[#374151] hover:bg-[#F8FAFB] transition-colors"
                  >
                    Re-upload CSV
                  </button>
                  <button
                    onClick={handleShare}
                    disabled={!validationResult?.isValid || isSharing}
                    className="flex-1 px-6 py-3 bg-white border-2 border-[#0066CC] text-[#0066CC] rounded-lg font-semibold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
                  >
                    <Share2 className="w-5 h-5" />
                    {isSharing ? 'Creating...' : 'Share with Owner'}
                  </button>
                  <button
                    onClick={handleDownloadPDF}
                    disabled={!validationResult?.isValid || isGeneratingPDF}
                    className="flex-1 px-6 py-3 bg-[#003366] text-white rounded-lg font-semibold hover:bg-[#003366]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGeneratingPDF ? 'Generating...' : 'Download PDF'}
                  </button>
                </div>
                {shareError && (
                  <p className="text-sm text-red-600 mt-2">{shareError}</p>
                )}
                {showShareModal && shareUrl && shareExpiresAt && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowShareModal(false)}>
                    <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
                      <h3 className="text-lg font-bold text-[#1F2937] mb-2">Share with Owner</h3>
                      <p className="text-sm text-[#6B7280] mb-4">Owner can view &amp; adjust estimate for 24 hours. PDF is emailed separately.</p>
                      <div className="flex gap-2 mb-4">
                        <input
                          readOnly
                          value={shareUrl}
                          className="flex-1 px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm bg-[#F8FAFB]"
                        />
                        <button
                          onClick={handleCopyShareLink}
                          className="px-4 py-2 bg-[#0066CC] text-white rounded-lg font-medium hover:bg-[#0066CC]/90 flex items-center gap-2"
                        >
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          {copied ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <p className="text-xs text-[#6B7280]">Expires in 24 hours</p>
                      <button
                        onClick={() => setShowShareModal(false)}
                        className="mt-4 w-full py-2 border-2 border-[#E5E7EB] rounded-lg font-medium hover:bg-[#F8FAFB] transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
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
