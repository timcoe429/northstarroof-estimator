# Validation Rules - AI Domain Knowledge

This document contains completeness checks, required items, and pre-flight validation rules for roofing estimates. Use these rules before PDF generation to ensure estimates meet quality standards.

---

## Required Items Checklist

### Every Estimate Must Include:

- [ ] Primary roofing material (panels for metal, shingles/tile for others)
- [ ] Appropriate underlayment for roof type (see roofing-rules.md)
- [ ] Installation labor
- [ ] Removal/tearoff labor (if applicable - confirm with customer)
- [ ] Waste allowance (typically 10% on materials)

### Metal Roof Specific Requirements:

- [ ] Snow fence system (REQUIRED in Colorado, not optional)
- [ ] High-temp underlayment (GAF Versa Shield or equivalent)
- [ ] Flashings and metal trim
- [ ] Heat tape (RECOMMENDED for eaves/valleys, flag if missing)
- [ ] Standing seam panels or metal roofing material

### Tile/Shingle Roof Specific Requirements:

- [ ] Snow guards (REQUIRED in Colorado, not optional)
- [ ] Radiant barrier underlayment (SolarHide or equivalent)
- [ ] Ridge cap material
- [ ] Proper nailing supplies (validate type matches shingle type)
- [ ] Ice & water shield for valleys

### Steep Pitch (>8:12) Additional Requirements:

- [ ] Additional safety equipment line item
- [ ] Labor should reflect increased difficulty (time/complexity multiplier)
- [ ] May need specialized installation techniques
- [ ] Confirm crew comfort level with steep work

### Multi-Day Job Requirements:

- [ ] Portapotty service (if multi-day job)
- [ ] Overnight lodging (if crew staying on-site)
- [ ] Consider daily setup/cleanup time in labor

---

## Multi-Structure Validation Rules

### Per-Structure Validation:

- Each structure should have its own measurements captured
- Each structure's roof type should be identified
- Required items should be present for each roof type
- If measurements are aggregated (summary only), flag this

### Labor Allocation for Multiple Buildings:

- Labor should account for:
  - Travel time between structures on property
  - Multiple setup/cleanup cycles
  - Potential crew splitting
- Multi-structure jobs typically have 10-20% labor premium vs single structure

### Material Allocation:

- Materials should be allocated per structure OR
- Clearly marked as combined (if similar roof types)
- Each structure's accessories calculated separately (snow retention, heat tape based on that building's measurements)

---

## Vendor Quote Integration Validation

### When Schafer Quote is Uploaded:

- Quote contains exact materials and quantities for metal roof projects
- Selected items in estimate should match quote line items
- Quantities from quote take precedence over calculated quantities
- Quote pricing is exact - no waste factor added (Schafer already accounts for this)

### Validation Checks:

- [ ] If metal roof detected AND Schafer quote uploaded: Do selected items match quote?
- [ ] Are quote quantities within ~10% of RoofScope measurements? (flag if major discrepancy)
- [ ] Are there quote items not selected in estimate? (possible missing items)
- [ ] Are there selected items not in quote? (possible added scope or error)

### Vendor Quote Priority:

- Schafer quote items are READ-ONLY (can deselect but can't edit quantity/price)
- Quote represents exact job scope from vendor
- If discrepancy exists, flag for user review - don't auto-correct

---

## Pricing Sanity Checks

### Labor vs Materials Ratio:

- Typical range: Labor = 40-60% of materials cost
- Below 30%: Flag as "labor seems low - verify scope"
- Above 80%: Flag as "labor seems high - verify complexity"

### Total $/SQ Validation:

- Metal roof: Should fall in $400-600/SQ range typically
- Tile roof: Should fall in $800-1200/SQ range typically
- Significantly outside range: Flag for review (not error - may be legitimate)

### Multi-Structure Total Check:

- Total should feel proportional to combined square footage
- If 4 structures totaling 80 SQ = $120K, that's $1500/SQ (HIGH - flag it)
- Unusually high/low totals should trigger "please review pricing" warning

### Line Item Reasonableness:

- Individual line items should make sense
- Heat tape: 500 LF on a 30 SQ roof? (Flag - that's excessive)
- Snow guards: 5 units on 60 LF of eave? (Flag - typically need more)

---

## Completeness Scoring

### Calculate completeness percentage (0-100%):

| Criteria | Points |
|----------|--------|
| Has measurements | +20% |
| Has primary roofing material | +20% |
| Has required underlayment | +15% |
| Has required snow retention | +15% |
| Has labor items | +15% |
| Has tearoff (if needed) | +10% |
| No validation errors | +5% |

### Completeness Thresholds:

- **100%**: Perfect - ready to generate PDF
- **80-99%**: Minor items missing - can proceed with warning
- **60-79%**: Significant gaps - recommend addressing before PDF
- **<60%**: Incomplete - should not generate PDF

---

## Pre-Flight Checklist (before PDF generation)

This is the FINAL validation before creating customer-facing proposal.

### Measurements & Scope:

- [ ] All structures have measurements (or clearly flagged as estimated)
- [ ] Roof types identified for all structures
- [ ] RoofScope data appears complete and reasonable

### Required Items Present:

- [ ] Primary roofing material selected
- [ ] Correct underlayment type for roof type(s)
- [ ] Snow retention system appropriate to roof type (fence vs guards)
- [ ] Labor items included
- [ ] Tearoff included if applicable

### Vendor Quotes Reconciled:

- [ ] If Schafer quote uploaded: Items match and are included
- [ ] If TRA/Rocky Mountain quotes: Items accounted for
- [ ] No orphaned quote items (uploaded but not in estimate)

### Calculations Validated:

- [ ] Quantities seem reasonable for measurements
- [ ] Pricing passes sanity checks (not flagged as unusually high/low)
- [ ] Labor/materials ratio is within normal range
- [ ] Totals are calculated correctly

### Customer-Facing Content:

- [ ] Intro letter mentions correct number of structures
- [ ] Intro letter mentions correct roof types
- [ ] Intro letter accurately describes scope
- [ ] All structures from RoofScope are accounted for in proposal
- [ ] Customer info is complete (name, address)

### Final Go/No-Go Decision:

- **READY**: All checks pass or only minor warnings → Generate PDF
- **WARNINGS**: Some concerns but can proceed → Show warnings, allow override
- **BLOCKED**: Critical errors (missing required items, no measurements) → Cannot generate PDF until fixed

---

## Warning vs Error Guidelines

### ERRORS (block PDF generation):

- No measurements at all
- No roofing material selected
- No labor included
- Metal roof without snow retention
- Tile/shingle roof without snow retention
- Wrong underlayment type for roof type
- Multi-structure job but only 1 structure accounted for

### WARNINGS (show but allow override):

- Heat tape not included (recommended but not required)
- Pricing outside typical ranges
- Vendor quote items not all selected
- Completeness <80%
- Labor ratio unusual
- Estimated measurements (no analysis pages)

### INFO (just display, no blocking):

- Completeness score
- Pricing breakdown
- Vendor quote summary
- Number of structures detected
