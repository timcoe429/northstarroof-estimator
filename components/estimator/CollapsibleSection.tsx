'use client'

import React from 'react';
import { ChevronDown, LucideIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/estimatorUtils';

interface CollapsibleSectionProps {
  sectionKey: string;
  label: string;
  icon: LucideIcon;
  itemCount: number;
  isCollapsed: boolean;
  onToggle: (sectionKey: string) => void;
  subtotal?: number;
  className?: string;
  /** When provided, label becomes editable */
  onLabelChange?: (value: string) => void;
}

/**
 * Collapsible section header with modern styling: gradient bg, left accent, editable label.
 */
export function CollapsibleSection({
  sectionKey,
  label,
  icon: Icon,
  itemCount,
  isCollapsed,
  onToggle,
  subtotal,
  className = '',
  onLabelChange,
}: CollapsibleSectionProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(sectionKey)}
      className={`w-full group text-left ${className}`}
    >
      <div
        className="flex items-center justify-between px-4 py-4 bg-[#EBF5FF] border-l-[5px] border-[#0066CC] rounded-lg hover:bg-[#EBF5FF]/90 transition-colors"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <Icon className="w-6 h-6 text-[#0066CC] flex-shrink-0" />
          <div className="min-w-0 flex-1">
            {onLabelChange ? (
              <input
                type="text"
                value={label}
                onChange={(e) => onLabelChange(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="text-[17px] font-bold text-[#003366] bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-[#0066CC] rounded px-2 py-1 -ml-2 w-full max-w-xs"
              />
            ) : (
              <span className="text-[17px] font-bold text-[#003366]">{label}</span>
            )}
            <p className="text-xs text-[#6B7280] mt-1">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </p>
          </div>
          {subtotal !== undefined && (
            <span className="text-[18px] font-bold text-[#003366] ml-4 flex-shrink-0">
              {formatCurrency(subtotal)}
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-5 w-5 text-[#6B7280] transition-transform ml-4 flex-shrink-0 ${
            isCollapsed ? '-rotate-90' : ''
          }`}
        />
      </div>
    </button>
  );
}
