# Proposal Style Guide

This guide helps the AI understand how Northstar Roofing prefers proposals to be organized. These are preferences and examples, not rigid rules — use judgment based on the specific project.

## General Principle

The client should see what they're getting for the big stuff. They don't need to see every screw and rivet. Group small commodity items into logical kits. Keep significant items visible on their own.

## Materials

### Keep as standalone items (roughly $1,500+ or significant products):
- Metal roofing panels (show the actual product: "26ga Standing Seam Metal Panels" not just "Metal Panels")
- Underlayment products (show the product name: "Grace Ice & Water High Temp" or "GAF VersaShield")
- Snow fence / snow retention systems
- Heat tape
- Tile or shingle products (Brava, DaVinci, etc.)
- Any single item over ~$1,500

### Group into kits (small items, commodity items):
- **"Custom Fabricated Metal Flashing"** — groups items containing these keywords: eave, rake, ridge, valley, w valley, sidewall, headwall, starter, drip edge, flashing, fab valley, fab ridge, fab eave, fab rake, fab sidewall, fab headwall, fab starter, fab drip edge. Any Schafer item with these keywords that's under $1,500 should be grouped into the Flashing Kit — not left standalone. These are the custom bent pieces Schafer fabricates.
- **"Panel Clips, Fasteners & Hardware"** — groups: panel clips, woodgrip fasteners, lap tek fasteners, pop rivets, stitch screws. All the small metal hardware that holds things together.
- **"Sealants, Tapes & Closures"** — groups: butyl tape, foam closures (inside and outside), caulk/sealant tubes, Nova Seal. Small sealing and finishing materials.

### Kit naming:
- Use clean, professional names a homeowner understands
- Avoid vendor codes and part numbers in kit names
- The kit name should give a sense of what's included
- When grouping items into a kit, append a summary of the component types after a dash or in parentheses
- Example: "Custom Fabricated Metal Flashing — Eave, Rake, Ridge, Valley & Headwall pieces"
- This helps clients understand what's included in grouped items
- Component lists should be concise (3-6 types max, use "&" for the last item)

## Critical Rule: Never Rename Items

- **NEVER rename or "clean up" user-entered item names**
- Items should always appear exactly as the user typed them
- The AI only controls grouping and kit names — not individual item names
- If an item name is "Schafer AG Panel 26ga SMP STANDARD COLOR TBD", it must stay exactly that way
- Only the kit/group displayName can be created by AI — source item names are immutable

## Labor

Keep each labor item as its own line. Do NOT group labor items together.
- "Complete Roof Installation" or "Roofing Installation"
- "Heat Tape Installation"
- "Snow Fence Installation"
- Each type of work stays separate

## Equipment & Fees

Keep each equipment item as its own line. Do NOT group equipment.
- "Debris Haulaway & Landfill" (trailer haulaway, not rolloff)
- "Porto Potty"
- "Crane Rental" if applicable
- Each stays separate

## Optional Items

Keep each optional item as its own line. Do NOT group.
- "Skylight" with quantity
- Whatever else is optional stays individual

## Sorting

Within each category, sort by price highest first. The client sees the big items at the top.

## Examples

### Good proposal (metal roof with Schafer quote):
| Item | Price |
|------|-------|
| **MATERIALS** | |
| 26ga Kynar Standing Seam Metal Panels | $9,200 |
| Snow Fence (ColorGard) | $3,384 |
| Grace Ice & Water High Temp | $2,512 |
| Heat Tape | $1,751 |
| Custom Fabricated Metal Flashing — Eave, Rake, Ridge, Valley & Headwall pieces | $1,450 |
| Panel Clips, Fasteners & Hardware | $820 |
| Sealants, Tapes & Closures | $490 |
| GAF VersaShield | $120 |
| **LABOR** | |
| Complete Roof Installation | $33,389 |
| Heat Tape Installation | $2,627 |
| Snow Fence Installation | $1,410 |
| **EQUIPMENT & FEES** | |
| Debris Haulaway & Landfill | $750 |
| Porto Potty | $600 |

### Bad proposal (too lumped):
| Item | Price |
|------|-------|
| Metal Roofing Panels | $9,200 |
| Roofing Materials | $8,527 |
| Site Equipment | $1,030 |

(Client can't tell what they're getting for $8,527)

### Bad proposal (too granular):
| Item | Price |
|------|-------|
| Schafer AG Panel 26ga SMP STANDARD COLOR TBD | $4,920 |
| Fastener 1-1/2" Woodgrip Classic Bronze | $480 |
| Foam Closure Pro Panel Inside 36" | $120 |
| Foam Closure Pro Panel Outside 36" | $120 |
| SealantTape 3/8" Butyl 1/16" ROLL GT104 | $265 |
| Fastener Lap Tek #14 x 7/8" Classic Bronze | $150 |
| ... 12 more tiny items ... |

(Client drowning in vendor part numbers they don't understand)
