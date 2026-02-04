// Shared TypeScript types for the roofing estimator app

export interface Measurements {
  total_squares: number;
  predominant_pitch: string;
  ridge_length: number;
  hip_length: number;
  valley_length: number;
  eave_length: number;
  rake_length: number;
  penetrations: number;
  skylights: number;
  chimneys: number;
  complexity: string;
  steep_squares?: number | null;
  standard_squares?: number | null;
  flat_squares?: number | null;
  fileName?: string;
}

export interface PriceItem {
  id: string;
  name: string;
  unit: string;
  price: number;
  coverage: number | null;
  coverageUnit: string | null;
  category: 'materials' | 'labor' | 'equipment' | 'accessories' | 'schafer';
  proposalDescription: string | null;
}

export interface LineItem extends PriceItem {
  baseQuantity: number;
  quantity: number;
  total: number;
  wasteAdded: number;
  isCustomItem?: boolean;
  isOptional?: boolean;
}

export interface CustomerInfo {
  name: string;
  address: string;
  phone: string;
}

export interface Estimate {
  lineItems: LineItem[];
  optionalItems: LineItem[];
  byCategory: {
    materials: LineItem[];
    labor: LineItem[];
    equipment: LineItem[];
    accessories: LineItem[];
    schafer: LineItem[];
  };
  totals: {
    materials: number;
    labor: number;
    equipment: number;
    accessories: number;
    schafer: number;
  };
  baseCost: number;
  officeCostPercent: number;
  officeAllocation: number;
  totalCost: number;
  marginPercent: number;
  wastePercent: number;
  sundriesPercent: number;
  sundriesAmount: number;
  sellPrice: number;
  grossProfit: number;
  profitMargin: number;
  measurements: Measurements;
  customerInfo: CustomerInfo;
  generatedAt: string;
}

export interface SavedQuote {
  id: string;
  user_id: string;
  customer_id: string | null;
  name: string;
  measurements: Measurements;
  line_items: LineItem[];
  base_cost: number;
  office_percent: number;
  office_amount: number;
  margin_percent: number;
  waste_percent?: number;
  sundries_percent?: number;
  sundries_amount?: number;
  job_description?: string;
  total_cost: number;
  sell_price: number;
  gross_profit: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface VendorQuote {
  id: string;
  estimate_id: string;
  vendor: 'schafer' | 'tra' | 'rocky-mountain';
  quote_number: string;
  quote_date: string;
  project_address: string;
  file_name: string;
  subtotal: number;
  tax: number;
  total: number;
}

export interface VendorQuoteItem {
  id: string;
  vendor_quote_id: string;
  name: string;
  unit: string;
  price: number;
  quantity: number;
  extended_price: number;
  category: 'materials' | 'equipment' | 'accessories';
  vendor_category: 'panels' | 'flashing' | 'fasteners' | 'snow-retention' | 'delivery';
}
