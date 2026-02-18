import type { PriceItem, Measurements } from '.';

export type RoofSystemType =
  | 'standing-seam-metal'
  | 'brava-tile'
  | 'davinci-shake'
  | 'asphalt-shingle'
  | 'cedar-shake'
  | 'cedar-shingle'
  | 'flat-low-slope';

export interface BuildingQuickOptions {
  tearOff: boolean;
  replaceOSB: boolean;
  steepPitch: boolean;
  overnightRequired: boolean;
  complexAccess: boolean;
}

export interface BuildingEstimate {
  id: string;
  name: string;
  roofSystem: RoofSystemType;
  quickOptions: BuildingQuickOptions;
  measurements: Measurements;
  selectedItems: PriceItem[];
  aiReasoning?: string;
  smartSelectionComplete: boolean;
  isCollapsed: boolean;
}

export const ROOF_SYSTEM_LABELS: Record<RoofSystemType, string> = {
  'standing-seam-metal': 'Standing Seam Metal',
  'brava-tile': 'Brava Tile',
  'davinci-shake': 'DaVinci Shake',
  'asphalt-shingle': 'Asphalt Shingle',
  'cedar-shake': 'Cedar Shake',
  'cedar-shingle': 'Cedar Shingle',
  'flat-low-slope': 'Flat / Low Slope',
};

export const ROOF_SYSTEM_KNOWLEDGE: Record<RoofSystemType, string> = {
  'standing-seam-metal': 'standing-seam-metal.md',
  'brava-tile': 'brava-tile.md',
  'davinci-shake': 'davinci-shake.md',
  'asphalt-shingle': 'asphalt-shingle.md',
  'cedar-shake': 'cedar.md',
  'cedar-shingle': 'cedar.md',
  'flat-low-slope': 'flat-low-slope.md',
};
