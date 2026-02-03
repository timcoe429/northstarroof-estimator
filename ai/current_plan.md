# Current Plan

## Last Updated
February 2, 2026

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
- **Phase 2: Quote Save/Load Data Loss Fixes** ✅
  - Fixed quantity restoration bug (baseQuantity ?? instead of ||)
  - Fixed vendor item quantities merging on load
  - Added isLoadingQuote flag to prevent recalculation overwrite
  - Added missing database columns (sundries_percent, sundries_amount, waste_percent, job_description)
  - Fixed recalculation timing race condition
- **Phase 2b: Custom Items Restoration** ✅
  - Fixed custom items not restoring on quote load
  - Exposed setCustomItems from useCustomItems hook
  - Wired up onSetCustomItems callback
- **Phase 3: Margin Distribution Fix** ✅
  - Fixed markupMultiplier formula (was 1.54x, now uses effectiveMultiplier)
  - Client view line items now sum correctly to sellPrice
  - Sundries, vendor tax, office overhead distributed proportionally
  - PDF generation matches web client view
- **Phase 4: Price List UX Fix** ✅
  - Fixed duplicate editingItem state between hooks
  - New items now enter edit mode immediately
  - Deferred database save until user clicks save
  - Edit and delete buttons work correctly
- **Phase 6: Auto-Calculate Accessories** ✅
  - Heat Tape calculation (eave ÷ 3 × 6 + valley)
  - Snow Guards/Snow Fence calculation (eave × rows based on pitch)
  - Metal roof detection (Schafer vendor quote)
  - Calculated Accessories section with editable quantities
  - Add to Estimate functionality for materials + labor
  - Optional skylights display (not included in totals)

## What's In Progress

- None currently

## What's Next

1. **Test Phase 6** — Verify calculations, add to estimate, PDF output
2. **Future: Additional vendors** — TRA Snow & Sun, Rocky Mountain Snow Guards integration

## Known Issues / Blockers

- None currently

## Notes

- Phase 5 (Component Refactor) was already done — main component reduced from 4300 to ~824 lines
- Database columns added: sundries_percent, sundries_amount, waste_percent, job_description
- Price list items needed for Phase 6:
  - Heat Tape | materials | lf | $5.00
  - Heat Tape Install | labor | lf | $7.50
  - Snow Fence (ColorGard) | materials | lf | $12.00
  - Snow Fence Install | labor | lf | $5.00
  - RMSG Yeti Snowguard | materials | each | $7.00 (exists)
  - Snowguard Install | labor | each | $5.00 (exists)
  - Skylight | accessories | each | $2,400
