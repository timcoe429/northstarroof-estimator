/**
 * Roof system identifiers and display names for the estimator
 */

export const ROOF_SYSTEM_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Select roof system...' },
  { value: 'standing-seam-metal', label: 'Standing Seam Metal' },
  { value: 'brava-tile', label: 'Brava Composite Tile' },
  { value: 'davinci-shake', label: 'DaVinci Synthetic Shake' },
  { value: 'asphalt-presidential', label: 'Asphalt Shingle — Presidential' },
  { value: 'asphalt-standard', label: 'Asphalt Shingle — Standard' },
  { value: 'cedar', label: 'Cedar Shake / Shingles' },
  { value: 'flat-low-slope', label: 'Flat / Low Slope' },
];

export function roofSystemIdToDisplayName(id: string): string {
  if (!id) return 'Select roof system...';
  const opt = ROOF_SYSTEM_OPTIONS.find(o => o.value === id);
  return opt?.label ?? id;
}
