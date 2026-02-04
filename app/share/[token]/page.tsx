'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { SavedQuote, Estimate, VendorQuote, VendorQuoteItem } from '@/types';
import { EstimateView } from '@/components/estimator';
import { formatCurrency } from '@/lib/estimatorUtils';
import { generateProposalPDF } from '@/lib/generateProposal';

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  useEffect(() => {
    const fetchEstimate = async () => {
      try {
        const response = await fetch(`/api/share/${token}`);
        if (!response.ok) {
          setError('Estimate not found or sharing is disabled');
          setLoading(false);
          return;
        }

        const savedQuote: SavedQuote = await response.json();
        
        // Separate optional items from regular line items
        const allLineItems = savedQuote.line_items || [];
        const optionalItems = allLineItems.filter((item: any) => item.isOptional === true);
        const regularLineItems = allLineItems.filter((item: any) => !item.isOptional);
        
        // Convert SavedQuote to Estimate format
        const convertedEstimate: Estimate = {
          lineItems: regularLineItems,
          optionalItems: optionalItems,
          byCategory: {
            materials: regularLineItems.filter(item => item.category === 'materials'),
            labor: regularLineItems.filter(item => item.category === 'labor'),
            equipment: regularLineItems.filter(item => item.category === 'equipment'),
            accessories: regularLineItems.filter(item => item.category === 'accessories'),
            schafer: regularLineItems.filter(item => item.category === 'schafer'),
          },
          totals: {
            materials: (savedQuote.line_items || [])
              .filter(item => item.category === 'materials')
              .reduce((sum, item) => sum + item.total, 0),
            labor: (savedQuote.line_items || [])
              .filter(item => item.category === 'labor')
              .reduce((sum, item) => sum + item.total, 0),
            equipment: (savedQuote.line_items || [])
              .filter(item => item.category === 'equipment')
              .reduce((sum, item) => sum + item.total, 0),
            accessories: (savedQuote.line_items || [])
              .filter(item => item.category === 'accessories')
              .reduce((sum, item) => sum + item.total, 0),
            schafer: (savedQuote.line_items || [])
              .filter(item => item.category === 'schafer')
              .reduce((sum, item) => sum + item.total, 0),
          },
          baseCost: savedQuote.base_cost,
          officeCostPercent: savedQuote.office_percent,
          officeAllocation: savedQuote.office_amount,
          totalCost: savedQuote.total_cost,
          marginPercent: savedQuote.margin_percent,
          wastePercent: savedQuote.waste_percent || 0,
          sundriesPercent: savedQuote.sundries_percent || 0,
          sundriesAmount: savedQuote.sundries_amount || 0,
          sellPrice: savedQuote.sell_price,
          grossProfit: savedQuote.gross_profit,
          profitMargin: savedQuote.sell_price > 0 
            ? (savedQuote.gross_profit / savedQuote.sell_price) * 100 
            : 0,
          measurements: savedQuote.measurements,
          customerInfo: {
            name: '',
            address: '',
            phone: '',
          },
          generatedAt: savedQuote.created_at,
        };

        setEstimate(convertedEstimate);
      } catch (err) {
        console.error('Error fetching shared estimate:', err);
        setError('Failed to load estimate');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchEstimate();
    }
  }, [token]);

  const handleToggleSection = (sectionKey: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionKey)) {
        next.delete(sectionKey);
      } else {
        next.add(sectionKey);
      }
      return next;
    });
  };

  const handleDownloadProposal = async () => {
    if (!estimate) return;

    setIsGeneratingPDF(true);
    try {
      const blob = await generateProposalPDF(estimate);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Proposal_${estimate.customerInfo.name || 'Customer'}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00293f] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !estimate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Estimate Not Found</h1>
          <p className="text-gray-600">{error || 'The estimate you are looking for does not exist or sharing has been disabled.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-xl font-bold text-gray-900">Northstar Roofing - Shared Estimate</h1>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <EstimateView
          estimate={estimate}
          validationWarnings={[]}
          isGeneratingPDF={isGeneratingPDF}
          isSavingQuote={false}
          expandedSections={expandedSections}
          showVendorBreakdown={false}
          vendorQuotes={[]}
          vendorQuoteItems={[]}
          vendorItemMap={new Map()}
          vendorQuoteMap={new Map()}
          vendorTaxFeesTotal={0}
          onDismissWarnings={() => {}}
          onDownloadProposal={handleDownloadProposal}
          onToggleSection={handleToggleSection}
          onToggleVendorBreakdown={() => {}}
          onEditEstimate={() => {}}
          onSaveQuote={() => {}}
          onReset={() => {}}
          readOnly={true}
        />
      </div>
    </div>
  );
}
