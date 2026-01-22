// Unit types for calculations
export const UNIT_TYPES = [
  { value: 'sq', label: 'per square', calcType: 'area' },
  { value: 'sf', label: 'per sq ft', calcType: 'area' },
  { value: 'bundle', label: 'per bundle', calcType: 'area', needsCoverage: true },
  { value: 'roll', label: 'per roll', calcType: 'area', needsCoverage: true },
  { value: 'lf', label: 'per linear ft', calcType: 'linear' },
  { value: 'each', label: 'each', calcType: 'count' },
  { value: 'pail', label: 'per pail', calcType: 'count' },
  { value: 'box', label: 'per box', calcType: 'count' },
  { value: 'tube', label: 'per tube', calcType: 'count' },
  { value: 'sheet', label: 'per sheet', calcType: 'count' },
  { value: 'flat', label: 'flat fee', calcType: 'flat' },
];

// What measurements each calc type uses
export const CALC_MAPPINGS = {
  area: ['total_squares'],
  linear: ['ridge_length', 'hip_length', 'valley_length', 'eave_length', 'rake_length'],
  count: ['penetrations', 'skylights', 'chimneys'],
  flat: [],
};
