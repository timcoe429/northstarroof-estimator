# Current Plan

## Last Updated
February 14, 2026

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

## What's Partially Done

- None

## What's Next (Priority Order)

1. **Test Phase B end-to-end** — Single structure: setup → select roof system → build → items display → review. Multi-structure: multiple cards → different roof systems → tabs → switching swaps items/measurements.
2. **Phase C: PDF Generation with Multi-Building Sections** — Proposal generates per-building sections, grand total at end, AI organizer runs per section.
3. **Context file updates** — After Phase B is tested and stable.

## Blockers / Notes

- Porto Potty price discrepancy: DB has $550, Omiah says $600 ($150 delivery + $150 pickup + $150/month × 2). Need to confirm correct price and update.
- Duplicate snow fence install items: "Snow Fence Install" and "Snowfence Install" both at $5/lf. Should consolidate.
- Sergio labor at $129/sq seems very low vs Hugo ($550-750) and Alfredo ($1,136). May be a helper/supplement, not full crew. Clarify with Omiah.
- Cedar and asphalt shingle primary materials not yet in price list. Users need to add custom items or upload supplier quotes for these systems.
- Non-ringshank nail items (1¾" and 1½") not in price list for asphalt systems.
