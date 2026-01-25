# Project Context

## What This Is

A roofing estimate calculator that extracts measurements from RoofScope/EagleView screenshots using AI and builds accurate estimates with materials, labor, equipment, and accessories. Users can paste price sheets to auto-populate pricing, configure financial controls (waste %, office overhead %, profit margin %), and generate professional PDF proposals.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Supabase (database, authentication, storage)
- **AI**: Anthropic Claude API (image extraction for measurements and price sheets)
- **Hosting**: Vercel (auto-deploy from GitHub)
- **PDF Generation**: pdf-lib

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
