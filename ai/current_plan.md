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
3. Decimal cleanup on PDF prices

## Completed 2/19/2026: Proposal Description and Introduction Letter Updates
- **Proposal descriptions**: descriptionMap in constants.ts used as lookup; AI generates for unmatched items via batch /api/extract; PDF line items show generic "Name — Sentence" format
- **Introduction letter**: New format — Dear Homeowner, 2–3 paragraphs (no bullets), under 200 words; job details (address, material, scope, pitch, squares) from estimate; Kind regards signature block
- **Files changed**: lib/generateProposal.ts, lib/constants.ts (D-Style Eave, RMSG Yeti Snowguard, Airhawk updated to new format)

## Completed 2/19/2026: Intro Letter CSV + Line Item Display
- **Intro category**: CSV rows with Category "Intro" (case-insensitive) — Description stored as introLetterText, skipped from line items; used directly for PDF intro when present (AI fallback otherwise)
- **Item/Description columns**: Item → name, Description → proposalDescription; always parse both
- **Line item PDF format**: "Item Name — Description" with Name in HelveticaBold, Description in HelveticaOblique; no trailing dash when description empty
- **Files**: lib/csvParser.ts, types/index.ts (introLetterText on Estimate, proposalDescription on LineItem), lib/generateProposal.ts

## Completed 2/19/2026: Shareable Review Page Links (24-Hour Expiration)
- **share_tokens** table: estimate_id, token, expires_at, accessed_at; 24hr expiry
- POST /api/share: saves estimate + creates share_token; requires auth (Bearer token)
- GET /api/share/[token]: returns estimate or 410 (expired) / 404 (not found)
- "Share with Owner" button on estimate page → modal with copy-to-clipboard
- Public share page (/share/[token]): interactive review with sliders, collapsible sections, financial breakdown
- No Re-upload CSV or Download PDF on shared page; "Expires in 24 hours" banner
- ExpiredLinkPage and NotFoundPage for invalid/expired links
