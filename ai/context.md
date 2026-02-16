# Project Context

## What This Is

A roofing estimate calculator that extracts measurements from RoofScope/EagleView screenshots using AI and builds accurate estimates with materials, labor, equipment, and accessories. Users can paste price sheets to auto-populate pricing, configure financial controls (waste %, office overhead %, profit margin %), and generate professional PDF proposals.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Supabase (database, authentication, storage)
- **AI**: Anthropic Claude API (image extraction for measurements and price sheets)
- **Hosting**: Vercel (auto-deploy from GitHub)
- **PDF Generation**: pdf-lib

## Data Architecture

**Company-Based Ownership**: All business data (price_items, estimates, customers) is owned by companies, not individual users. This prevents data loss when users are deleted or recreated. Users belong to companies and can access all data within their company. The `company_id` field is used for access control via Row Level Security (RLS) policies.

## Documentation

For detailed information, see:
- [`.cursorrules`](.cursorrules) - Coding standards, constraints, and development guidelines
- [`docs/PROJECT-STRUCTURE.md`](docs/PROJECT-STRUCTURE.md) - File structure and organization
- [`docs/DATABASE.md`](docs/DATABASE.md) - Database schema and tables
- [`docs/QUICK-START.md`](docs/QUICK-START.md) - Setup and deployment instructions
- [`README.md`](README.md) - Project overview and features

## Non-Negotiables

- TypeScript (strict: false for now)
- Tailwind CSS only (no external UI libraries)
- Explain changes before making them (WHAT, WHY, IMPACT)
- Use 'use client' directive for client components
- Keep components in `/components` folder
- Keep types in `/types` folder

## What We Don't Want

- Unnecessary dependencies
- Refactoring unless explicitly asked
- Changing unrelated code
- Strict TypeScript without being asked
- External UI component libraries

## Target Users

Roofing contractors who need to:
- Quickly extract measurements from RoofScope/EagleView reports
- Build accurate estimates with proper material calculations
- Manage pricing from vendor quotes
- Generate professional proposals with financial controls
- Save and manage multiple estimates

## Vendor Quote Workflow

- **Schafer Quotes**: Required for metal roofs. Uploaded quote is the ONLY source of truth for pricing and quantities. All quote items are extracted exactly as quoted. Quote items are read-only in estimate builder (can deselect but cannot edit quantity/price).
- **Other Vendors** (TRA, Rocky Mountain): Quotes can be uploaded and items selected into estimates. Items can be edited if needed.

## Track Architecture (Added 2/16/2026)

### Track 1: Single-Building (PRODUCTION)
- Current working app on main branch
- Upload → Extracted → Estimate flow
- All bug fixes and improvements go here first
- Must always be deployable

### Track 2: Multi-Building (DEVELOPMENT)
- Feature branches only (e.g., feature/multi-building)
- Setup → Build (with tabs) → Review flow
- Previous work preserved on branch: backup-multi-building-work
- Will be re-implemented with additive-only approach
- Must not modify any Track 1 code paths

## Knowledge File Architecture (Added 2/16/2026)
- Knowledge files live in data/knowledge/ (7 files: 6 roof systems + universal rules)
- Loaded server-side via /app/api/smart-selection/route.ts
- Smart selection hook detects roof system and requests matching file
- Knowledge files are the SOURCE OF TRUTH for material selection rules
- Inline rules in useSmartSelection.ts are FALLBACK only
- To change what gets selected: edit the knowledge .md file, not the code

## Kit Grouping Architecture
- lib/kitGrouping.ts contains deterministic grouping rules
- Called in lib/clientViewBuilder.ts after markup is applied
- Display-only: changes PDF appearance, not underlying math
- Kit definitions are hardcoded rules, not AI-powered
