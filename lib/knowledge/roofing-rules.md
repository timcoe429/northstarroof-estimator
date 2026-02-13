# Roofing Rules - AI Domain Knowledge

This document contains material compatibility rules, regional requirements, and validation rules for roofing estimates. **Actual products and prices are stored in the price_items database table.** The AI uses these rules to determine WHAT items are needed; the app looks up pricing from the database.

---

## Material Compatibility

- **Metal roofs**: Compatible with standing seam panels, metal roofing systems
- **Tile/Shingle roofs**: Compatible with Brava synthetic tile, asphalt shingles (Presidential, basic)
- **INCOMPATIBLE**: Brava synthetic tile cannot be installed on metal roof structures
- **Mixed structures**: Some properties may have different roof types per building (e.g., main house = tile, garage = metal)

---

## Required Underlayment by Roof Type

- **Metal roofs**: ALWAYS require high-temp underlayment (GAF Versa Shield or equivalent)
- **Synthetic/asphalt roofs**: ALWAYS require radiant barrier underlayment (SolarHide or equivalent)
- **All roofs**: Ice & water shield required in valleys
- **Standard underlayment coverage**: Typically 2 squares per roll (verify in price list)

---

## Snow Retention Requirements (Colorado/Aspen Climate)

- **Metal roofs**: ALWAYS require snow fence system (NOT snow guards)
  - Example product: ColorGard snow fence
  - Installation: Linear feet along eaves based on pitch
- **Synthetic/asphalt roofs**: ALWAYS require snow guards (NOT snow fence)
  - Example product: RMSG Yeti Snowguard
  - Installation: Eave length × number of rows (pitch-dependent)
- **Steep pitch (>8:12)**: May require additional rows or closer spacing
- This is a critical safety requirement - never skip on Colorado projects

---

## Heat Tape Requirements

- Recommended for all roofs in Colorado climate (ice dam prevention)
- Typical installation pattern:
  - Run full length of valleys
  - Triangle pattern on eaves: up 3', down 3' = 6 LF per triangle point
  - Spacing between triangles: ~2.5-3' apart
  - Extends to exterior wall (overhang depth)
- Common calculation: (Eave length ÷ 3 × 6) + Valley length = total LF

---

## Nailing Specifications (for labor validation)

- **Synthetic shingle systems**: MUST use 1¾" ringshank nails
- **Presidential asphalt shingles**: MUST use 1¾" non-ringshank nails
- **Basic asphalt shingles**: MUST use 1½" non-ringshank nails
- Using wrong nail type is a code violation - AI should validate this

---

## Required Accessories by Roof Type

### All Roofs Require:

- Appropriate underlayment (see underlayment rules above)
- Flashings and trim
- Installation labor
- Removal/tearoff labor (if applicable)
- Waste calculation (typically 10% for materials)

### Metal Roofs Require:

- Snow fence (not guards)
- High-temp underlayment
- Heat tape (recommended)
- Metal-specific flashings

### Tile/Shingle Roofs Require:

- Snow guards (not fence)
- Radiant barrier underlayment
- Ridge cap material
- Proper nailing supplies

### Steep Pitch (>8:12) Additions:

- Additional safety equipment
- Increased labor time (complexity multiplier)
- May require specialized installation techniques

---

## Equipment & Overhead Items

- **Portapotty service**: Standard on multi-day jobs (~$600 total per job: delivery + pickup + monthly rental)
- **Landfill/dumpster**: Required for tearoff jobs, charged as line item
- **Overnight crew lodging**: ~$387 per night when needed (Sergio or Hugo)
- These are real costs that should appear in estimates

---

## Pricing Sanity Check Ranges (for AI validation only)

These ranges help AI flag unusual estimates - actual pricing comes from price_items table:

| Item | Typical Total Cost Range |
|------|--------------------------|
| Heat tape complete installation | $10-15/LF |
| Snow fence complete installation | $15-20/LF |
| Snow guard complete installation | $10-15/each |
| Metal roof complete system | $400-600/SQ |
| Tile roof complete system | $800-1200/SQ |
| Labor typically | 40-60% of materials cost |

If estimate falls outside these ranges, AI should flag for review (not error, just warning).
