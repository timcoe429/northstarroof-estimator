'use client';

import React from 'react';
import { formatCurrency } from '@/lib/estimatorUtils';

export interface EquipmentItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  isAutoCalculated: boolean;
}

export interface JobLevelSectionProps {
  totalSquares: number;
  laborRate: number;
  laborTotal: number;
  equipmentItems: EquipmentItem[];
  onEquipmentQuantityChange: (itemName: string, quantity: number) => void;
  vendorQuoteItems: unknown[];
  vendorTotal: number;
  accessoriesTotal: number;
  accessoriesComponent?: React.ReactNode;
  optionalItems: unknown[];
}

export function JobLevelSection({
  totalSquares,
  laborRate,
  laborTotal,
  equipmentItems,
  onEquipmentQuantityChange,
  vendorQuoteItems,
  vendorTotal,
  accessoriesTotal,
  accessoriesComponent,
  optionalItems,
}: JobLevelSectionProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
      <div className="px-4 py-3 border-b-2 border-gray-300">
        <h3 className="text-lg font-bold text-[#00293f] uppercase tracking-wide">Job-Level</h3>
      </div>

      <div className="p-4 space-y-6">
        {/* Labor */}
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-[#00293f] mb-2">Labor</h4>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gray-700">Labor (standard)</span>
            <span className="text-gray-600">
              {totalSquares} sq × {formatCurrency(laborRate)} = {formatCurrency(laborTotal)}
            </span>
          </div>
        </div>

        {/* Equipment & Fees */}
        {equipmentItems.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-[#00293f] mb-2">
              Equipment & Fees
            </h4>
            <div className="space-y-2">
              {equipmentItems.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between gap-4 text-sm bg-white rounded-lg px-3 py-2 border border-gray-100"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-gray-900 truncate">{item.name}</span>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!Number.isNaN(v) && v >= 0) {
                          onEquipmentQuantityChange(item.name, v);
                        }
                      }}
                      className="w-14 px-2 py-0.5 text-right border border-gray-200 rounded text-sm"
                      min={0}
                    />
                    {item.isAutoCalculated && (
                      <span className="text-xs text-gray-500">(auto)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-gray-600 tabular-nums">{formatCurrency(item.unitPrice)}</span>
                    <span>=</span>
                    <span className="font-medium tabular-nums w-20 text-right">{formatCurrency(item.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vendor Quote Items */}
        {vendorQuoteItems.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-[#00293f] mb-2">
              Vendor Quote Items
            </h4>
            <div className="space-y-2">
              {vendorQuoteItems.map((item: any, idx: number) => (
                <div
                  key={item?.id ?? idx}
                  className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-2 border border-gray-100"
                >
                  <span className="text-gray-900">{item?.name ?? 'Item'}</span>
                  <span className="font-medium tabular-nums">
                    {formatCurrency((item?.extended_price ?? item?.price ?? 0) * (item?.quantity ?? 1))}
                  </span>
                </div>
              ))}
            </div>
            <div className="text-right mt-2 font-semibold text-gray-700">
              Vendor Total: {formatCurrency(vendorTotal)}
            </div>
          </div>
        )}

        {/* Calculated Accessories */}
        {(accessoriesComponent || accessoriesTotal > 0) && (
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-[#00293f] mb-2">
              Calculated Accessories
            </h4>
            {accessoriesComponent}
            {!accessoriesComponent && accessoriesTotal > 0 && (
              <div className="text-sm text-gray-700">Subtotal: {formatCurrency(accessoriesTotal)}</div>
            )}
          </div>
        )}

        {/* Optional Items */}
        {Array.isArray(optionalItems) && optionalItems.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-[#00293f] mb-2">
              Optional Items
            </h4>
            <div className="space-y-2">
              {optionalItems.map((item: any, idx: number) => (
                <div
                  key={item?.id ?? idx}
                  className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-2 border border-gray-100"
                >
                  <span className="text-gray-900">{item?.name ?? 'Item'}</span>
                  <span className="font-medium tabular-nums">{formatCurrency(item?.total ?? 0)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
