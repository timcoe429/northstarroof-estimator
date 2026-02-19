# Phase 3 Build Plan — CSV Upload + Live Recalculation

**Status**: Awaiting Tim's approval  
**Date**: February 2026

**Note**: This app uses **Next.js App Router**. Routes are under `/app/`, not `/pages/`. We will create `/app/estimate/page.tsx`.

---

## Overview

| Phase | Scope | Deliverables |
|-------|-------|--------------|
| **3A** | CSV parser + validator | `lib/csvParser.ts`, `lib/estimateValidator.ts` |
| **3B** | Review page with sliders | `app/estimate/page.tsx`, `lib/recalculateFinancials.ts` |
| **3C** | Remove old UI | Replace `app/page.tsx`, remove components |
| **3D** | Testing | Manual test checklist |

---

## PHASE 3A: CSV Parser & Validator

### 1. CREATE: `/lib/csvParser.ts`

**Function**: `parseEstimateCSV(csvText: string): ParseResult`

**Return type**:
```typescript
interface ParseResult {
  success: boolean;
  estimate?: Estimate;
  errors?: string[];  // parse errors (malformed CSV, missing columns)
}
```

**CSV column mapping** (from task):

| CSV Column | Map To | Notes |
|------------|--------|-------|
| Building | Metadata (optional) | For multi-building; can store or ignore |
| Item | `name` (fallback) | Used if Description empty |
| Description | `name` | Primary display name |
| Quantity | `quantity`, `baseQuantity` | Numeric |
| Unit | `unit` | Default "each" if empty |
| Unit Price | `price` | Numeric |
| Total | `total` | Numeric; must match qty × price (validator checks) |
| Category | `category` | materials | labor | equipment | accessories | schafer |
| Notes | `isOptional` | If contains "optional", "not included", "excluded" → isOptional: true |

**Logic**:
1. Parse CSV (handle header row, quoted fields, commas in quotes)
2. Normalize category: lowercase, trim; map "vendor" → "schafer" if needed
3. Split rows into regular vs optional (Notes column)
4. Build `LineItem` per row:
   ```typescript
   {
     id: `csv_${index}`,
     name: row.Description || row.Item,
     unit: row.Unit || 'each',
     price: parseFloat(row['Unit Price']) || 0,
     coverage: null,
     coverageUnit: null,
     category: normalizedCategory,
     baseQuantity: parseFloat(row.Quantity) || 0,
     quantity: parseFloat(row.Quantity) || 0,
     total: parseFloat(row.Total) || 0,
     wasteAdded: 0,
     isOptional: isOptionalFromNotes
   }
   ```
5. Group into `byCategory` by `category`
6. Compute `totals` = sum of `item.total` per category
7. Build minimal `Measurements` (placeholder: `total_squares: 0`, etc.)
8. Build `CustomerInfo` (empty or from CSV if columns exist)
9. Run initial financial calc with defaults (margin 40%, waste 10%, office 10%, tax 10%, sundries 10%)
10. Return full `Estimate` object

**Header detection**: Flexible — accept "Description" or "Item", "Unit Price" or "Price", "Quantity" or "Qty". Case-insensitive.

---

### 2. CREATE: `/lib/estimateValidator.ts`

**Function**: `validateEstimate(estimate: Estimate): ValidationResult`

**Return type**:
```typescript
interface ValidationResult {
  isValid: boolean;   // true only if no errors
  errors: string[];   // block download
  warnings: string[]; // allow download, show message
}
```

**Validation rules**:

| Check | On Failure |
|-------|------------|
| Line item: `total` ≈ `quantity × price` (within 0.01) | error: "Line X: total mismatch" |
| Category sum matches sum of line item totals | error: "Category totals mismatch" |
| All categories valid (materials, labor, equipment, accessories, schafer) | error: "Invalid category: X" |
| At least one line item | error: "No line items" |
| No negative totals | error: "Negative total on line X" |
| waste/margin/office/tax in reasonable range | warning only |

**Behavior**:
- `isValid: false` → block PDF download, show errors
- Warnings only → allow download, show banner

---

## PHASE 3B: Review Page with Live Recalculation

### 3. CREATE: `/lib/recalculateFinancials.ts`

**Why**: `useEstimateCalculation.calculateEstimate()` builds from `selectedItems` + `itemQuantities` + `allSelectableItems`. CSV gives us `LineItem[]` directly. We need a pure function that takes existing line items + financial % and returns updated estimate.

