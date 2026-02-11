# Decisions Log

## Architecture

- **Next.js 14 App Router**: Chosen for modern React patterns, server components, and built-in API routes. Simplifies routing and enables efficient data fetching.
- **Supabase for Backend**: Provides database, authentication, and storage in one platform. Row-level security ensures users only access their own data.
- **Company-Based Data Ownership** (February 2026): Migrated from user-based to company-based data ownership to prevent data loss when users are deleted or recreated.
  - **Why**: Experienced data loss incident where deleting and recreating auth users caused cascade deletion of all business data (price_items, estimates, customers) because they were tied to `user_id` foreign keys.
  - **Implementation**: 
    - Created `companies` table with fixed UUID for Northstar Roofing
    - Added `company_id` column to all business data tables (price_items, estimates, customers)
    - Added `company_id` to profiles table (users belong to companies)
    - Migrated existing data: All existing price_items and profiles assigned to Northstar Roofing company
    - Updated RLS policies to use `company_id` for access control instead of `user_id`
    - Kept `user_id` on estimates for audit tracking (who created it), but access control uses `company_id`
    - Removed cascade delete from `user_id` foreign keys - business data survives user deletion
    - Updated all application code to use `companyId` from auth context for data access
  - **Result**: Users within the same company can share data. Deleting a user no longer affects any business data. Data is owned by the company, not individual users.
- **Custom Hooks Pattern**: Extracted complex state logic into reusable hooks (`useMeasurements`, `useEstimateBuilder`, `usePriceList`, etc.) to keep main component manageable and improve testability.
- **TypeScript (strict: false)**: Using TypeScript for type safety but keeping strict mode disabled for faster development. Can enable strict mode later if needed.

## Integrations

- **Claude API for Image Extraction**: Using Anthropic Claude's vision capabilities to extract measurements from RoofScope screenshots and parse price sheets. More accurate than OCR for complex roofing documents.
- **Vendor Quote Parsing**: Supports multiple vendor formats (Schafer, TRA, Rocky Mountain) with category mapping. Extracts items, quantities, and prices automatically.
- **PDF Generation with pdf-lib**: Using pdf-lib to generate professional proposals with custom templates. Templates stored in `/public/templates/`.

## Behavior / UX

