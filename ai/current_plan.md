# Current Plan - Updated 2/14/2026

## What's Complete

- **Phase 1: Rules → Intelligence Refactor** ✅
  - Replaced hardcoded grouping rules with AI-powered proposal organizer
  - Removed proposalDescription field entirely — single `name` field everywhere
  - Created style guide at `/data/proposal-style-guide.md` with examples (not rigid rules)
  - ID-based matching replaces string-based matching for AI responses
  - Manual "Organize for Proposal" trigger (not useEffect) to prevent render loops
  - 15-second timeout with fallback to ungrouped items

- **Phase 2: AI Organizer Bug Fixes** ✅
  - Fixed duplicate vendor items being sent to AI (was ~42, now ~24)
  - Added reconciliation step — missing items recovered as standalone after AI response
  - Debug console logging active in proposalOrganizer.ts

- **Phase 2b: Style Guide Improvements** ✅
  - Expanded flashing keywords: eave, rake, ridge, valley, w valley, sidewall, headwall, starter, drip edge, flashing, fab valley, fab ridge, fab eave, fab rake, fab sidewall, fab headwall, fab starter, fab drip edge
  - Kit names now include component summaries (e.g., "Custom Fabricated Metal Flashing — Eave, Rake, Ridge, Valley & Headwall pieces")
  - Added critical rule: NEVER rename user-entered item names — AI controls grouping/kit names only
  - Updated example in style guide to show component list format
  - Style guide is read dynamically by API route at runtime

- **Phase A: Knowledge Base Foundation** ✅ (Feb 14, 2026)
  - Created /lib/knowledge/roofing-rules.md
  - Created /lib/knowledge/multi-structure-rules.md
  - Created /lib/knowledge/validation-rules.md
  - Domain knowledge ready for AI consumption

- **Phase B: Database Schema + TypeScript Types** ✅ (Feb 14, 2026)
  - Migration: supabase/migrations/20260214_add_ai_project_context.sql
  - New table: ai_project_context with company-based RLS
  - TypeScript interfaces: AIDetectedStructure, AIProjectContext, AIMessage, AIWarning, AIValidationResult
  - Build passing, migration applied to Supabase

## What's In Progress

- **Phase C: Core AI Agent Logic** (Next)
  - Build /lib/ai/project-manager.ts with AI functions
  - Create API route /app/api/project-manager/route.ts
  - Create React hook useProjectManager

## What's Next

1. Complete Phase C (AI agent core)
2. Phase D (Integration into existing workflow)
3. Phase E (UI components)
4. Verify Phase 2b — Test PDF output with updated style guide
5. Clean up debug logging — Remove console.logs from proposalOrganizer.ts once stable
6. Future: Additional vendors — TRA Snow & Sun, Rocky Mountain Snow Guards integration
7. Future: Business dashboard — Trello integration, lead tracking, performance metrics

## Known Issues / Blockers

- None currently — awaiting test results

## Notes

- Numbers verified on 39 W Lupine: PDF total ($141,769.07) matches internal view exactly
- PDF line items sum correctly (off by 1 penny from rounding — acceptable)
- AI organizer successfully groups small items into kits, keeps $1,500+ items standalone
- Labor, Equipment, Optional items all showing correctly on PDF
