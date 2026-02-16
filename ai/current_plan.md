# Current Plan — Updated 2/16/2026

## What's Complete (Track 1: Single-Building)
- ✅ PDF deterministic — no AI organizer, individual items, first click every time
- ✅ Smart selection loads knowledge files from data/knowledge/ via API route
- ✅ Knowledge files fixed: no copper default, no Sharkskin, SolarHide standard, Hugo default crew
- ✅ Split multiplier: equipment gets office overhead only, materials+labor get full markup
- ✅ Optional items (heat tape, snow guard, skylight, snow fence) in separate PDF section
- ✅ Deterministic kit grouping: aluminum flashing kit, fasteners kit with subtitles
- ✅ Equipment names fixed in DB: Landfill Charge ($750), Porto Potty ($600), Overnight Charge ($387), Snow Guard ($7)
- ✅ Overnight Charge flat fee detection fixed (was getting qty 0)
- ✅ Landfill Charge, Porto Potty, Fuel Charge always included
- ✅ Cover letter AI mentions specific roof system
- ✅ Track isolation architecture with guardrails in CLAUDE.md
- ✅ Backup branch preserved: backup-multi-building-work

## Known Issues (Minor — Not Blocking)
- Hip & Ridge metal trim not always auto-selected (add to knowledge file if needed)
- Brava Solids quantity may be high for some jobs (29 bundles on 31 sq roof)
- Nails still being selected despite "no accessories" rule (currently grouped into kit, acceptable)
- Overnight Charge auto-add for Hugo/Sergio depends on AI following prompt (works most of the time)
- Decimal places on PDF prices (e.g., $23,496.89 instead of $23,497)
- Kit grouping doesn't include Schafer vendor kits yet (needed for metal roof jobs)

## STABLE FALLBACK POINT
Current commit on main is 95% working for single-building estimates. 
If anything breaks, revert to THIS commit before proceeding.
Tag this deployment in Vercel as stable.

## What's Next
1. Multi-building (Track 2) — feature branch only, additive code, does not touch Track 1
2. Schafer vendor kit grouping for metal roof PDFs
3. Share button functionality
4. Decimal cleanup on PDF prices
5. Deterministic post-processor for smart selection (guarantee overnight, landfill, etc.)
