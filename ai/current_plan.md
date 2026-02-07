# Current Plan - Updated 2/7/2026

## What's Complete
- Phase 1: Stripped proposalDescription, single name field everywhere
- Phase 2 Core: AI proposal organizer with ID-based matching
- Style guide created at /data/proposal-style-guide.md
- React hooks violation fix (CategorySection extraction)
- Infinite render loop fix (useVendorQuotes + manual trigger replacing useEffect)
- Deselect checkboxes restored in EstimateBuilder

## What's In Progress — Phase 2 Bugs
### Bug 1: Duplicate items sent to AI organizer
- proposalOrganizer.ts adds vendor items twice (from estimate.byCategory AND vendorQuoteItems)
- Results in 42 items sent when should be ~24
- AI treats duplicates as separate items, creating duplicate lines on PDF
- FIX: Only loop through estimate.byCategory, don't separately add vendorQuoteItems

### Bug 2: Missing items in AI response
- Installation labor line missing from AI response entirely
- Causes PDF total to be wrong
- FIX: After AI response, check all itemMap IDs are accounted for. Add missing ones as standalone groups.

### Bug 3: Renamed items showing original name on PDF
- User renames "Schafer AG Panel 26ga SMP STANDARD COLOR TBD" → "Schafer AG Panel 26ga SMP"
- PDF shows BOTH names because of the duplicate items bug above
- Should resolve once Bug 1 is fixed

## Debug Logging Active
- proposalOrganizer.ts logs items sent and AI response to console
- Keep this until bugs are resolved

## What's Next
- Fix the three bugs above
- Test with clean estimate (no silly names)
- Verify PDF matches estimate view exactly
- Add valid ID range to AI prompt to prevent hallucinated IDs
- Deploy to Vercel once stable

## Architecture Decisions
- AI organizes presentation only (names, grouping) — never touches math
- ID-based matching (not string matching) for AI response processing
- Style guide at /data/proposal-style-guide.md guides AI grouping preferences
- Manual trigger for organization (not useEffect) to prevent render loops
- 15-second timeout with fallback to ungrouped items
