/**
 * Server-side loader for roof system knowledge files.
 * Uses fs — only call from API routes, not client code.
 */

import fs from 'fs';
import path from 'path';

const ROOF_SYSTEM_TO_FILE: Record<string, string> = {
  'standing-seam-metal': 'standing-seam-metal.md',
  'brava-tile': 'brava-tile.md',
  'davinci-shake': 'davinci-shake.md',
  'asphalt-presidential': 'asphalt-shingle.md',
  'asphalt-standard': 'asphalt-shingle.md',
  'cedar': 'cedar.md',
  'flat-low-slope': 'flat-low-slope.md',
};

export function loadRoofSystemKnowledge(roofSystemId: string): {
  universalRules: string;
  systemRules: string;
  subType?: string;
} {
  const basePath = path.join(process.cwd(), 'data', 'knowledge');
  const universalRules = fs.readFileSync(
    path.join(basePath, 'universal-rules.md'),
    'utf-8'
  );
  const fileName = ROOF_SYSTEM_TO_FILE[roofSystemId];
  if (!fileName) {
    throw new Error(`Unknown roof system: ${roofSystemId}`);
  }
  const systemRules = fs.readFileSync(
    path.join(basePath, fileName),
    'utf-8'
  );
  const subType =
    roofSystemId === 'asphalt-presidential'
      ? 'Presidential'
      : roofSystemId === 'asphalt-standard'
        ? 'Standard'
        : undefined;
  return { universalRules, systemRules, subType };
}
