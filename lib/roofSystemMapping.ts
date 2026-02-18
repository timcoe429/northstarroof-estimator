import type { RoofSystemType } from '@/types';

/**
 * Maps RoofSystemType (or empty string) to the simplified string format
 * expected by /api/smart-selection.
 */
export function mapRoofSystemToApiFormat(roofSystem: RoofSystemType | ''): string {
  const mapping: Record<string, string> = {
    'standing-seam-metal': 'metal',
    'brava-tile': 'brava',
    'davinci-shake': 'davinci',
    'asphalt-shingle': 'asphalt',
    'cedar-shake': 'cedar',
    'cedar-shingle': 'cedar',
    'flat-low-slope': 'flat',
  };
  return mapping[roofSystem] || 'asphalt';
}
