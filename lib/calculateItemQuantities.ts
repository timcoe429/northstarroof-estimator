import type { Measurements, PriceItem } from '@/types';
import { UNIT_TYPES } from '@/lib/constants';

/**
 * Infer a linear measurement from the item name and roof measurements.
 * Used when coverageUnit is 'lf' or when we need to pick the right
 * linear dimension for a name-based heuristic.
 */
function inferLinearMeasurement(name: string, m: Measurements): number {
  if (name.includes('starter')) return (m.eave_length || 0) + (m.rake_length || 0);
  if (name.includes('valley')) return m.valley_length || 0;
  if (name.includes('eave') || name.includes('drip')) return m.eave_length || 0;
  if (name.includes('rake')) return m.rake_length || 0;
  if (name.includes('ridge') || name.includes('h&r')) return (m.ridge_length || 0) + (m.hip_length || 0);
  if (name.includes('hip')) return m.hip_length || 0;
  // Fallback: eave length for generic linear items
  return m.eave_length || 0;
}

/**
 * Calculate quantities for all price items based on measurements.
 * Pure function — used by Smart Selection and estimate calculation.
 *
 * Priority:
 *  1. If item has coverage AND coverageUnit → divide relevant measurement by coverage.
 *  2. If item has coverage but NO coverageUnit → infer coverageUnit from item.unit
 *     (bundle/roll → 'sq', lf → 'lf').
 *  3. Special-case name matches (OSB, starter, delivery, labor).
 *  4. UNIT_TYPES fallback (area / linear / count / flat).
 *     For units that needsCoverage (bundle, roll) but have NO coverage value,
 *     qty stays 0 — we cannot guess a quantity without coverage data.
 */
export function calculateItemQuantitiesFromMeasurements(
  m: Measurements,
  priceItems: PriceItem[],
  isTearOff: boolean
): Record<string, number> {
  const quantities: Record<string, number> = {};

  priceItems.forEach((item) => {
    const name = item.name.toLowerCase();
    let qty = 0;
    let calcPath = ''; // diagnostic label

    const coverage = item.coverage
      ? typeof item.coverage === 'string'
        ? parseFloat(item.coverage)
        : item.coverage
      : null;
    let coverageUnit = item.coverageUnit ? item.coverageUnit.toLowerCase() : null;

    // ── Path 1: coverage + coverageUnit both present ────────────────────
    // If coverage exists but coverageUnit is missing, try to infer it.
    if (coverage && coverage > 0 && !coverageUnit) {
      const unitType = UNIT_TYPES.find((u) => u.value === item.unit);
      if (unitType?.calcType === 'area') {
        coverageUnit = 'sq'; // bundle / roll that covers area → default to squares
      } else if (unitType?.calcType === 'linear' || item.unit === 'lf') {
        coverageUnit = 'lf';
      }
      if (coverageUnit) {
        calcPath = `inferred coverageUnit="${coverageUnit}" from unit="${item.unit}"`;
      }
    }

    if (coverage && coverage > 0 && coverageUnit) {
      if (coverageUnit === 'lf') {
        const linearMeasurement = inferLinearMeasurement(name, m);
        qty = Math.ceil(linearMeasurement / coverage);
        calcPath = calcPath || `coverage lf: ${linearMeasurement} / ${coverage}`;
      } else if (coverageUnit === 'sqft') {
        qty = Math.ceil((m.total_squares * 100) / coverage);
        calcPath = calcPath || `coverage sqft: ${m.total_squares * 100} / ${coverage}`;
      } else if (coverageUnit === 'sq') {
        qty = Math.ceil(m.total_squares / coverage);
        calcPath = calcPath || `coverage sq: ${m.total_squares} / ${coverage}`;
      }
    }
    // ── Path 2: special-case name matches (no coverage needed) ──────────
    else if (item.unit === 'each' && !coverage) {
      const isFlatFeeItem =
        name.includes('delivery') ||
        name.includes('fuel') ||
        name.includes('porto') ||
        name.includes('rolloff') ||
        name.includes('reprographic');
      qty = isFlatFeeItem ? 1 : 0;
      calcPath = `each: flat-fee=${isFlatFeeItem}`;
    } else if (name.includes('osb') || name.includes('oriented strand')) {
      qty = m.total_squares * 3;
      calcPath = 'osb: squares * 3';
    } else if (name.includes('starter')) {
      qty = (m.eave_length || 0) + (m.rake_length || 0);
      calcPath = `starter fallback: eave(${m.eave_length}) + rake(${m.rake_length})`;
    } else if (
      name.includes('delivery') ||
      name.includes('fuel') ||
      name.includes('porto') ||
      name.includes('rolloff') ||
      item.unit === 'flat'
    ) {
      if (name.includes('rolloff') && isTearOff) {
        qty = Math.ceil((m.total_squares || 0) / 15);
        calcPath = 'rolloff tearoff';
      } else {
        qty = 1;
        calcPath = 'flat/delivery: 1';
      }
    } else if (item.category === 'labor' && item.unit !== 'each') {
      qty = m.total_squares || 0;
      calcPath = 'labor: total_squares';
    }
    // ── Path 3: UNIT_TYPES fallback ─────────────────────────────────────
    else {
      const unitType = UNIT_TYPES.find((u) => u.value === item.unit);
      if (!unitType) {
        quantities[item.id] = 0;
        console.log(
          `[calcQty] "${item.name}" — NO unitType for unit="${item.unit}", qty=0`
        );
        return;
      }

      // For units that need coverage (bundle, roll) but have none → qty = 0.
      // We can't guess a meaningful quantity without knowing how much one unit covers.
      if ((unitType as Record<string, unknown>).needsCoverage && !coverage) {
        qty = 0;
        calcPath = `needsCoverage but no coverage → 0 (unit=${item.unit})`;
      } else if (unitType.calcType === 'area') {
        qty = item.unit === 'sf' ? (m.total_squares || 0) * 100 : m.total_squares || 0;
        calcPath = `area fallback: ${qty} (unit=${item.unit})`;
      } else if (unitType.calcType === 'linear') {
        if (name.includes('valley')) qty = m.valley_length || 0;
        else if (name.includes('eave') || name.includes('drip')) qty = m.eave_length || 0;
        else if (name.includes('rake')) qty = m.rake_length || 0;
        else if (name.includes('ridge')) qty = m.ridge_length || 0;
        else if (name.includes('hip')) qty = m.hip_length || 0;
        else if (name.includes('h&r'))
          qty = (m.ridge_length || 0) + (m.hip_length || 0);
        else qty = 0;
        calcPath = `linear fallback: ${qty}`;
      } else if (unitType.calcType === 'count') {
        if (
          name.includes('boot') ||
          name.includes('pipe') ||
          name.includes('jack') ||
          name.includes('flash') ||
          name.includes('vent')
        )
          qty = m.penetrations || 0;
        else if (name.includes('skylight') || name.includes('velux'))
          qty = m.skylights || 0;
        else if (name.includes('chimney')) qty = m.chimneys || 0;
        else qty = 0;
        calcPath = `count fallback: ${qty}`;
      } else if (unitType.calcType === 'flat') {
        qty = 1;
        calcPath = 'flat fallback: 1';
      }
    }

    // ── Diagnostic log ──────────────────────────────────────────────────
    console.log(
      `[calcQty] "${item.name}" | unit=${item.unit} | coverage=${coverage} coverageUnit=${coverageUnit} | qty=${qty} | path: ${calcPath}`
    );

    quantities[item.id] = qty;
  });

  return quantities;
}
