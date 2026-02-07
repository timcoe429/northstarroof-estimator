import { useState, useCallback } from 'react';
import type { PriceItem } from '@/types';
import type { CustomItem } from '@/types/estimator';
import { generateId } from '@/lib/estimatorUtils';

type CustomItemDraft = {
  category: PriceItem['category'];
  name: string;
  quantity: number;
  unit: string;
  price: number;
};

interface UseCustomItemsProps {
  onItemAdded?: (itemId: string, quantity: number) => void;
}

export const useCustomItems = ({ onItemAdded }: UseCustomItemsProps = {}) => {
  const [customItems, setCustomItems] = useState<CustomItem[]>([]);
  const [customItemDraft, setCustomItemDraft] = useState<CustomItemDraft | null>(null);

  const startCustomItem = useCallback((category: PriceItem['category']) => {
    setCustomItemDraft({
      category,
      name: '',
      quantity: 1,
      unit: 'each',
      price: 0,
    });
  }, []);

  const cancelCustomItem = useCallback(() => {
    setCustomItemDraft(null);
  }, []);

  const addCustomItem = useCallback(() => {
    if (!customItemDraft || !customItemDraft.name.trim()) return;

    const newItem: CustomItem = {
      id: generateId(),
      name: customItemDraft.name.trim(),
      unit: customItemDraft.unit.trim() || 'each',
      price: Number.isFinite(customItemDraft.price) ? customItemDraft.price : 0,
      coverage: null,
      coverageUnit: null,
      category: customItemDraft.category,
      isCustomItem: true,
    };

    setCustomItems(prev => [...prev, newItem]);

    // Notify parent of new item
    if (onItemAdded) {
      onItemAdded(newItem.id, customItemDraft.quantity || 0);
    }

    setCustomItemDraft(null);

    return newItem;
  }, [customItemDraft, onItemAdded]);

  return {
    customItems,
    customItemDraft,
    setCustomItems,
    setCustomItemDraft,
    startCustomItem,
    cancelCustomItem,
    addCustomItem,
  };
};
