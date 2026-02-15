import type { Measurements, PriceItem } from '@/types';
import { UNIT_TYPES } from '@/lib/constants';

/**
 * Calculate quantities for all price items based on measurements.
 * Pure function — used by Smart Selection and estimate calculation.
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

    const coverage = item.coverage
      ? typeof item.coverage === 'string'
        ? parseFloat(item.coverage)
        : item.coverage
      : null;
    const coverageUnit = item.coverageUnit ? item.coverageUnit.toLowerCase() : null;

    if (coverage && coverageUnit) {
      if (coverageUnit === 'lf') {
        if (name.includes('starter')) {
          qty = Math.ceil(((m.eave_length || 0) + (m.rake_length || 0)) / coverage);
        } else if (name.includes('valley')) {
          qty = Math.ceil((m.valley_length || 0) / coverage);
        } else if (name.includes('eave') || name.includes('drip')) {
          qty = Math.ceil((m.eave_length || 0) / coverage);
        } else if (name.includes('rake')) {
          qty = Math.ceil((m.rake_length || 0) / coverage);
        } else if (name.includes('ridge') || name.includes('h&r')) {
          qty = Math.ceil(((m.ridge_length || 0) + (m.hip_length || 0)) / coverage);
        } else if (name.includes('hip')) {
          qty = Math.ceil((m.hip_length || 0) / coverage);
        } else {
          qty = Math.ceil((m.eave_length || 0) / coverage);
        }
      } else if (coverageUnit === 'sqft') {
        qty = Math.ceil((m.total_squares * 100) / coverage);
      } else if (coverageUnit === 'sq') {
        qty = Math.ceil(m.total_squares / coverage);
      }
    } else if (item.unit === 'each' && !coverage) {
      const isFlatFeeItem =
        name.includes('delivery') ||
        name.includes('fuel') ||
        name.includes('porto') ||
        name.includes('rolloff') ||
        name.includes('reprographic');
      qty = isFlatFeeItem ? 1 : 0;
    } else if (name.includes('osb') || name.includes('oriented strand')) {
      qty = m.total_squares * 3;
    } else if (name.includes('starter')) {
      qty = (m.eave_length || 0) + (m.rake_length || 0);
    } else if (
      name.includes('delivery') ||
      name.includes('fuel') ||
      name.includes('porto') ||
      name.includes('rolloff') ||
      item.unit === 'flat'
    ) {
      if (name.includes('rolloff') && isTearOff) {
        qty = Math.ceil((m.total_squares || 0) / 15);
      } else {
        qty = 1;
      }
    } else if (item.category === 'labor' && item.unit !== 'each') {
      qty = m.total_squares || 0;
    } else {
      const unitType = UNIT_TYPES.find((u) => u.value === item.unit);
      if (!unitType) {
        quantities[item.id] = 0;
        return;
      }

      if (unitType.calcType === 'area') {
        qty = item.unit === 'sf' ? (m.total_squares || 0) * 100 : m.total_squares || 0;
      } else if (unitType.calcType === 'linear') {
        if (name.includes('valley')) qty = m.valley_length || 0;
        else if (name.includes('eave') || name.includes('drip')) qty = m.eave_length || 0;
        else if (name.includes('rake')) qty = m.rake_length || 0;
        else if (name.includes('ridge')) qty = m.ridge_length || 0;
        else if (name.includes('hip')) qty = m.hip_length || 0;
        else if (name.includes('h&r'))
          qty = (m.ridge_length || 0) + (m.hip_length || 0);
        else qty = 0;
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
      } else if (unitType.calcType === 'flat') {
        qty = 1;
      }
    }

    quantities[item.id] = qty;
  });

  return quantities;
}
