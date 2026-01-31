import { useState } from 'react';
import type { PriceItem } from '@/types';

export const useUIState = () => {
  const [showPrices, setShowPrices] = useState(false);
  const [showFinancials, setShowFinancials] = useState(false);
  const [showVendorBreakdown, setShowVendorBreakdown] = useState(false);
  const [showSavedQuotes, setShowSavedQuotes] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('materials');
  const [sectionSort, setSectionSort] = useState<Record<string, { key: 'name' | 'price' | 'total'; direction: 'asc' | 'desc' }>>({
    materials: { key: 'name', direction: 'asc' },
    labor: { key: 'name', direction: 'asc' },
    equipment: { key: 'name', direction: 'asc' },
    accessories: { key: 'name', direction: 'asc' },
    schafer: { key: 'name', direction: 'asc' },
  });

  return {
    showPrices,
    setShowPrices,
    showFinancials,
    setShowFinancials,
    showVendorBreakdown,
    setShowVendorBreakdown,
    showSavedQuotes,
    setShowSavedQuotes,
    collapsedSections,
    setCollapsedSections,
    expandedSections,
    setExpandedSections,
    editingItem,
    setEditingItem,
    activeCategory,
    setActiveCategory,
    sectionSort,
    setSectionSort,
  };
};