**Function**: `recalculateFinancials(estimate: Estimate, financials: Financials): Estimate`

```typescript
interface Financials {
  marginPercent: number;
  wastePercent: number;
  officePercent: number;
  sundriesPercent: number;  // fixed 10% or make adjustable later
  salesTaxPercent: number;
}
```

**Logic**:
1. Scale materials + schafer totals by waste: `scaledMaterials = totals.materials * (1 + wastePercent/100)`
2. Same for schafer
3. Labor, equipment, accessories: no waste scaling
4. `sundriesBase = scaledMaterials + scaledSchafer`
5. `sundriesAmount = sundriesBase * (sundriesPercent/100)`
6. `baseCost = sum(scaled category totals) + sundriesAmount`
7. `officeAllocation = baseCost * (officePercent/100)`
8. `totalCost = baseCost + officeAllocation`
9. `sellPrice = totalCost / (1 - marginPercent/100)`
10. `salesTaxAmount = sellPrice * (salesTaxPercent/100)`
11. `finalPrice = sellPrice + salesTaxAmount`
12. `grossProfit = sellPrice - totalCost`
13. `profitMargin = (grossProfit / sellPrice) * 100`
14. Return new Estimate with updated financial fields; `byCategory` line item totals stay same (we're not re-scaling individual items for waste — we scale category totals for the financial stack)

**Waste handling**: We scale category totals, not individual items. So `totals.materials` and `totals.schafer` become `totals.materials * (1 + waste/100)` etc. The line items themselves keep their CSV `total` for display; the financial totals we use for baseCost/sellPrice are the scaled category sums. Actually — that would mean we're double-counting. Let me simplify: **For CSV, treat waste as a materials markup**. New formula:
- `materialsAndSchaferTotal = totals.materials + totals.schafer`
- `scaledMaterialsTotal = materialsAndSchaferTotal * (1 + wastePercent/100)`
- `otherTotal = labor + equipment + accessories`
- `baseCost = scaledMaterialsTotal + otherTotal + sundriesAmount`
- Rest unchanged.

Line items in byCategory keep their original total for PDF — the PDF generator uses raw totals and scales via effectiveMultiplier to hit finalPrice. So we DON'T modify line item totals. We only recompute: baseCost, officeAllocation, totalCost, sellPrice, salesTaxAmount, finalPrice, grossProfit, profitMargin. The estimate.totals we use for baseCost — we need to decide. Option A: Use estimate.totals as-is, apply waste as a separate "materials allowance" that gets added to baseCost. Option B: Scale materials total by waste for baseCost calc.

Cleanest: **baseCost = sum(byCategory totals) + sundries**. Don't add waste as a separate step — CSV quantities are already final. Waste % slider: we could apply it as `materialsAllowance = (materials+schafer) * (waste/100)` added to baseCost. So: `baseCost = sum(totals) + sundriesAmount + wasteAllowance`. That gives waste a clear effect. Let me put that in the plan.

---

### 4. CREATE: `/app/estimate/page.tsx`

**Route**: `/estimate`

**Auth**: Wrap in auth check (redirect to `/login` if not authenticated). Reuse pattern from `app/page.tsx`.

**State**:
```typescript
// Upload / parse state
const [csvText, setCsvText] = useState<string | null>(null);
const [parseResult, setParseResult] = useState<ParseResult | null>(null);
const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

// Financial sliders (defaults)
const [marginPercent, setMarginPercent] = useState(40);
const [wastePercent, setWastePercent] = useState(10);
const [officePercent, setOfficePercent] = useState(10);
const [sundriesPercent, setSundriesPercent] = useState(10);
const [salesTaxPercent, setSalesTaxPercent] = useState(10);

// Recalculated estimate (updated when sliders change)
const [estimate, setEstimate] = useState<Estimate | null>(null);
const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
```

**Effects**:
- On parse success: set estimate from parseResult, run validateEstimate
- On slider change: call recalculateFinancials(estimate, { margin, waste, office, sundries, tax }), set estimate

**UI Layout** (text wireframe):

```
┌─────────────────────────────────────────────────────────┐
│  Northstar Roofing — New Estimate                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─── UPLOAD SECTION ─────────────────────────────────┐ │
│  │  [Drag & drop CSV or click to browse]               │ │
│  │  [    Choose File    ]  Upload                      │ │
│  │                                                     │ │
│  │  (if error) ⚠ Parse failed: missing columns         │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─── REVIEW SECTION (when valid CSV) ─────────────────┐ │
│  │                                                     │ │
│  │  LINE ITEMS BY CATEGORY                             │ │
│  │  ▼ Materials (12 items) ................. $XX,XXX   │ │
│  │     Brava Field Tile ........................ $1,211│ │
│  │     OC Titanium PSU 30 ...................... $435  │ │
│  │  ▶ Labor (1 item) ......................... $13,750│ │
│  │  ▶ Equipment & Fees (3 items) .............. $1,544  │ │
│  │  ▶ Optional (0 items) ........................ $0   │ │
│  │                                                     │ │
│  │  FINANCIAL BREAKDOWN                                 │ │
│  │  Base cost: $XX,XXX  Office (10%): $X,XXX           │ │
│  │  Total cost: $XX,XXX  Margin (40%): $X,XXX          │ │
│  │  Sell price: $XX,XXX  Tax (10%): $X,XXX             │ │
│  │  Final price: $XX,XXX                                │ │
│  │                                                     │ │
│  │  FINANCIAL SLIDERS                                   │ │
│  │  Margin %   [====●====] 40%    (20-60)              │ │
│  │  Waste %    [==●======] 10%    (0-20)               │ │
│  │  Office %   [==●======] 10%    (5-15)               │ │
│  │  Tax %      [==●======] 10%    (0-20)               │ │
│  │                                                     │ │
│  │  ┌─ Profit Split (50/50) ──────────────────────────┐ │
│  │  │  Sales Commission: $X,XXX  Owner: $X,XXX      │ │
│  │  │  TRUE Owner Margin: 20.0% ● (green)            │ │
│  │  └────────────────────────────────────────────────┘ │ │
│  │                                                     │ │
│  │  (if validation errors) ❌ Cannot download: ...     │ │
│  │  (if validation warnings) ⚠ Warnings: ...          │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─── ACTIONS ────────────────────────────────────────┐ │
│  │  [ Re-upload CSV ]    [ Download PDF ]             │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Components to reuse**:
- `FinancialSummary` — pass `totalCost`, `grossProfit`, `profitMargin`, `sellPrice` from estimate
- `formatCurrency` from `lib/estimatorUtils`
- `CollapsibleSection` for category headers (or inline simple collapse)

**Sliders**: Native `<input type="range">` or a simple range component. Min/max/step as specified.

---

### 5. Recalculation formula (recalculateFinancials)

CSV line totals are fixed. Waste % adds a materials allowance on top of CSV costs.

```typescript
const totals = estimate.totals;
const materialsSchafer = totals.materials + (totals.schafer || 0);
const wasteAllowance = materialsSchafer * (wastePercent / 100);
const sundriesAmount = materialsSchafer * (sundriesPercent / 100);
const rawCost = totals.materials + totals.labor + totals.equipment + totals.accessories + (totals.schafer || 0);
const baseCost = rawCost + wasteAllowance + sundriesAmount;
const officeAllocation = baseCost * (officePercent / 100);
const totalCost = baseCost + officeAllocation;
const sellPrice = totalCost / (1 - marginPercent / 100);
const salesTaxAmount = sellPrice * (salesTaxPercent / 100);
const finalPrice = sellPrice + salesTaxAmount;
const grossProfit = sellPrice - totalCost;
const profitMargin = sellPrice > 0 ? (grossProfit / sellPrice) * 100 : 0;
```

---

## PHASE 3C: Remove Old Estimation UI

### 6. Files to modify

| Action | File | Change |
|--------|------|--------|
| **Replace** | `app/page.tsx` | Redirect to `/estimate` or render simple "New Estimate" link to `/estimate`; keep auth check |
| **Create** | `app/estimate/page.tsx` | New CSV upload + review page (as above) |
| **Remove** | `components/RoofScopeEstimator.tsx` | Delete |
| **Remove** | `components/estimator/UploadStep.tsx` | Delete |
| **Remove** | `components/estimator/ReviewStep.tsx` | Delete |
| **Remove** | `components/estimator/EstimateBuilder.tsx` | Delete |
| **Remove** | `components/estimator/CalculatedAccessories.tsx` | Delete |
| **Keep** | `components/estimator/EstimateView.tsx` | Possibly reuse for share page; not needed for /estimate |
| **Keep** | `components/estimator/FinancialSummary.tsx` | Reuse |
| **Keep** | `components/estimator/CollapsibleSection.tsx` | Reuse if useful |
| **Keep** | `components/estimator/ItemRow.tsx`, etc. | May simplify or remove if unused |

### 7. Navigation & index exports

- Home `/` → Redirect to `/estimate` (or show landing with "New Estimate" button → `/estimate`)
- No sidebar in current app — header/simple layout. Add "New Estimate" link in header if one exists, or it's just the home redirect.
- Update `components/estimator/index.ts` — remove exports for deleted components (UploadStep, ReviewStep, EstimateBuilder, CalculatedAccessories); keep FinancialSummary, CollapsibleSection, ItemRow, etc. if still used.

### 8. Hooks to remove or keep

| Hook | Action |
|------|--------|
| `useEstimateCalculation` | **Keep** — extract `recalculateFinancials` logic into `lib/recalculateFinancials.ts`; hook may be unused for CSV flow |
| `useFinancialControls` | **Optional** — use local state for sliders; or reuse for persistence |
| `useImageExtraction` | Remove (no RoofScope upload) |
| `useSmartSelection` | Remove |
| `useVendorQuotes` | Remove |
| `usePriceItems` | Remove |
| `useProjectManager` | Remove |
| `useSavedQuotes` | Keep if we add save later; else remove |
| `useCustomItems` | Remove |

---

## PHASE 3D: Testing Checklist

| Test | Steps | Expected |
|------|-------|----------|
| Valid CSV upload | Upload CSV with valid columns | Parses, validates, review section shown |
| Margin slider | Change margin 40% → 45% | Totals update, owner margin recalculates |
| Waste slider | Change waste 10% → 15% | baseCost, finalPrice increase |
| Office slider | Change office 10% → 12% | totalCost, sellPrice increase |
| Tax slider | Change tax 10% → 8% | finalPrice decreases |
| Validation errors | Upload CSV with total ≠ qty×price | Block download, show error |
| Validation warnings | Upload CSV with odd category | Allow download, show warning |
| Download PDF | Click Download PDF | PDF generates with correct numbers |
| Owner margin colors | Margin 25% → green; 17% → yellow; 12% → red | Correct color per threshold |
| Re-upload | Click Re-upload CSV | Reset to upload state, clear estimate |
| Share page | Visit /share/[token] | Old saved estimate still loads (no change) |

---

## File Summary

### New files
- `lib/csvParser.ts` — `parseEstimateCSV()`
- `lib/estimateValidator.ts` — `validateEstimate()`
- `lib/recalculateFinancials.ts` — `recalculateFinancials()`
- `app/estimate/page.tsx` — CSV upload + review + PDF page

### Modified files
- `app/page.tsx` — Redirect to `/estimate` or minimal landing

### Removed files
- `components/RoofScopeEstimator.tsx`
- `components/estimator/UploadStep.tsx`
- `components/estimator/ReviewStep.tsx`
- `components/estimator/EstimateBuilder.tsx`
- `components/estimator/CalculatedAccessories.tsx`

### Unchanged (keep)
- `lib/generateProposal.ts` — PDF generator
- `lib/supabase.ts` — for share page
- `lib/clientViewBuilder.ts` — used by PDF? Actually PDF uses raw estimate from share page. buildEstimateForClientPdf needs vendorQuoteItems. For CSV we have no vendor quotes — we pass estimate directly like share page. So clientViewBuilder not needed for CSV flow. PDF will scale via effectiveMultiplier.
- `app/share/[token]/page.tsx`
- `components/estimator/FinancialSummary.tsx`
- `components/estimator/CollapsibleSection.tsx` (if used)

---

## CSV Example (minimal valid)

```csv
Description,Quantity,Unit,Unit Price,Total,Category,Notes
Brava Field Tile,28,bundle,43.25,1211,materials,
Hugo (standard),25,sq,550,13750,labor,
Porto Potty,1,flat,600,600,equipment,
```

---

## Open Questions for Tim

1. **Sundries %**: Add as 5th slider (default 10%) or keep fixed?
2. **Customer info**: Should CSV have Name/Address columns, or always empty?
3. **Building column**: Use for multi-building later, or ignore for now?
4. **app/page.tsx**: Redirect directly to `/estimate`, or show a landing with "New Estimate" button?
