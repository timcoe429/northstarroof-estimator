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

- **Multi-Step Workflow**: Upload → Measurements → Items → Review flow guides users through estimate creation systematically.
- **Paste-to-Extract**: Users can paste images directly (Ctrl+V) to extract measurements or prices, reducing friction.
- **Financial Controls**: Waste %, office overhead %, profit margin %, and sundries % are configurable per estimate. These affect final pricing calculations.
- **Smart Item Suggestions**: AI analyzes job description and measurements to suggest relevant items (e.g., "steep pitch" suggests high-slope products).
- **Vendor Quote Integration**: Vendor quotes can be imported and items selected directly into estimates, maintaining pricing accuracy.
- **Saved Quotes**: Estimates can be saved with customer info, measurements, and line items for future reference or modification.
