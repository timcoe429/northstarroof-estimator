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

## AI Project Manager Architecture (February 2026)

- **Decision**: Scrap rules-based multi-structure detection, build Full AI Project Manager instead
- **Why**: Rules-based approach (Phase 1) was too brittle with cascading edge cases. AI agent with knowledge base provides flexibility and intelligence.
- **Implementation**:
  - Knowledge base in markdown files (easy to update without code changes)
  - AI reads rules and makes contextual decisions
  - Company-based ownership prevents data loss (lesson from previous incident)
  - Structure detection, material validation, completeness checking all AI-driven
- **Git backup**: Tagged `pre-multi-structure-v1` before starting AI approach

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

## Feb 14, 2026

### Supabase Storage for PDF uploads
- Chose Supabase Storage over Vercel Blob, Edge Runtime, or PDF.js page splitting
- Supabase already in stack, least new dependencies, private bucket with RLS
- Upload to roofscope-temp bucket, send signed URL to API, API fetches and converts to base64

### Multi-RoofScope merge strategy
- mergeMeasurements sums numeric fields (not overwrite)
- Structure detection re-runs with all PDF URLs, returns combined structure list
- Race condition handled with latestDetectionRef pattern

### Building tabs approach
- Tabs per building + "All Combined" tab
- Per-building state stored separately, active tab swaps display
- Single useEstimateCalculation hook — cannot run multiple instances (has internal state)

### Roof system architecture (planned)
- Split estimate flow into Setup step + Build step
- Each building gets assigned a roof system
- Each roof system has its own AI knowledge file
- Smart Selection reads the relevant knowledge file per building
- Systems: Brava tile, DaVinci tile, asphalt shingle, standing seam metal, flat/low slope, cedar shake, cedar shingles

## Roof System Knowledge Files (Feb 14, 2026)
- Created individual knowledge files per roof system instead of one monolithic prompt
- 6 system files + 1 universal rules file in `/data/knowledge/`
- AI loads universal + system-specific file based on user's roof system selection
- Asphalt Presidential and Standard share one file with sub-type passed as context
- Cedar and flat/low-slope included even though primary materials not yet in price list

## Setup/Build/Review Step Flow (Feb 14, 2026)
- Replaced upload → extracted → estimate with setup → build → review
- Setup: upload RoofScope, detect structures, assign roof systems per building, vendor quotes, customer info
- Build: per-building tabs with line items, Smart Selection uses that building's knowledge file
- Review: financial summary, PDF generation, save
- Single-building is treated as multi-building with 1 entry (no separate code paths)
- Tab switching uses ref pattern + single state update to prevent React batching race conditions
- "All Combined" tab is read-only display, editing happens on individual building tabs

## Smart Selection API Route (Feb 14, 2026)
- Moved from client-side hardcoded prompt to server-side `/api/smart-selection` route
- Route reads knowledge files with fs.readFileSync (same pattern as organize-proposal)
- Job description is optional — roof system + measurements are sufficient for Smart Selection

## Claude Code Desktop for Surgical Fixes (Feb 15, 2026)
- **Decision**: Use Claude Code Desktop for targeted single-file bug fixes, Cursor for bigger architectural work
- **Why**: Claude Code excels at focused debugging and surgical changes. Cursor better for multi-file refactors and architectural decisions.
- **Pattern**: Tell Claude Code: "Work on main branch, no worktrees, commit and push to origin."
- **Integration**: `.claude/` added to `.gitignore` to avoid cluttering repo with Claude's workspace files

## Labor Default to Hugo Standard (Feb 15, 2026)
- **Decision**: Default labor crew to Hugo (standard) $550/sq on all estimates
- **Why**: Hugo is the standard crew, most common use case. User manually swaps crew if needed based on pitch/complexity/availability.
- **Implementation**: Knowledge files should reference Hugo as default labor option. AI Smart Selection will select Hugo unless job description specifies otherwise (e.g., "use Alfredo crew" or "steep pitch, premium install").

## Coverage Data Lives in DB (Feb 15, 2026)
- **Decision**: Coverage and coverage_unit MUST be populated in price_items table for quantity calculations to work
- **Why**: Without coverage data, quantity calculations fall back to incorrect defaults or show 0 quantities
- **Lesson**: Coverage data was lost during price list rebuild (bulk DB changes). Always verify coverage data after bulk operations.
- **Examples**:
  - OC Titanium PSU 30: coverage=2, coverage_unit='sq' (2 squares per roll)
  - Brava Field Tile: coverage=14.3, coverage_unit='sqft' (14.3 sq ft per bundle)
  - Copper Valley: coverage=10, coverage_unit='lf' (10 linear feet per piece)
  - Brava Solids: coverage=10, coverage_unit='lf' (used for valleys/rakes, not full coverage)

## Build Step Shows Raw Cost Only (Feb 15, 2026)
- **Decision**: Build step displays base quantities × prices without markup
- **Why**: Clearer separation of concerns. Build = item selection and quantities. Review = financial controls and markup.
- **Implementation**: 
  - Build step shows subtotals per category (materials, labor, equipment)
  - Label: "Before office overhead and margin — markup is applied in Review"
  - Markup (waste, office overhead, profit margin, sales tax) applied only in Review step
- **User Flow**: User can see raw costs in Build, then see final pricing in Review after markup is applied

## Brava Solids Are Linear Not Area (Feb 15, 2026)
- **Decision**: Brava Solids use coverage_unit='lf' (linear feet), not 'sq' or 'sqft'
- **Why**: Brava Solids are solid tiles used for valleys and rakes (detail work), not full roof coverage
- **Impact**: Quantity calculation uses valley_length and rake_length, not total_squares
- **Database**: coverage=10 (bundled in 10' pieces), coverage_unit='lf'

## Per-Building Breakdown Uses Building's Own Data (Feb 15, 2026)
- **Decision**: Never filter `combinedEstimate.lineItems` by building ID to calculate per-building totals
- **Why**: Combined estimate merges quantities (e.g., 4 buildings with same item = 4× quantity in one line item). Filtering by building ID gives incorrect totals (all buildings get the full combined total).
- **Correct Approach**: Calculate per-building totals from `building.itemQuantities × item.price` independently, before creating combined estimate
- **Example**: 
  - Wrong: `combinedEstimate.lineItems.filter(item => buildingItemIds.has(item.id))` → each building shows $25k (combined total)
  - Right: `Object.entries(building.itemQuantities).reduce((sum, [id, qty]) => sum + qty * item.price, 0)` → each building shows $6.25k (individual total)
