# Current Plan - Updated 2/7/2026

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

## What's In Progress

- **Testing Phase 2b** — Style guide improvements applied, needs testing on 39 W Lupine estimate to verify:
  - W Valley groups into flashing kit
  - Flashing kit name shows components
  - All other grouping still works
  - Numbers unchanged

## What's Next

1. **Verify Phase 2b** — Test PDF output with updated style guide
2. **Clean up debug logging** — Remove console.logs from proposalOrganizer.ts once stable
3. **Future: Additional vendors** — TRA Snow & Sun, Rocky Mountain Snow Guards integration
4. **Future: Business dashboard** — Trello integration, lead tracking, performance metrics

## Known Issues / Blockers

- None currently — awaiting test results

## Notes

- Numbers verified on 39 W Lupine: PDF total ($141,769.07) matches internal view exactly
- PDF line items sum correctly (off by 1 penny from rounding — acceptable)
- AI organizer successfully groups small items into kits, keeps $1,500+ items standalone
- Labor, Equipment, Optional items all showing correctly on PDF