- **Schafer Quote-Only Model**: Schafer items no longer have system pricing. Metal roofs require an uploaded Schafer quote.
  - **Why**: System pricing conflicted with uploaded quotes (different quantities, missing items). Schafer already calculates exact quantities - no need to recalculate with waste factors.
  - **Implementation**: 
    - Schafer section is now a "description library" only (name → client description mapping)
    - Uploaded quote is the ONLY source of truth for pricing/quantities
    - ALL quote line items are extracted exactly as quoted (no filtering, no recalculation)
    - Quote items are read-only in estimate builder (can deselect but can't edit qty/price)

- **Estimate Builder UX** (January 2026):
  - **Green Box for Selected Items**: Selected items appear in a green box container at the top for clear visual separation. Makes it easy to see what's in the estimate at a glance.
  - **Collapsible Sections**: Section headers (MATERIALS, LABOR, EQUIPMENT) are large, navy blue (#00293f), bold, with chevron icons. Click to collapse/expand sections. Shows item counts in headers.
  - **Improved Quantity Parsing**: AI prompt enhanced to better extract explicit quantities from job descriptions. Handles synonyms (dumpster/rolloff, porto/porto potty). "2 dumpsters" now correctly sets Rolloff quantity to 2.

- **Multi-Step Workflow**: Upload → Measurements → Items → Review flow guides users through estimate creation systematically.
- **Paste-to-Extract**: Users can paste images directly (Ctrl+V) to extract measurements or prices, reducing friction.
- **Financial Controls**: Waste %, office overhead %, profit margin %, and sundries % are configurable per estimate. These affect final pricing calculations.
- **Smart Item Suggestions**: AI analyzes job description and measurements to suggest relevant items (e.g., "steep pitch" suggests high-slope products).
- **Vendor Quote Integration**: Vendor quotes can be imported and items selected directly into estimates, maintaining pricing accuracy.
- **Saved Quotes**: Estimates can be saved with customer info, measurements, and line items for future reference or modification.

## Phase 2: Save/Load Data Loss Fix (February 2026)

- **Root Causes Identified:**
  1. Quantity restoration used `||` instead of `??` — treated `0` as falsy
  2. useEffect recalculated quantities on measurement change, overwriting restored values
  3. Vendor item quantities from vendor_quote_items table weren't merged into state
  4. Missing database columns (sundries_percent, sundries_amount, waste_percent, job_description)
  5. Race condition with 100ms setTimeout before recalculation

- **Fixes Applied:**
  1. Changed `baseQuantity || quantity` to `baseQuantity ?? quantity ?? 0`
  2. Added `isLoadingQuote` flag to skip recalculation during quote load
  3. Merge vendor item quantities after loading from database
  4. Added missing columns to estimates table schema
  5. Increased timeout and added proper flag coordination

- **Why:** Quotes saved at $100k were loading at $17k due to vendor item quantities being lost

## Phase 2b: Custom Items Restoration (February 2026)

- **Problem:** Custom items (created via + button) weren't restoring on quote load
- **Root Cause:** Duplicate editingItem state — usePriceItems hook set one, UI read from another. Also, onSetCustomItems callback was empty.
- **Fix:** Exposed setCustomItems from useCustomItems hook, wired up the callback properly

## Phase 3: Margin Distribution Fix (February 2026)

- **Problem:** Client view line items summed to ~$70k but total showed $87k
- **Root Cause:** markupMultiplier formula `(1 + office) × (1 + margin)` = 1.54x didn't match internal calculation which effectively used 1.833x
- **Fix:** Replaced with effectiveMultiplier = sellPrice / rawTotal, which automatically distributes all costs (sundries, vendor tax, office, margin) proportionally
- **Files Changed:** lib/clientViewBuilder.ts, lib/generateProposal.ts, components/RoofScopeEstimator.tsx

## Phase 4: Price List UX Fix (February 2026)

- **Problem:** "+ Add Item" created blank items that couldn't be edited or deleted
- **Root Cause:** Two separate editingItem states (usePriceItems hook vs useUIState hook) weren't synchronized. Also, items were saved to DB immediately before user could edit.
- **Fix:** 
  1. Removed duplicate state from usePriceItems
  2. Added onSetEditingItem callback to use UI state
  3. Deferred database save until user clicks save button

## Phase 6: Auto-Calculate Accessories (February 2026 - In Progress)

- **Feature:** Auto-calculate heat tape, snow guards/fence, skylights from RoofScope measurements
- **Heat Tape Formula:** triangles = eave ÷ 3, cable = triangles × 6 + valley length
- **Snow Retention Formula:** quantity = eave × rows (1-4 rows based on pitch)
- **Roof Type Detection:** Schafer vendor quote present = metal roof = snow fence; otherwise = snow guards
- **Skylights:** Optional items, not included in quote total
- **Pricing:**
  - Heat Tape: $5.00/lf material, $7.50/lf labor
  - Snow Fence: $12.00/lf material, $5.00/lf labor
  - Snow Guards: $7.00/ea material, $5.00/ea labor
  - Skylights: $2,400/ea

## 2/7/2026 - Rules → Intelligence
- Replaced hardcoded grouping rules with AI-powered proposal organization
- proposalDescription field completely removed, single name field everywhere
- Style guide (examples, not rules) guides AI behavior at /data/proposal-style-guide.md
- ID-based matching replaces string-based matching for AI responses
- Manual organization trigger replaces useEffect to prevent infinite loops
- $1,500+ items stay standalone on proposals, small items grouped into kits
- Labor, Equipment, Optional items never grouped

## 2/7/2026 - Style Guide Improvements
- Expanded flashing keywords to catch all Schafer fab items (w valley, fab valley, etc.)
- Kit names now include component summaries for client clarity
- Critical rule: AI never renames user-entered item names — only controls grouping/kit display names
- Style guide read dynamically at runtime — no code changes needed for style updates

## Authentication Architecture: Route Groups + Protected Layout

**Decision:** Use Next.js route groups with a centralized protected layout instead of page-by-page auth checks

**Why:**
- Single source of truth for authentication logic
- Impossible to forget auth on new pages (automatic protection)
- Clear separation between public and protected routes
- Maintainable and scalable architecture
- Prevents static generation issues with one `dynamic = 'force-dynamic'` export

**Pattern:**
```
/app
  /(protected)/layout.tsx    ← Auth check happens here
  /(protected)/page.tsx       ← Automatically protected
  /(protected)/*/page.tsx     ← Automatically protected
  /login/page.tsx             ← Public route (outside group)
```

**Rejected Alternative:** Adding `export const dynamic = 'force-dynamic'` to each individual page
- Reason: Fragile (easy to forget), repetitive, no centralized control
- This is a case where centralization was clearly better than repetition
