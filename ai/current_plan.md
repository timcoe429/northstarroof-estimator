# Current Plan

## Last Updated
January 25, 2026

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

## What's Next

- [Next task to be determined]

## Notes

- Main component: [`components/RoofScopeEstimator.tsx`](components/RoofScopeEstimator.tsx)
- API routes in [`app/api/`](app/api/)
