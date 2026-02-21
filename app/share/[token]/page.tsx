'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import type { SavedQuote, Estimate, LineItem } from '@/types';
import { formatCurrency } from '@/lib/estimatorUtils';
import { groupItemsIntoKits } from '@/lib/kitGrouping';
import { recalculateFinancials } from '@/lib/recalculateFinancials';
import { CollapsibleSection } from '@/components/estimator/CollapsibleSection';
import { FinancialSummary } from '@/components/estimator/FinancialSummary';
import { CATEGORIES } from '@/lib/constants';
import { Package, FileText } from 'lucide-react';

const SLIDER_CONFIGS = [
  { key: 'margin', label: 'Profit Margin', help: 'How much profit to add on top of cost', min: 20, max: 60 },
  { key: 'waste', label: 'Material Waste', help: '% overage for material waste/cuts', min: 0, max: 20 },
  { key: 'office', label: 'Office Overhead', help: '% for office operations', min: 5, max: 15 },
  { key: 'tax', label: 'Sales Tax', help: 'Local tax rate', min: 0, max: 20 },
];

function ExpiredLinkPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="p-8 text-center max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Link Expired</h1>
        <p className="text-gray-600 mb-2">
          This estimate link has expired (14-day limit).
        </p>
        <p className="text-gray-500 text-sm">
          Contact Northstar Roofing to request a new link.
        </p>
      </div>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="p-8 text-center max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Estimate Not Found</h1>
        <p className="text-gray-600">The estimate link is invalid or has been removed.</p>
      </div>
    </div>
  );
}

