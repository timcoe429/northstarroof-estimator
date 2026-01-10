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
  category: 'materials' | 'labor' | 'equipment' | 'accessories';
}

export interface LineItem extends PriceItem {
  baseQuantity: number;
  quantity: number;
  total: number;
  wasteAdded: number;
}

export interface CustomerInfo {
  name: string;
  address: string;
  phone: string;
}

export interface Estimate {
  lineItems: LineItem[];
  byCategory: {
    materials: LineItem[];
    labor: LineItem[];
    equipment: LineItem[];
    accessories: LineItem[];
  };
  totals: {
    materials: number;
    labor: number;
    equipment: number;
    accessories: number;
  };
  baseCost: number;
  officeCostPercent: number;
  officeAllocation: number;
  totalCost: number;
  marginPercent: number;
  wastePercent: number;
  sellPrice: number;
  grossProfit: number;
  profitMargin: number;
  measurements: Measurements;
  customerInfo: CustomerInfo;
  generatedAt: string;
}
