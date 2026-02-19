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

## 2/16/2026 - Track Isolation Architecture

- **Two tracks**: Single-building (Track 1, production) and Multi-building (Track 2, development)
- Multi-building code is ADDITIVE ONLY — never modifies single-building code paths
- Multi-building lives on feature branches, never direct to main
- Reverted to commit 2be0a57 (pre-multi-building) as stable baseline

## 2/16/2026 - Commit Safety Rules

- Max 3 files per commit
- Always audit before fixing (two separate prompts)
- Feature branches for new work, not direct to main
- Protected files list: RoofScopeEstimator.tsx, EstimateView.tsx, generateProposal.ts, clientViewBuilder.ts
- Claude Code banned for multi-file changes — Cursor only

## 2/16/2026 - Roofing Business Rules Master Reference

### Underlayment
- OC Titanium PSU 30 ($145/roll, 2 sq) — ALWAYS on every roof
- GAF VersaShield ($200/roll) — metal roofs ONLY, in addition to PSU 30
- SolarHide Radiant Barrier ($340/roll) — ALL non-metal roofs, in addition to PSU 30
- Sharkskin — NO LONGER AUTO-SELECTED. Replaced by SolarHide.
- Grace Ice & Water High Temp — supplemental only for valleys/eaves, NOT primary underlayment

### Flashing Defaults
- Brava/DaVinci/asphalt/cedar: DEFAULT to standard aluminum. Copper only if user specifies.
- Metal roofs: ALL flashing from Schafer vendor quote

### Fasteners
- Synthetic (Brava, DaVinci): 1 3/4" ringshank nails
- Presidential asphalt: 1 3/4" non-ringshank
- Basic asphalt: 1 1/2" non-ringshank
- Metal: from Schafer vendor quote
- All systems: 1.25" Plasticap Pail for underlayment

### Snow Retention
- Metal roofs: snow fence (ColorGard) $12/lf + install $5/lf
- Synthetic & asphalt: Snow Guard $7/ea + install $5/ea
- Rows by pitch: 1-4/12=1, 5-7/12=2, 8-10/12=3, 11-12/12=4
- NEVER mix snow fence and snow guards

### Optional Items (show on PDF, excluded from Quote Total)
- Heat Tape: material $5/lf + labor $7.50/lf
- Snow Guard: $7/ea + install $5/ea
- Snow Fence (ColorGard): $12/lf + install $5/lf
- Skylights: $2,400 each

### Equipment & Fees
- Porto Potty: $600/job
- Landfill Charge: $750/each (was "Rolloff")
- Fuel Charge: $194/job
- Overnights: $387/night — auto-include for Hugo or Sergio crews
- Brava Delivery: $5,000 flat — always include for Brava jobs

### Margin Rules
- Materials + Labor: full markup (office + margin)
- Equipment & pass-throughs (delivery, landfill, fuel, porto potty, overnights): office overhead ONLY, no profit margin

### Labor
- One crew per job
- Hugo (12/12): $750/sq, Hugo (8-11/12): $650/sq, Hugo (<8/12): $550/sq
- Alfredo: $1,136/sq, Chris: $750/sq, Sergio: $129/sq

## 2/16/2026 — Track 1 Stabilization Session

### AI Organizer Removed
- Removed AI proposal organizer from PDF pipeline (had race condition, inconsistent results)
- PDF now uses deterministic line items — what you see in Build step is what shows on PDF
- proposalOrganizer.ts still in codebase but unused

### Knowledge Files Wired Up
- Created /app/api/smart-selection/route.ts to load knowledge files server-side
- Smart selection detects roof system from job description keywords
- Loads universal-rules.md + roof-specific file (e.g., brava-tile.md)
- Inline rules in useSmartSelection.ts kept as fallback

### Knowledge File Fixes Applied
- Removed copper as default flashing (aluminum is default, copper only if explicitly requested)
- Removed Sharkskin from all files (replaced by SolarHide)
- Removed Flat Sheet from standard flashing lists (custom fabrication only)
- Fixed snow guard name: "RMSG Yeti Snowguard" → "Snow Guard"
- Fixed equipment names: "Rolloff" → "Landfill Charge", "Overnights" → "Overnight Charge"
- Added Hugo as default labor crew in all roof system files
- Added "always include" rule for Landfill Charge, Porto Potty, Fuel Charge

### Split Multiplier Implemented
- Equipment items get office overhead only: cost × (1 + officeCostPercent/100)
- Materials, labor, accessories, schafer get full markup
- Math ensures total still equals finalPrice

### Deterministic Kit Grouping Added
- lib/kitGrouping.ts groups small items into named kits for PDF display
- Aluminum Flashing Kit: D-Style Eave, Rake, Valley, Step Flash, Headwall, Hip & Ridge
- Copper Flashing Kit: same items with copper variants
- Fasteners & Hardware Kit: nails, screws, plasticap
- Kit items group regardless of price; non-kit items use $1,500 threshold
- Subtitles show individual items and prices within each kit

### Overnight Charge Fix
- Added "overnight" to flat fee detection in 3 locations (useEstimateCalculation.ts, RoofScopeEstimator.tsx)
- Fixed "overnights" plural typo to "overnight" singular

## 2/19/2026 - Shareable Review Page Links (24-Hour Expiration)
- share_tokens table: token, estimate_id, expires_at; 24hr expiry
- POST /api/share: authenticated; saves estimate (customer_info JSONB), creates share_token; returns shareUrl
- Client sends Authorization: Bearer <session.access_token> for RLS
- Share page (/share/[token]): interactive review with sliders, collapsible sections, FinancialSummary; no Re-upload/Download PDF
- 410 for expired → ExpiredLinkPage; 404 → NotFoundPage

## 2/19/2026 - Intro Letter from CSV + Line Item Name — Description
- **Intro category in CSV**: Category "Intro" rows store Description as estimate.introLetterText; excluded from line items and totals; PDF uses custom intro when present, AI otherwise
- **Item/Description columns**: Standard format — Item column → name, Description column → proposalDescription; parse both always
- **PDF line item format**: "Item Name — Description" with name in bold, description in italic (HelveticaOblique)

## 2/19/2026 - Proposal Description and Intro Letter
- **Proposal descriptions**: Check descriptionMap first (exact/case-insensitive), then batch AI for unmatched. Format: "Generic Name — One sentence" (15–30 words). Avoid model numbers/SKUs in descriptions.
- **Intro letter**: Simplified from structured (GREETING, BODY_PARA, BULLET) to plain letter: Dear Homeowner, 2–3 paragraphs, no bullets, under 200 words. Job details pulled from estimate (address, material, scopeItems, pitch, totalSquares). Fixed Kind regards signature block.

## 2/20/2026 - Share Link Bug Fixes
- **Bug 1 (path-only URL):** createShareableLink ran server-side where window was undefined; baseUrl fell back to ''. Fixed: use NEXT_PUBLIC_URL with fallback to https://estimator.northstarroof.com. NEXT_PUBLIC_URL must be set in Vercel.
- **Bug 2 (Estimate Not Found):** estimates RLS blocked anon reads. Added policy estimates_select_via_share_token allowing SELECT when valid non-expired share_tokens row exists (migration 20260220).
