# Current Plan — Updated 2/16/2026

## What's Complete (Track 1: Single-Building)
- ✅ **Phase 3 (Feb 2026)**: CSV upload flow replaces RoofScope/vendor flow
  - CSV parser (lib/csvParser.ts): Name, Address, Description, Quantity, Unit Price, Total, Category, Notes
  - Estimate validator (lib/estimateValidator.ts): line totals, category sums, warnings
  - Recalculate financials (lib/recalculateFinancials.ts): margin, waste, office, tax
  - app/estimate/page.tsx: upload → review with 4 sliders → PDF download
  - Home (/) redirects to /estimate
  - Old components removed: RoofScopeEstimator, UploadStep, ReviewStep, EstimateBuilder, CalculatedAccessories, PriceListPanel
- ✅ FinancialSummary, CollapsibleSection, EstimateView (for share) retained
- ✅ PDF generation via generateProposalPDF (unchanged)

## Known Issues (Minor — Not Blocking)
- Decimal places on PDF prices (e.g., $23,496.89 vs $23,497)

## STABLE FALLBACK POINT
Current commit on main is 95% working for single-building estimates. 
If anything breaks, revert to THIS commit before proceeding.
Tag this deployment in Vercel as stable.

## What's Next
1. Multi-building (Track 2) — feature branch only, additive code, does not touch Track 1
2. Share button on estimate page (save + share flow)
3. Decimal cleanup on PDF prices
