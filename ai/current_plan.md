# Current Plan

## Last Updated
February 1, 2026

## What's Complete

- Image extraction from RoofScope/EagleView screenshots using Claude API
- Price sheet parsing and auto-population from pasted images
- Multi-step estimate builder (upload → measurements → items → review)
- Financial controls (waste %, office overhead %, profit margin %, sundries %)
- PDF proposal generation with custom templates
- Vendor quote parsing (Schafer, TRA, Rocky Mountain)
- Schafer quote system overhaul - converted from pricing system to description library only
- Fixed vendor quote extraction - captures ALL line items with exact quantities/prices
- Schafer quote items are read-only (quote is source of truth)
- Saved quotes functionality (save, load, delete)
- Custom items creation
- Price list management
- Authentication with Supabase
- Mobile responsive UI
- Custom hooks architecture for state management
- **Quote Save/Load Data Loss Fixes (Phase 2):**
  - Fixed quantity restoration bug (baseQuantity ?? instead of ||)
  - Fixed vendor item quantities not merging on load
  - Added isLoadingQuote flag to prevent recalculation overwrite
  - Added missing database columns (sundries_percent, waste_percent, job_description)
  - Fixed recalculation timing race condition

## What's Partially Done

- **Quote Save/Load Fixes** — Code complete, build passing, NEEDS TESTING

## What's Next (Priority Order)

1. **TEST Save/Load Fixes** — Verify quotes save and load with correct totals
2. **Phase 3: Fix Margin Distribution** — Client view line items don't add up to total
3. **Phase 4: Fix Price List UX** — New items can't be edited/deleted
4. **Phase 5: Component Refactor** — Break up 4300+ line monolith (optional, do when stable)

## Known Issues (Not Yet Fixed)

- **Margin distribution incorrect** — markupMultiplier formula wrong (1.54x vs 1.833x)
- **Sundries not distributed** — 10% materials allowance not spread to client line items
- **Vendor tax not distributed** — Tax not spread across vendor items in client view
- **New item creation bug** — Items appear blank and can't be edited/deleted
- **4300+ line component** — RoofScopeEstimator.tsx needs refactoring

## Notes

- Phase 1 (Diagnosis) revealed 5 root causes for save/load data loss
- Phase 2 fixes have been implemented but not yet tested
- Next session: Start with testing save/load, then move to Phase 3
