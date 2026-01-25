# Decisions Log

## Architecture

- **Next.js 14 App Router**: Chosen for modern React patterns, server components, and built-in API routes. Simplifies routing and enables efficient data fetching.
- **Supabase for Backend**: Provides database, authentication, and storage in one platform. Row-level security ensures users only access their own data.
- **Custom Hooks Pattern**: Extracted complex state logic into reusable hooks (`useMeasurements`, `useEstimateBuilder`, `usePriceList`, etc.) to keep main component manageable and improve testability.
- **TypeScript (strict: false)**: Using TypeScript for type safety but keeping strict mode disabled for faster development. Can enable strict mode later if needed.

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
