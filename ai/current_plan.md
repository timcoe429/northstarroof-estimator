# Current Plan

## Last Updated
February 16, 2026

## What's Complete
- Image extraction from RoofScope using Claude API
- Price sheet parsing from pasted images
- Multi-step estimate builder (upload → extracted → estimate)
- Financial controls (waste %, office %, margin %, sundries %)
- PDF proposal generation with custom templates and AI cover letter
- AI Proposal Organizer (proposalOrganizer.ts) — groups items into kits for client PDF
- Vendor quote parsing (Schafer, TRA, Rocky Mountain)
- Schafer quote items read-only (quote is source of truth)
- Saved quotes (save, load, delete) with backward compatibility
- Custom items creation
- Price list management
- Authentication with Supabase (company-based ownership)
- Share button with read-only public link
- Calculated accessories (heat tape, snow guards, skylights)
- Phase A: Roof system knowledge files in /data/knowledge/
- Phase A: /api/smart-selection route loading knowledge files

## What's In Progress
- Track 1 single-building bug fixes (underlayment rules, flashing defaults, optional items, kit grouping verification)

## What's Next (Priority Order)
1. Fix smart selection rules (underlayment, flashing, nails, optional items)
2. Verify AI kit grouping is active at this commit
3. Fix margin: equipment gets office overhead only, not profit margin
4. Track 2: Multi-building on feature branch (after Track 1 is solid)

## Reverted State
- Rolled back to commit 2be0a57 (pre-multi-building) on 2/16/2026
- Multi-building work preserved on branch: backup-multi-building-work
- All multi-building code will be re-implemented on feature branches with track isolation

## Known Issues at Current Commit
- Smart selection picks Sharkskin instead of SolarHide
- Smart selection picks copper flashing instead of standard aluminum
- Smart selection picks Grace Ice & Water as primary underlayment
- Snow Guard lookup broken (name mismatch — may be fixed by DB rename)
- Overnight Charge was in "schafer" category (fixed in DB to "equipment")
- Landfill Charge was $48 (fixed in DB to $750)
- Heat tape, snow guards, snow fence should be optional items (not in quote total)
- Brava Delivery getting markup applied (should be pass-through)

## Blockers
- None — stable baseline restored
