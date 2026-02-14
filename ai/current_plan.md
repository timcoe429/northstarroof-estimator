# Current Plan — Updated Feb 14, 2026

## Completed Today
- Supabase Storage for large PDF uploads (roofscope-temp bucket) — bypasses Vercel 4.5MB body limit
- Multi-RoofScope upload with "Add Another RoofScope" button
- Measurements merge correctly across multiple PDFs (sum, not overwrite)
- 6-structure detection across 2 PDFs (prompt updated for multi-document awareness)
- Race condition fix for structure detection (latestDetectionRef)
- Floating point display rounding in ReviewStep
- Editable building names in multi-structure panel
- AI naming guidance for multi-document structures
- Duplicate AI loading indicator removed (kept inline only)
- Snow guard price lookup category fix (accessories not materials)
- Phase 3B-1: Building tabs UI + per-structure measurements display
- StructureTabs component created

## In Progress
- Phase 3B-2: Per-building material selection with tabs — ON HOLD pending redesign

## Next: Major Redesign — Roof System Architecture
Vision shift: instead of one long form, split into Setup + Build steps with roof system knowledge.

### New Step Flow
1. **Setup Step** (new)
   - Upload RoofScope PDFs
   - See structures detected, rename them
   - Assign a roof system to each structure (Brava, asphalt, metal, etc.)
2. **Build Estimate Step** (existing, cleaned up)
   - Tabs per building
   - Smart Selection uses building's assigned roof system
   - Each tab shows only relevant materials for that system
   - AI references roof system knowledge file for correct product selection

### Roof System Knowledge Files Needed
Each system gets its own reference file defining: required materials, underlayment specs, accessories, quantity calculation rules, common mistakes.

1. Brava composite tile
2. DaVinci composite tile
3. Asphalt shingle (Tamko)
4. Standing seam metal (Schafer)
5. Flat/low slope (TPO, modified bitumen)
6. Cedar shake
7. Cedar shingles

### Known Issues
- Grace Ice & Water High Temp still being selected for Brava — should be different underlayment. Roof system knowledge file will fix this.
- Tab bar position too high — should be above materials section, not above structure detection panel
- "Showing combined measurements for 4 structures" text doesn't update to 6 after second PDF (cosmetic)

## Blockers
- None currently

## Notes
- The estimator detection panel / AI summary should collapse or hide once you move to the Build step
- Smart Selection needs to reference per-system knowledge files
- Need to identify what underlayment Brava actually requires (Tim changed it from Grace Ice & Water)
