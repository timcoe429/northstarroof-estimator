# Multi-Structure Rules - AI Domain Knowledge

This document contains structure detection rules, measurement organization, and analysis page matching for multi-building RoofScope projects. The AI uses these rules to interpret RoofScope data and validate multi-structure estimates.

---

## Structure Count Detection from RoofScope

- Look for keywords indicating multiple buildings:
  - "Auxiliary Building", "Structure 2", "Structure 3", "Building #"
  - "Garage", "Barn", "Outbuilding", "Guest House", "Workshop"
  - "Main House + ..." indicates additional structures
- Total SQ distribution patterns:
  - Single structure: Usually 20-60 SQ, measurements grouped together
  - Multiple structures: >60 SQ OR separate measurement groups
  - Example: "39.65 SQ + 20.77 SQ Auxiliary" = minimum 2 structures
- RoofScope typically labels:
  - Primary structure as "Main" or unlabeled
  - Additional structures as "Auxiliary" or numbered

---

## Structure Type Detection

How to identify roof type from RoofScope data:

### Metal Roof Indicators:

- Low pitch common (<3:12 or 4:12)
- Keywords: "standing seam", "metal panels", "steel roof"
- Larger individual roof planes
- Less complex geometry (fewer hips/valleys)

### Tile/Shingle Roof Indicators:

- Medium to steep pitch (4:12 to 12:12)
- Keywords: "Brava", "synthetic tile", "asphalt shingles", "composition"
- More complex geometry (multiple hips/valleys)
- Residential architecture patterns

### Flat Roof Indicators:

- Very low pitch (<2:12 or "flat")
- Keywords: "TPO", "EPDM", "modified bitumen", "membrane"
- Commercial building patterns
- Large unbroken planes

### Mixed Properties:

- Some properties have different roof types per building
- Example: Main house = tile, garage = metal
- AI must detect and track roof type per structure

---

## Measurement Completeness Validation

### REQUIRED Data for Accurate Estimate:

- Total squares (SQ)
- Predominant pitch
- Linear measurements:
  - Ridge length
  - Hip length
  - Valley length
  - Eave length
  - Rake length
- Penetrations count (vents, pipes, etc.)

### RoofScope Document Types:

1. **Summary Page**:
   - Gives project overview
   - May aggregate measurements from all structures
   - Shows total SQ but may not break down by building
   - Sufficient for ballpark estimates only

2. **Analysis Pages**:
   - Individual detailed page per structure
   - Shows measurements for specific building
   - Includes pitch, slopes, linear measurements
   - BEST for accurate multi-structure estimates

### Best Practice:

- 1 Analysis page per structure = accurate measurements
- Summary page only = acceptable but less accurate
- AI should request analysis pages if detecting multiple structures

---

## Matching Analysis Pages to Structures

When user uploads multiple images:

- Summary page typically uploaded first
- Analysis pages follow
- AI should identify which analysis page belongs to which structure by:
  - Structure labels in images ("Structure 1", "Auxiliary", etc.)
  - Square footage matching (39.65 SQ from summary matches analysis page showing 39.65 SQ)
  - Roof type consistency
  - Measurement patterns

---

## Default Assumptions (when data is limited)

### If only summary page provided:

- Use total SQ from summary
- Estimate accessories proportionally to SQ
- Flag estimate as "based on summary only - less accurate"
- Recommend getting analysis pages for final quote

### If pitch is missing:

- Assume standard 6:12 pitch for calculations
- Flag assumption in warnings
- Note that actual pitch affects labor and safety requirements

### If linear measurements missing:

- Flag as incomplete
- Warn user that accessories (ridge, valley, heat tape) cannot be calculated accurately
- May need to make conservative estimates
