# App Structure Audit — Northstar Roof Estimator

**Purpose**: Blueprint for CSV workflow transition. What to keep, what to remove, what to modify.

**Date**: February 2026

**Note**: This app uses **Next.js App Router** — there is no `/pages/` directory. All routes live under `/app/`.

---

## 1. Current Estimation Flow

### Routes and Pages

| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/page.tsx` | **Main entry** — auth check, renders `RoofScopeEstimator` |
| `/login` | `app/login/page.tsx` | Login page |
| `/share/[token]` | `app/share/[token]/page.tsx` | Public shared estimate view (no auth) |

**There is no `/pages/estimate` or `/app/estimate/` route.** The entire estimation UI lives inside `RoofScopeEstimator` on the home page.

### Step Flow (inside RoofScopeEstimator)

| Step | State Value | Components Rendered | User Action |
|------|-------------|---------------------|-------------|
| 1. Upload | `upload` | `UploadStep` | Upload RoofScope image, vendor quote PDF, price sheet |
| 2. Review & Build | `extracted` | `ReviewStep`, `EstimateBuilder`, `CalculatedAccessories` | Review measurements, select materials, adjust quantities |
| 3. Estimate | `estimate` | `EstimateView` | Review totals, download PDF, save/share |

Transitions: `upload` → `extracted` (after image extraction) → `estimate` (after "Generate Estimate" click).

### Components by Responsibility

| Responsibility | Component(s) | File(s) |
|----------------|--------------|---------|
| **Building input** | `UploadStep` | `components/estimator/UploadStep.tsx` |
| **Roof system selection** | `useSmartSelection`, `useProjectManager` | `hooks/useSmartSelection.ts`, `hooks/useProjectManager.ts`, `app/api/smart-selection/route.ts` |
| **Material selection** | `EstimateBuilder`, `PriceListPanel` | `components/estimator/EstimateBuilder.tsx`, `PriceListPanel.tsx` |
| **Calculation logic** | `useEstimateCalculation` | `hooks/useEstimateCalculation.ts` |
| **Review & PDF** | `EstimateView`, `FinancialSummary` | `components/estimator/EstimateView.tsx`, `FinancialSummary.tsx` |
| **Accessory calcs** | `CalculatedAccessories` | `components/estimator/CalculatedAccessories.tsx` |

### State Management

| Type | Location | What's Stored |
|------|----------|---------------|
| **React useState** | `RoofScopeEstimator.tsx` | `step`, `measurements`, `estimate`, `selectedItems`, `itemQuantities`, `customerInfo`, `sectionHeaders`, `manualOverrides`, `priceOverrides`, `nameOverrides`, `skylightCount`, etc. |
| **localStorage** | `useFinancialControls` | `roofscope_margin`, `roofscope_office_percent`, `roofscope_waste`, `roofscope_sundries`, `roofscope_sales_tax` (defaults: 40%, 10%, 10%, 10%, 10%) |
| **Context** | `AuthContext` | `user`, `session`, `companyId` |
| **Hooks** | Various | `useVendorQuotes`, `usePriceItems`, `useSmartSelection`, `useSavedQuotes`, `useUIState`, `useCustomItems` — all manage local state with callbacks to parent |

**No Zustand or external state library** — everything is React state + localStorage for financial defaults.

---

## 2. Calculation Engine (lib/ files)

### Files Containing Calculation Logic

| File | Responsibility |
|------|----------------|
| `hooks/useEstimateCalculation.ts` | **Core** — quantity calculations, financial formulas, estimate assembly |
| `lib/accessoryCalculations.ts` | Heat tape, snow guards, snow fence formulas; accessory price fallbacks |
| `lib/kitGrouping.ts` | Display-only grouping (aluminum flashing kit, copper kit, fasteners kit) |
| `lib/clientViewBuilder.ts` | Transforms estimate for PDF: split multiplier (equipment vs others), kit grouping |
| `lib/constants.ts` | `UNIT_TYPES`, `CALC_MAPPINGS` — which measurements drive which unit types |
| `lib/autoSelectionRules.ts` | Auto-select underlayment, nails, equipment based on roof type |
| `lib/calculateMultiBuilding.ts` | Multi-building aggregation (feature branch) — combines per-building items |

### Data Flow Through Calculation

1. **Inputs**: `measurements`, `selectedItems`, `itemQuantities`, `allSelectableItems`, `vendorAdjustedPriceMap`, financial % (waste, office, sundries, margin, tax)

2. **useEstimateCalculation.calculateItemQuantities(measurements)**  
   - Computes qty per item from coverage, unit type, measurements  
   - Returns `Record<string, number>`

3. **useEstimateCalculation.calculateEstimate()**  
   - Builds `LineItem[]` from selected items + quantities  
   - Applies waste factor to materials (not vendor/optional)  
   - Computes `byCategory`, `totals`, `sundriesAmount`, `baseCost`, `totalCost`, `sellPrice`, `finalPrice`, etc.  
   - Returns full `Estimate` object

4. **buildEstimateForClientPdf(estimate, vendorQuoteItems, groupedVendorItems)**  
   - Rebuilds `byCategory` with client-facing prices (split multiplier)  
   - Runs `groupItemsIntoKits()` on materials  
   - Returns transformed `Estimate` for PDF

### Final Estimate Object Shape

```typescript
interface Estimate {
  lineItems: LineItem[];
  optionalItems: LineItem[];
  byCategory: { materials, labor, equipment, accessories, schafer };
  totals: { materials, labor, equipment, accessories, schafer };
  baseCost, officeCostPercent, officeAllocation, totalCost;
  marginPercent, wastePercent, sundriesPercent, sundriesAmount;
  sellPrice, salesTaxPercent, salesTaxAmount, finalPrice;
  grossProfit, profitMargin;
  sectionHeaders?: { materials, labor, equipment, accessories, schafer };
  measurements: Measurements;
  customerInfo: CustomerInfo;
  generatedAt: string;
}
```

---

## 3. PDF Generation

### File
**`lib/generateProposal.ts`** — single file, ~1000 lines

### Export
```typescript
export async function generateProposalPDF(estimate: Estimate, aiSuggestions?: string): Promise<Blob>
```

### How It Consumes the Estimate

| Estimate Field | Usage |
|----------------|-------|
| `byCategory.materials`, `byCategory.accessories` | Merged into MATERIALS section |
| `byCategory.labor` | LABOR section |
| `byCategory.equipment` | EQUIPMENT & FEES section |
| `optionalItems` | OPTIONAL ITEMS section |
| `totals` | rawTotal for effectiveMultiplier |
| `finalPrice` | Quote Total on last page |
| `sectionHeaders` | Section labels |
| `customerInfo.name`, `customerInfo.address` | Intro letter |
| `byCategory.materials` + `accessories` | Intro letter notable items (Brava, DaVinci, copper, snow guard) |

Per `LineItem`: only `name`, `total`, `subtitle` (optional, for kits) are used.

### Template Structure

| Template | Path | Purpose |
|----------|------|---------|
| Cover | `/templates/cover.pdf` | Static cover page |
| Thank-you | `/templates/thank-you.pdf` | Intro letter (filled dynamically) |
| Line items | `/templates/blank-page-estimate.pdf` | Regular line item pages |
| Quote total | `/templates/blank-page-estimate-with-total.pdf` | Last page with Quote Total box |
| Important Links | `/templates/important-links.pdf` | Static |
| References | `/templates/references.pdf` | Static |

Page order: Cover → Intro → Line items (1+ pages) → Important Links → References.

---

## 4. Data Storage

### Supabase Functions (lib/supabase.ts)

| Function | Purpose |
|----------|---------|
| `saveQuote(estimate, quoteName, userId, companyId, jobDescription?)` | Insert into `estimates` table |
| `loadQuotes(companyId)` | List estimates for company |
| `loadQuote(id, userId)` | Load single estimate |
| `deleteQuote(id, userId)` | Delete estimate |
| `loadPriceItems(companyId)` | Load company price list |
| `savePriceItem`, `savePriceItemsBulk`, `deletePriceItemFromDB` | Price list CRUD |
| `saveVendorQuotes`, `loadVendorQuotes` | Vendor quote persistence |
| `getEstimateByShareToken(token)` | Public share lookup |
| `updateShareSettings(estimateId, enabled, token)` | Toggle sharing |

### Saved Estimate Schema (estimates table)

| Column | Type | Notes |
|--------|------|-------|
| id, company_id, user_id | uuid | |
| name | text | Quote name |
| measurements | jsonb | RoofScope measurements |
| line_items | jsonb | `[...lineItems, ...optionalItems]` |
| base_cost, office_percent, office_amount, margin_percent | numeric | |
| waste_percent, sundries_percent, sundries_amount | numeric | |
| sales_tax_percent, sales_tax_amount | numeric | |
| final_price, total_cost, sell_price, gross_profit | numeric | |
| section_headers | jsonb | Custom section labels |
| job_description | text | |
| share_token, share_enabled | text, boolean | |
| status | text | draft/sent/accepted/rejected |
| created_at, updated_at | timestamp | |

### Auth / Company-Level Checks

- **Row Level Security (RLS)**: All tables use `company_id` for access — users see only their company's data.
- **AuthContext**: Provides `user`, `companyId` from `profiles` table.
- **Save/Load**: `companyId` required for `saveQuote`, `loadQuotes`, `loadPriceItems`.
- **Share**: `getEstimateByShareToken` returns estimate if `share_enabled` true — no auth required.

---

## 5. Price List Management

### Source
**Supabase `price_items` table** — loaded via `loadPriceItems(companyId)` in `usePriceItems`.

### Schema (price_items)
- `id`, `company_id`, `user_id` (legacy)
- `name`, `category`, `unit`, `price`
- `coverage`, `coverage_unit` (optional)
- `created_at`

### How Prices Get Into the App

1. **Manual**: Add via PriceListPanel, save to DB.
2. **Paste/Upload**: AI extracts from price sheet image → `extractPricesFromImage` in `useImageExtraction` → `applyExtractedPrices` adds to price list.
3. **Vendor quotes**: Upload PDF → `extractVendorQuoteFromPdf` in `useVendorQuotes` → items extracted via AI, stored in component state (not `price_items`).

### Vendor Quote Integration

| Vendor | Flow |
|--------|------|
| **Schafer & Co** | PDF upload → AI extracts → read-only items, quantities/prices from quote |
| **TRA Snow & Sun** | Same flow, snow fence systems |
| **Rocky Mountain Snow Guards** | Same flow, snow guards |

Vendor items are **SelectableItem** with `isVendorItem: true`; they use `vendorAdjustedPriceMap` (quote total/subtotal factor) for pricing.

---

## 6. API Routes

| Route | File | Purpose |
|-------|------|---------|
| POST `/api/extract` | `app/api/extract/route.ts` | AI extraction from image (measurements or price sheet) |
| POST `/api/extract-vendor-quote` | `app/api/extract-vendor-quote/route.ts` | AI extraction from vendor quote PDF |
| POST `/api/smart-selection` | `app/api/smart-selection/route.ts` | Load knowledge files for AI material selection |
| POST `/api/project-manager` | `app/api/project-manager/route.ts` | AI project manager (structure detection, validation) |
| POST `/api/organize-proposal` | `app/api/organize-proposal/route.ts` | Unused (proposalOrganizer deprecated) |
| GET `/api/share/[token]` | `app/api/share/[token]/route.ts` | Public estimate fetch by share token |

---

## 7. Summary: What to Keep / Remove / Modify

### KEEP
- `lib/generateProposal.ts` — PDF generator (unchanged)
- `lib/supabase.ts` — save/load, price items, share (for backward compat)
- `lib/accessoryCalculations.ts` — validation formulas
- `lib/constants.ts` — unit types, calc mappings
- `lib/clientViewBuilder.ts` — PDF input transformation
- `lib/kitGrouping.ts` — display grouping
- `types/index.ts` — Estimate, LineItem, etc.
- `lib/AuthContext.tsx` — auth, companyId
- `app/login/page.tsx`, `app/layout.tsx`
- `app/share/[token]/page.tsx` — shared estimate view (may need CSV-compatible flow)
- `/public/templates/*` — PDF templates

### REMOVE OR STUB
- `components/RoofScopeEstimator.tsx` — replace with simplified CSV flow
- `components/estimator/UploadStep.tsx` — RoofScope/vendor upload
- `components/estimator/ReviewStep.tsx` — measurements review
- `components/estimator/EstimateBuilder.tsx` — material selection UI
- `components/estimator/CalculatedAccessories.tsx` — heat tape/snow guard UI
- `hooks/useImageExtraction.ts` — RoofScope/price sheet extraction
- `hooks/useSmartSelection.ts` — AI material selection
- `hooks/useVendorQuotes.ts` — vendor quote upload/parsing
- `hooks/usePriceItems.ts` — price list panel (optional: keep for reference prices?)
- `hooks/useProjectManager.ts` — AI project manager
- `app/api/extract/route.ts` — image extraction
- `app/api/extract-vendor-quote/route.ts` — vendor quote extraction
- `app/api/smart-selection/route.ts` — knowledge file loading
- `app/api/project-manager/route.ts` — AI project manager

### MODIFY
- `app/page.tsx` — render new CSV upload flow instead of RoofScopeEstimator
- `hooks/useEstimateCalculation.ts` — keep `calculateEstimate` logic for validation; remove UI-driven flow
- `hooks/useSavedQuotes.ts` — may need CSV-sourced estimate save/load
- `hooks/useFinancialControls.ts` — optional: CSV may include financial params or use defaults

### CREATE
- `lib/csvParser.ts` — `parseEstimateCSV(csvText): Estimate`
- `lib/estimateValidator.ts` — `validateEstimate(estimate): ValidationResult`
- New page/component: CSV upload → validate → PDF flow

---

## 8. CSV Column Mapping (from task)

Expected CSV columns: **Building, Item, Description, Quantity, Unit, Unit Price, Total, Category, Notes**

Mapping to LineItem:
- `Description` or `Item` → `name`
- `Quantity` → `quantity`, `baseQuantity`
- `Unit` → `unit`
- `Unit Price` → `price`
- `Total` → `total`
- `Category` → `category` (materials/labor/equipment/accessories/schafer)
- `Building` → for multi-building; can be metadata or omitted for single-building
- `Notes` → optional; `isOptional` if indicates optional item
