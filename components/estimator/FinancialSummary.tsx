'use client'

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/estimatorUtils';

interface FinancialSummaryProps {
  /** Total cost (materials + labor + equipment + accessories) */
  totalCost: number;
  /** Gross profit (sell price - total cost) */
  grossProfit: number;
  /** Profit margin percentage */
  profitMargin: number;
  /** Final sell price */
  sellPrice: number;
}

/**
 * Displays financial breakdown for the estimate.
 * Shows two panels:
 * 1. Internal Only box - Cost, Profit, Margin
 * 2. Profit Split panel - 50/50 split between sales commission and owner profit
 */
export function FinancialSummary({
  totalCost,
  grossProfit,
  profitMargin,
  sellPrice,
}: FinancialSummaryProps) {
  const salesCommission = grossProfit * 0.5;
  const ownerProfit = grossProfit * 0.5;
  const trueOwnerMargin = sellPrice > 0 ? (ownerProfit / sellPrice) * 100 : 0;
  const marginColor = trueOwnerMargin >= 20 ? 'text-green-600' : trueOwnerMargin >= 15 ? 'text-yellow-600' : 'text-red-600';

  return (
    <>
      {/* Profit Breakdown (Internal Only) */}
      <div className="mt-4 md:mt-6 p-4 md:p-5 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-center gap-2 text-amber-800 mb-3">
          <AlertCircle className="w-4 h-4" />
          <span className="font-semibold text-xs md:text-sm">Internal Only</span>
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-amber-700 block text-xs font-medium">Cost</span>
            <span className="font-bold text-[#1F2937]">{formatCurrency(totalCost)}</span>
          </div>
          <div>
            <span className="text-amber-700 block text-xs font-medium">Profit</span>
            <span className="font-bold text-[#4CAF50]">{formatCurrency(grossProfit)}</span>
          </div>
          <div>
            <span className="text-amber-700 block text-xs font-medium">Margin</span>
            <span className="font-bold text-[#4CAF50]">{profitMargin.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Profit Split Panel (Internal Only) */}
      <div className="mt-4 md:mt-6 p-6 bg-gradient-to-r from-[#4CAF50]/5 to-green-50/50 border border-[#4CAF50]/30 rounded-lg">
        <div className="flex items-center gap-2 text-[#374151] mb-4">
          <span className="text-lg">💰</span>
          <span className="font-semibold text-sm md:text-base">Profit Split (50/50)</span>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b border-[#E5E7EB]">
            <span className="text-[#6B7280]">Sell Price:</span>
            <span className="font-semibold text-[#1F2937]">{formatCurrency(sellPrice)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-[#E5E7EB]">
            <span className="text-[#6B7280]">Total Cost:</span>
            <span className="font-semibold text-[#1F2937]">-{formatCurrency(totalCost)}</span>
          </div>
          <div className="flex justify-between py-3">
            <span className="text-[#374151] font-medium">Net Profit:</span>
            <span className="font-bold text-[#1F2937]">{formatCurrency(grossProfit)}</span>
          </div>
          <div className="space-y-2 pt-2 border-t border-[#E5E7EB]">
            <div className="flex justify-between items-center">
              <span className="text-[#6B7280]">Sales Commission:</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#1F2937]">{formatCurrency(salesCommission)}</span>
                <span className="text-[#6B7280] text-xs">(50%)</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#6B7280]">Owner Profit:</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#1F2937]">{formatCurrency(ownerProfit)}</span>
                <span className="text-[#6B7280] text-xs">(50%)</span>
              </div>
            </div>
          </div>
          <div className="flex justify-between items-center pt-3 border-t border-[#E5E7EB]">
            <span className="text-[#374151] font-medium">TRUE Owner Margin:</span>
            <div className="flex items-center gap-2">
              <span className={`font-bold text-lg ${marginColor}`}>
                {trueOwnerMargin.toFixed(1)}%
              </span>
              <span className={`${marginColor}`}>●</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
