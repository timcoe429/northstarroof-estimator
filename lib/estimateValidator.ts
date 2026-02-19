import type { Estimate, LineItem } from '@/types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

const TOLERANCE = 0.01; // Allow small rounding differences

function approxEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOLERANCE;
}

/**
 * Validate an estimate: line totals, category sums, and basic sanity checks
 */
export function validateEstimate(estimate: Estimate): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const allItems: LineItem[] = [
    ...estimate.lineItems,
    ...(estimate.optionalItems || []),
  ];

  if (allItems.length === 0) {
    errors.push('No line items in estimate');
    return { isValid: false, errors, warnings };
  }

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    const expected = item.quantity * item.price;
    if (!approxEqual(item.total, expected)) {
      errors.push(
        `Line "${item.name}": total $${item.total.toFixed(2)} does not match quantity × price (${item.quantity} × $${item.price} = $${expected.toFixed(2)})`
      );
    }
    if (item.total < 0) {
      errors.push(`Line "${item.name}": negative total is not allowed`);
    }
  }

  const consumablesInMaterials = estimate.byCategory.materials.filter((i) => i.id === 'consumables');
  const computedTotals = {
    materials: estimate.byCategory.materials.reduce((s, i) => s + i.total, 0),
    consumables:
      (estimate.byCategory.consumables || []).reduce((s, i) => s + i.total, 0) +
      consumablesInMaterials.reduce((s, i) => s + i.total, 0),
    labor: estimate.byCategory.labor.reduce((s, i) => s + i.total, 0),
    equipment: estimate.byCategory.equipment.reduce((s, i) => s + i.total, 0),
    accessories: estimate.byCategory.accessories.reduce((s, i) => s + i.total, 0),
    schafer: (estimate.byCategory.schafer || []).reduce((s, i) => s + i.total, 0),
  };

  const categories: (keyof Estimate['totals'])[] = [
    'materials',
    'consumables',
    'labor',
    'equipment',
    'accessories',
    'schafer',
  ];

  for (const cat of categories) {
    const stored = estimate.totals[cat] ?? 0;
    const computed = computedTotals[cat] ?? 0;
    if (!approxEqual(stored, computed)) {
      errors.push(
        `Category "${cat}" total mismatch: stored $${stored.toFixed(2)} vs sum of items $${computed.toFixed(2)}`
      );
    }
  }

  const validCategories = ['materials', 'consumables', 'labor', 'equipment', 'accessories', 'schafer'];
  for (const item of allItems) {
    if (!validCategories.includes(item.category)) {
      errors.push(`Invalid category "${item.category}" for item "${item.name}"`);
    }
  }

  if (estimate.marginPercent < 25) {
    warnings.push(`Margin is low (${estimate.marginPercent}%). Consider increasing.`);
  }
  if (estimate.marginPercent > 60) {
    warnings.push(`Margin is high (${estimate.marginPercent}%). Verify this is intentional.`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
