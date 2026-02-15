# Current Plan

## Last Updated
February 15, 2026

## What's Complete

- Image extraction from RoofScope/EagleView screenshots using Claude API
- Price sheet parsing and auto-population from pasted images
- Multi-step estimate builder (upload → measurements → items → review)
- Financial controls (waste %, office overhead %, profit margin %, sundries %)
- PDF proposal generation with custom templates
- Vendor quote parsing (Schafer, TRA, Rocky Mountain)
- Schafer quote system — vendor items read-only, description library for client-facing names
- Saved quotes functionality (save, load, delete)
- Custom items creation
- Price list management (98 items across materials, labor, equipment, accessories, schafer)
- Authentication with Supabase (company-based data ownership)
- Mobile responsive UI
- Custom hooks architecture for state management
- Phase 1: Rules → Intelligence refactor (AI-powered proposal organizer) ✅
- Phase 2: AI Organizer bug fixes ✅
- Phase 2b: Style guide improvements ✅
- Multi-structure AI detection from RoofScope ✅
- Multi-RoofScope PDF merge (measurements sum across PDFs) ✅
- PDF upload to Supabase Storage (bypasses Vercel 4.5MB limit) ✅
- Component refactor (4,300+ lines → modular hooks/components) ✅
- Auto-selection rules (underlayment, nails, equipment based on roof type) ✅
- Calculated accessories (heat tape, snow guards, snow fence, skylights) ✅
- **Phase A: Roof System Knowledge Files** ✅
  - Created 7 knowledge files: universal-rules.md, standing-seam-metal.md, brava-tile.md, davinci-shake.md, asphalt-shingle.md, cedar.md, flat-low-slope.md
  - Located in `/data/knowledge/`
  - Roof system selector dropdown (stored in state + saved to DB)
  - New `/api/smart-selection` route loads knowledge files server-side, builds dynamic prompt
  - Smart Selection no longer uses hardcoded rules — uses knowledge file contents
  - Auto-selection rules accept explicit roof system as override
  - Job description made optional for Smart Selection
  - Zero-quantity vendor items deselected by default
  - `roof_system` TEXT column added to estimates table
- **Phase B: Setup/Build/Review Flow with Per-Building Tabs** ✅
  - New 3-step flow: setup → build → review (replaces upload → extracted → estimate)
  - `BuildingEstimate` type created (structureId, structureName, roofSystem, measurements, selectedItems, itemQuantities, vendorQuoteItemIds)
  - `buildings` state array + `activeBuildingIndex` in RoofScopeEstimator
  - Tab switching uses ref pattern (currentBuildingRef) + single setBuildState call to prevent race conditions
  - `SetupStep.tsx` created — RoofScope upload, detected structures with roof system dropdowns, vendor quotes, customer info
  - `BuildStep.tsx` created — per-building line items with building tabs
  - `BuildingTabs.tsx` created — All Combined + per-building tabs
  - `buildings` JSONB column added to estimates table
  - Backward compatibility: old saved quotes (no buildings array) load as single-building
- **SetupStep UI restoration** ✅
  - Structure cards with full measurements (Pitch, Eave, Valley, Ridge), Detailed/Estimated badge, roof system dropdown
  - AI processing indicators (extraction + structure detection inline banners)
  - Standalone "Add Another RoofScope" button with Plus icon
  - AI Detection Confidence banner when present
  - Compact layout (space-y-4, compact customer info grid)
- **React render loop fix** ✅
  - Added `skipValidation` parameter to `calculateEstimate` to prevent setState-during-render infinite loop
  - All Combined tab now passes `skipValidation: true` when calculating read-only display
- **Smart Selection API improvements** ✅
  - Job description made optional — roof system + measurements are sufficient for Smart Selection
  - "Generate Smart Selection for All Buildings" button on All Combined tab
- **cleanedSelection filter fix** ✅
  - Quantity calculation now happens BEFORE filtering inside `runSmartSelectionForBuilding`
  - Items no longer incorrectly filtered out due to missing quantities
  - Fixes issue where only 2 items (Brava Delivery + Rolloff) were selected instead of 15+
  - `calculateItemQuantitiesFromMeasurements` called with measurements, priceItems, and isTearOff before cleanedSelection runs
- **Build step UX improvements** ✅
  - Build step shows raw cost only (no markup) with "Before office overhead and margin — markup is applied in Review" label
  - "Continue to Review →" button added to Build step
- **Brava Starter quantity fix** ✅
  - Uses coverage-based linear calculation with Math.ceil when coverage exists in DB
  - Properly calculates from (eave_length + rake_length) / coverage
- **Coverage data restoration** ✅
  - Coverage data restored in Supabase for ALL materials (Brava, DaVinci, copper, aluminum, underlayments, fasteners, low slope)
  - Coverage was wiped during earlier price list rebuild — all restored from product specifications
  - OC Titanium PSU 30 corrected to coverage=2 sq/roll (was incorrectly set to 10)
  - Brava Solids coverage_unit changed to 'lf' (valley/rake detail work, not full coverage)
- **Claude Code Desktop integration** ✅
  - Claude Code Desktop introduced as primary tool for surgical fixes
  - `.claude/` added to `.gitignore`, worktree cleanup done

## What's In Progress

- **Quantity calculations need retest** after coverage data restore
- **PDF/Proposal issues identified** but not yet fixed:
  - Cover letter says "Brava Starter" instead of "Brava Composite Tile"
  - No per-building breakdown in PDF for multi-structure properties
  - Floating point display (84.85999999999999 sq) needs rounding

## What's Next (Priority Order)

1. **Retest full flow with corrected coverage data** — Verify all quantities make sense after coverage data restore
2. **Fix PDF proposal issues**:
   - Add per-building breakdown for multi-structure properties
   - Correct roof system name in cover letter (use display name, not item name)
   - Round floating point numbers in measurements display
3. **Add labor default to knowledge files** — Hugo standard $550/sq as default, user adjusts manually based on pitch/complexity/availability
4. **Overnight auto-select verification** — Verify in multi-building context
5. **Per-building sum vs combined total reconciliation** — Investigate difference (may be from items not attributed to buildings)

## Blockers / Notes

- **None currently** — coverage data restored, code fixes deployed
- Porto Potty price discrepancy: DB has $550, Omiah says $600 ($150 delivery + $150 pickup + $150/month × 2). Need to confirm correct price and update.
- Duplicate snow fence install items: "Snow Fence Install" and "Snowfence Install" both at $5/lf. Should consolidate.
- Sergio labor at $129/sq seems very low vs Hugo ($550-750) and Alfredo ($1,136). May be a helper/supplement, not full crew. Clarify with Omiah.
- Cedar and asphalt shingle primary materials not yet in price list. Users need to add custom items or upload supplier quotes for these systems.
- Non-ringshank nail items (1¾" and 1½") not in price list for asphalt systems.
