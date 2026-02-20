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
  category: 'materials' | 'consumables' | 'labor' | 'equipment' | 'accessories' | 'schafer';
}

export interface LineItem extends PriceItem {
  baseQuantity: number;
  quantity: number;
  total: number;
  wasteAdded: number;
  proposalDescription?: string;
  isCustomItem?: boolean;
  isOptional?: boolean;
  building?: string;
  manualOverrides?: {
    quantity?: boolean;
    price?: boolean;
    name?: boolean;
  };
}

export interface GroupedLineItem extends LineItem {
  isKit: boolean;
  subtitle?: string;
  kitItems?: LineItem[];
}

export interface BuildingGroup {
  name: string;
  items: LineItem[];
  subtotal: number;
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
    consumables?: LineItem[];
    labor: LineItem[];
    equipment: LineItem[];
    accessories: LineItem[];
    schafer: LineItem[];
  };
  totals: {
    materials: number;
    consumables?: number;
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
  salesTaxPercent: number;
  salesTaxAmount: number;
  finalPrice: number;
  grossProfit: number;
  profitMargin: number;
  sectionHeaders?: {
    materials?: string;
    consumables?: string;
    labor?: string;
    equipment?: string;
    accessories?: string;
    schafer?: string;
  };
  measurements: Measurements;
  customerInfo: CustomerInfo;
  generatedAt: string;
  introLetterText?: string;
  buildings?: BuildingGroup[];
}

export interface SavedQuote {
  id: string;
  user_id: string; // For audit tracking (who created it)
  company_id: string; // For access control
  customer_id: string | null;
  customer_info?: { name?: string; address?: string; phone?: string } | null;
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
  sales_tax_percent?: number;
  sales_tax_amount?: number;
  final_price?: number;
  section_headers?: {
    materials?: string;
    consumables?: string;
    labor?: string;
    equipment?: string;
    accessories?: string;
    schafer?: string;
  };
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

// =============================================================================
// AI Project Manager Types (Phase B)
// =============================================================================

/**
 * AI's understanding of a structure in a multi-building estimate.
 * Each structure has its own measurements and detection confidence.
 */
export interface AIDetectedStructure {
  id: string;
  name: string;
  type: 'metal' | 'tile' | 'shingle' | 'flat' | 'unknown';
  measurements: Measurements;
  hasAnalysisPage: boolean;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * AI project context linked to an estimate. Matches ai_project_context database schema.
 * Stores AI's understanding, conversation history, and validation state.
 */
export interface AIProjectContext {
  id: string;
  estimateId: string;
  companyId: string;
  projectSummary: string;
  structureCount: number;
  structures: AIDetectedStructure[];
  conversationLog: AIMessage[];
  warnings: AIWarning[];
  validationStatus: 'incomplete' | 'warnings' | 'ready';
  createdAt: string;
  updatedAt: string;
}

/**
 * A single message in the AI conversation log for debugging and context.
 */
export interface AIMessage {
  id: string;
  timestamp: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  stage: 'detection' | 'selection' | 'building' | 'validation';
}

/**
 * Validation warning or error from AI checks.
 * Severity determines if PDF generation is blocked.
 */
export interface AIWarning {
  id: string;
  severity: 'error' | 'warning' | 'info';
  category: 'compatibility' | 'missing_item' | 'pricing' | 'measurement' | 'completeness';
  message: string;
  suggestion?: string;
  affectedItems?: string[];
  dismissed: boolean;
}

/**
 * Result of AI validation run. Returned by validation functions.
 */
export interface AIValidationResult {
  valid: boolean;
  warnings: AIWarning[];
  suggestions: string[];
  completeness: number;
}
