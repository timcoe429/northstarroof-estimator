import type { PriceItem, VendorQuoteItem } from '@/types';

export type SelectableItem = PriceItem & {
  isVendorItem?: boolean;
  vendorQuoteId?: string;
  vendorCategory?: VendorQuoteItem['vendor_category'];
  isCustomItem?: boolean;
};

export type GroupedVendorItem = {
  id: string;
  name: string;
  category: PriceItem['category'];
  total: number;
  description: string;
  itemIds: string[];
  itemNames: string[];
};

export type CustomItem = PriceItem & {
  isCustomItem: true;
};

export type QuickSelectOption = {
  id: string;
  label: string;
  keyword: string;
  suggested: boolean;
  selected: boolean;
  icon?: string;
};

export interface ValidationWarning {
  id: string;
  message: string;
  severity: 'warning' | 'error';
  field?: string;
}