function savedQuoteToEstimate(q: SavedQuote): Estimate {
  const allLineItems = q.line_items || [];
  const optionalItems = allLineItems.filter((i: LineItem) => i.isOptional === true);
  const regularLineItems = allLineItems.filter((i: LineItem) => !i.isOptional);
  const matTotal = allLineItems.filter((i: LineItem) => i.category === 'materials').reduce((s, i) => s + i.total, 0);
  const schaferTotal = allLineItems.filter((i: LineItem) => i.category === 'schafer').reduce((s, i) => s + i.total, 0);
  const consumablesAmount = q.sundries_amount ?? ((matTotal + schaferTotal) * ((q.sundries_percent || 10) / 100));
  const consumablesLine = consumablesAmount > 0 ? {
    id: 'consumables',
    name: 'Consumables & Hardware',
    proposalDescription: 'Nails, screws, caulk, sealant, caps, and miscellaneous fasteners required to complete the roofing installation.',
    unit: 'each',
    price: consumablesAmount,
    coverage: null,
    coverageUnit: null,
    category: 'materials' as const,
    baseQuantity: 1,
    quantity: 1,
    total: consumablesAmount,
    wasteAdded: 0,
  } : null;
  const materialsItems = regularLineItems.filter((i: LineItem) => i.category === 'materials');
  const materialsWithConsumables = consumablesLine
    ? [...materialsItems, consumablesLine]
    : materialsItems;

  return {
    lineItems: regularLineItems,
    optionalItems,
    byCategory: {
      materials: materialsWithConsumables,
      consumables: [],
      labor: regularLineItems.filter((i: LineItem) => i.category === 'labor'),
      equipment: regularLineItems.filter((i: LineItem) => i.category === 'equipment'),
      accessories: regularLineItems.filter((i: LineItem) => i.category === 'accessories'),
      schafer: regularLineItems.filter((i: LineItem) => i.category === 'schafer'),
    },
    totals: {
      materials: matTotal + consumablesAmount,
      consumables: consumablesAmount,
      labor: allLineItems.filter((i: LineItem) => i.category === 'labor').reduce((s, i) => s + i.total, 0),
      equipment: allLineItems.filter((i: LineItem) => i.category === 'equipment').reduce((s, i) => s + i.total, 0),
      accessories: allLineItems.filter((i: LineItem) => i.category === 'accessories').reduce((s, i) => s + i.total, 0),
      schafer: schaferTotal,
    },
    baseCost: q.base_cost,
    officeCostPercent: q.office_percent,
    officeAllocation: q.office_amount,
    totalCost: q.total_cost,
    marginPercent: q.margin_percent,
    wastePercent: q.waste_percent || 0,
    sundriesPercent: q.sundries_percent || 0,
    sundriesAmount: q.sundries_amount || 0,
    sellPrice: q.sell_price,
    salesTaxPercent: q.sales_tax_percent ?? 10,
    salesTaxAmount: q.sales_tax_amount ?? (q.sell_price * 0.1),
    finalPrice: q.final_price ?? (q.sell_price + (q.sales_tax_amount ?? q.sell_price * 0.1)),
    grossProfit: q.gross_profit,
    profitMargin: q.sell_price > 0 ? (q.gross_profit / q.sell_price) * 100 : 0,
    sectionHeaders: {
      materials: q.section_headers?.materials ?? 'Materials',
      consumables: q.section_headers?.consumables ?? 'Consumables & Hardware',
      accessories: q.section_headers?.accessories ?? 'Accessories',
      labor: q.section_headers?.labor ?? 'Labor',
      equipment: q.section_headers?.equipment ?? 'Equipment & Fees',
      schafer: q.section_headers?.schafer ?? 'Vendor Quote',
    },
    measurements: q.measurements,
    customerInfo: {
      name: q.customer_info?.name ?? q.name?.split(' - ')[0] ?? '',
      address: q.customer_info?.address ?? q.name?.split(' - ')[1] ?? '',
      phone: q.customer_info?.phone ?? '',
    },
    generatedAt: q.created_at,
  };
}

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;
  const [baseEstimate, setBaseEstimate] = useState<Estimate | null>(null);
  const [recalculatedEstimate, setRecalculatedEstimate] = useState<Estimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'valid' | 'expired' | 'not_found'>('valid');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [margin, setMargin] = useState(40);
  const [waste, setWaste] = useState(10);
  const [office, setOffice] = useState(10);
  const [tax, setTax] = useState(10);

  useEffect(() => {
    const fetchEstimate = async () => {
      try {
        const res = await fetch(`/api/share/${token}`);
        if (res.status === 410) {
          setStatus('expired');
          setLoading(false);
          return;
        }
        if (!res.ok) {
          setStatus('not_found');
          setLoading(false);
          return;
        }
        const savedQuote: SavedQuote = await res.json();
        const est = savedQuoteToEstimate(savedQuote);
        setBaseEstimate(est);
        setMargin(est.marginPercent);
        setWaste(est.wastePercent);
        setOffice(est.officeCostPercent);
        setTax(est.salesTaxPercent);
      } catch {
        setStatus('not_found');
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchEstimate();
  }, [token]);

  useEffect(() => {
    if (!baseEstimate) return;
    const next = recalculateFinancials(baseEstimate, {
      marginPercent: margin,
      wastePercent: waste,
      officePercent: office,
      salesTaxPercent: tax,
    });
    setRecalculatedEstimate(next);
  }, [baseEstimate, margin, waste, office, tax]);

  const toggleSection = useCallback((key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFB]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066CC] mx-auto" />
          <p className="mt-4 text-[#6B7280]">Loading...</p>
        </div>
      </div>
    );
  }

  if (status === 'expired') return <ExpiredLinkPage />;
  if (status === 'not_found') return <NotFoundPage />;
  if (!recalculatedEstimate) return null;

  const est = recalculatedEstimate;
  const sectionHeaders = est.sectionHeaders ?? {
    materials: 'Materials',
    consumables: 'Consumables & Hardware',
    accessories: 'Accessories',
    labor: 'Labor',
    equipment: 'Equipment & Fees',
    schafer: 'Vendor Quote',
  };

  return (
    <div className="min-h-screen bg-[#F8FAFB]">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-8 p-4 bg-blue-50 border border-[#0066CC]/20 rounded-lg">
          <p className="text-sm text-[#003366]">
            <strong>Shared Estimate:</strong> View &amp; adjust financials for 14 days. PDF is emailed separately.
          </p>
        </div>

        <h1 className="text-2xl md:text-3xl font-bold text-[#1F2937] mb-12">Northstar Roofing — Shared Estimate</h1>

        <div className="mb-12">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
            <div>
              <h2 className="text-3xl font-bold text-[#1F2937]">{est.customerInfo.name || 'Customer'}</h2>
              <p className="text-lg text-[#6B7280] mt-1">{est.customerInfo.address || 'No address'}</p>
              <p className="text-sm text-[#6B7280] mt-3">Estimate Date: {est.generatedAt}</p>
            </div>
            <div className="text-left sm:text-right flex-shrink-0">
              <p className="text-sm font-semibold text-[#6B7280]">Quote to Customer</p>
              <p className="text-4xl font-bold text-[#0066CC] mt-2">{formatCurrency(est.finalPrice)}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 mb-12">
          <h2 className="text-lg font-bold text-[#1F2937]">Line Items by Category</h2>
          {(['materials', 'consumables', 'accessories', 'labor', 'equipment', 'schafer'] as const).map((cat) => {
              const items = est.byCategory[cat] ?? [];
              if (items.length === 0) return null;
              const label = sectionHeaders[cat] ?? (CATEGORIES[cat]?.label ?? cat);
              const total =
                cat === 'materials' ? est.totals.materials
                : cat === 'consumables' ? (est.totals.consumables ?? est.sundriesAmount ?? 0)
                : cat === 'labor' ? est.totals.labor
                : cat === 'equipment' ? est.totals.equipment
                : cat === 'accessories' ? est.totals.accessories
                : est.totals.schafer;
              const icon = CATEGORIES[cat]?.icon ?? Package;
              const displayItems = cat === 'accessories' ? groupItemsIntoKits(items) : items;
              return (
                <div key={cat} className="mb-8">
                  <CollapsibleSection
                    sectionKey={cat}
                    label={label}
                    icon={icon}
                    itemCount={items.length}
                    isCollapsed={collapsedSections.has(cat)}
                    onToggle={toggleSection}
                    subtotal={total}
                  />
                  {!collapsedSections.has(cat) && (
                    <div className="mt-2 rounded-lg border border-[#E5E7EB] overflow-hidden bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                      <table className="w-full">
                        <tbody className="divide-y divide-[#E5E7EB]">
                          {displayItems.map((item, idx) => (
                            <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFB]'}>
                              <td className="px-6 py-4 text-sm font-medium text-[#1F2937]">
                                <span className="font-semibold">{item.name}</span>
                                {(item as LineItem).proposalDescription && (
                                  <>
                                    <span> — </span>
                                    <span className="italic">{(item as LineItem).proposalDescription}</span>
                                  </>
                                )}
                                {(item as { subtitle?: string }).subtitle && (
                                  <p className="text-xs text-[#6B7280] font-normal mt-1">{(item as { subtitle?: string }).subtitle}</p>
                                )}
                              </td>
                              <td className="px-6 py-4 text-right text-sm font-semibold text-[#1F2937] whitespace-nowrap">
                                {formatCurrency(item.total)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
          })}
          {est.optionalItems.length > 0 && (
            <div className="mb-8">
              <CollapsibleSection
                sectionKey="optional"
                label="Optional Items (Not Included)"
                icon={FileText}
                itemCount={est.optionalItems.length}
                isCollapsed={collapsedSections.has('optional')}
                onToggle={toggleSection}
                subtotal={est.optionalItems.reduce((s, i) => s + i.total, 0)}
              />
              {!collapsedSections.has('optional') && (
                <div className="mt-2 rounded-lg border border-[#E5E7EB] overflow-hidden bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                  <table className="w-full">
                    <tbody className="divide-y divide-[#E5E7EB]">
                      {est.optionalItems.map((item, idx) => (
                        <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFB]'}>
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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 my-12">
          <div className="p-6 bg-white border-2 border-[#E5E7EB] rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Total Cost</p>
            <p className="text-3xl font-bold text-[#1F2937] mt-3">{formatCurrency(est.totalCost)}</p>
          </div>
          <div className="p-6 bg-white border-2 border-[#0066CC]/30 rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            <p className="text-xs font-semibold text-[#0066CC] uppercase tracking-wide">Sell Price</p>
            <p className="text-3xl font-bold text-[#0066CC] mt-3">{formatCurrency(est.sellPrice)}</p>
          </div>
          <div className="p-6 bg-[#4CAF50]/10 border-2 border-[#4CAF50]/40 rounded-lg col-span-2 md:col-span-1 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            <p className="text-xs font-semibold text-[#4CAF50] uppercase tracking-wide">Final Quote</p>
            <p className="text-3xl font-bold text-[#4CAF50] mt-3">{formatCurrency(est.finalPrice)}</p>
          </div>
        </div>

        <div className="p-8 bg-white border border-[#E5E7EB] rounded-lg space-y-4 my-10 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <h3 className="font-bold text-[#1F2937] text-lg">Financial Breakdown</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-[#E5E7EB]">
              <span className="text-[#6B7280]">Base Cost</span>
              <span className="font-semibold text-[#1F2937]">{formatCurrency(est.baseCost)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#E5E7EB]">
              <span className="text-[#6B7280]">Office ({office}%)</span>
              <span className="font-semibold text-[#1F2937]">{formatCurrency(est.officeAllocation)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#E5E7EB]">
              <span className="text-[#6B7280]">Gross Profit ({margin}%)</span>
              <span className="font-semibold text-[#4CAF50]">{formatCurrency(est.sellPrice - est.totalCost)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-[#6B7280]">Sales Tax ({tax}%)</span>
              <span className="font-semibold text-[#1F2937]">{formatCurrency(est.salesTaxAmount)}</span>
            </div>
          </div>
        </div>

        <div className="my-10 p-8 bg-gradient-to-br from-blue-50 to-white border-2 border-[#0066CC]/20 rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <h3 className="text-lg font-bold text-[#1F2937] mb-8">Adjust Financials</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {SLIDER_CONFIGS.map((config) => {
              const value = config.key === 'margin' ? margin : config.key === 'waste' ? waste : config.key === 'office' ? office : tax;
              const setter = config.key === 'margin' ? setMargin : config.key === 'waste' ? setWaste : config.key === 'office' ? setOffice : setTax;
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

        <FinancialSummary
          totalCost={est.totalCost}
          grossProfit={est.grossProfit}
          profitMargin={est.profitMargin}
          sellPrice={est.sellPrice}
        />
      </div>
    </div>
  );
}
