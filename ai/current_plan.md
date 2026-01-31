# Current Plan

## Last Updated
January 31, 2026

## What's Complete

- Image extraction from RoofScope/EagleView screenshots using Claude API
- Price sheet parsing and auto-population from pasted images
- Multi-step estimate builder (upload → measurements → items → review)
- Financial controls (waste %, office overhead %, profit margin %, sundries %)
- PDF proposal generation with custom templates
- Vendor quote parsing (Schafer, TRA, Rocky Mountain)
- Schafer quote system - description library only, quote items are read-only
- Saved quotes functionality (save, load, delete)
- Custom items creation
- Price list management
- Authentication with Supabase
- Mobile responsive UI
- **Estimate Builder UX Overhaul** (January 2026):
  - Green box for selected items - clear visual separation at top
  - Collapsible section headers - large navy blue (#00293f) headers with chevron icons
  - Improved quantity parsing - AI now correctly extracts explicit quantities (e.g., "2 dumpsters" → quantity = 2)
- **Major Refactoring - Phase 4 & 5** (January 2026):
  - Extracted 9 UI components from main file into [`components/estimator/`](components/estimator/)
  - Created custom hooks for business logic in [`hooks/`](hooks/)
  - Reduced main component from 4,000 lines to 824 lines (79% reduction)
  - Improved code maintainability with clear separation of concerns
  - All hooks: useFinancialControls, useUIState, useCustomItems, usePriceItems, useVendorQuotes, useImageExtraction, useSmartSelection, useSavedQuotes, useEstimateCalculation
  - Fixed paste handler for RoofScope uploads (Ctrl+V functionality restored)

## What's Next

- Continue testing and refinement
- Monitor for any issues with refactored code
- Future enhancements as needed

## Verified Features

All critical features verified after refactor:
- ✅ Smart grouping for client view/PDF proposals (items $1,500+ standalone, others grouped into kits)
- ✅ Waste % defaults to 10 for new estimates
- ✅ Validation warnings working:
  - Waste % is 0 → warning
  - No labor selected → warning
  - No underlayment → warning
  - Margin too low (<25%) or too high (>60%) → warning
  - No drip edge → warning
  - Materials cost seems low → warning

## Notes

- Main component: [`components/RoofScopeEstimator.tsx`](components/RoofScopeEstimator.tsx) (now 824 lines, down from 4,000)
- UI Components: [`components/estimator/`](components/estimator/)
- Custom Hooks: [`hooks/`](hooks/)
- API routes in [`app/api/`](app/api/)
