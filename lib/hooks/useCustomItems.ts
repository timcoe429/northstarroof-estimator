import { useState } from 'react';
import { generateId } from '@/lib/utils/helpers';
import type { PriceItem } from '@/types';

type CustomItem = PriceItem & {
  isCustomItem: true;
};

type CustomItemDraft = {
  category: PriceItem['category'];
  name: string;
  quantity: number;
  unit: string;
  price: number;
};

export function useCustomItems(
  setSelectedItems: React.Dispatch<React.SetStateAction<string[]>>,
  setItemQuantities: React.Dispatch<React.SetStateAction<Record<string, number>>>
) {
  const [customItems, setCustomItems] = useState<CustomItem[]>([]);
  const [customItemDraft, setCustomItemDraft] = useState<CustomItemDraft | null>(null);

  const startCustomItem = (category: PriceItem['category']) => {
    setCustomItemDraft({
      category,
      name: '',
      quantity: 1,
      unit: 'each',
      price: 0,
    });
  };

  const cancelCustomItem = () => setCustomItemDraft(null);

  const addCustomItem = () => {
    if (!customItemDraft || !customItemDraft.name.trim()) return;
    const newItem: CustomItem = {
      id: generateId(),
      name: customItemDraft.name.trim(),
      unit: customItemDraft.unit.trim() || 'each',
      price: Number.isFinite(customItemDraft.price) ? customItemDraft.price : 0,
      coverage: null,
      coverageUnit: null,
      category: customItemDraft.category,
      proposalDescription: null,
      isCustomItem: true,
    };

    setCustomItems(prev => [...prev, newItem]);
    setSelectedItems(prev => Array.from(new Set([...prev, newItem.id])));
    setItemQuantities(prev => ({
      ...prev,
      [newItem.id]: customItemDraft.quantity || 0,
    }));
    setCustomItemDraft(null);
  };

  return {
    customItems,
    setCustomItems,
    customItemDraft,
    setCustomItemDraft,
    startCustomItem,
    cancelCustomItem,
    addCustomItem,
  };
}
