'use client'

import React from 'react';
import { ChevronDown, ChevronRight, LucideIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/estimatorUtils';

interface CollapsibleSectionProps {
  /** Unique identifier for the section */
  sectionKey: string;
  /** Display label for the section */
  label: string;
  /** Icon component from lucide-react */
  icon: LucideIcon;
  /** Number of items in this section */
  itemCount: number;
  /** Whether the section is currently collapsed */
  isCollapsed: boolean;
  /** Callback when section header is clicked */
  onToggle: (sectionKey: string) => void;
  /** Optional subtotal to display */
  subtotal?: number;
  /** Optional className for the header container */
  className?: string;
}

/**
 * Reusable collapsible section header with chevron, category icon, title, and item count.
 * Used in estimate builder for organizing items by category.
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
}: CollapsibleSectionProps) {
  return (
    <button
      onClick={() => onToggle(sectionKey)}
      className={`flex items-center gap-2 hover:opacity-80 transition-opacity ${className}`}
    >
      {isCollapsed ? (
        <ChevronRight className="w-5 h-5 text-[#00293f]" />
      ) : (
        <ChevronDown className="w-5 h-5 text-[#00293f]" />
      )}
      <Icon className="w-5 h-5 text-[#00293f]" />
      <h3 className="text-lg md:text-xl font-bold text-[#00293f] uppercase tracking-wide">
        {label} ({itemCount})
      </h3>
      {subtotal !== undefined && (
        <span className="ml-auto text-sm font-semibold text-gray-600">
          {formatCurrency(subtotal)}
        </span>
      )}
    </button>
  );
}
