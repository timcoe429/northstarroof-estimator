import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { roofSystem } = await request.json();

    // Map roof system to file name
    const roofSystemFiles: Record<string, string> = {
      'brava': 'brava-tile.md',
      'davinci': 'davinci-shake.md',
      'metal': 'standing-seam-metal.md',
      'standing-seam': 'standing-seam-metal.md',
      'asphalt': 'asphalt-shingle.md',
      'shingle': 'asphalt-shingle.md',
      'cedar': 'cedar.md',
      'shake': 'cedar.md',
      'flat': 'flat-low-slope.md',
      'low-slope': 'flat-low-slope.md',
    };

    // Always load universal rules
    const universalPath = path.join(process.cwd(), 'data', 'knowledge', 'universal-rules.md');
    let knowledge = '';

    try {
      knowledge = fs.readFileSync(universalPath, 'utf-8');
      knowledge += '\n\n---\n\n';
    } catch (error) {
      console.warn('Failed to load universal-rules.md:', error);
    }

    // Load roof-specific file if available
    if (roofSystem && roofSystemFiles[roofSystem]) {
      const roofFilePath = path.join(process.cwd(), 'data', 'knowledge', roofSystemFiles[roofSystem]);
      try {
        const roofContent = fs.readFileSync(roofFilePath, 'utf-8');
        knowledge += roofContent;
      } catch (error) {
        console.warn(`Failed to load ${roofSystemFiles[roofSystem]}:`, error);
      }
    }

    return NextResponse.json({ knowledge });
  } catch (error) {
    console.error('Error in smart-selection API:', error);
    return NextResponse.json({ knowledge: '' }, { status: 500 });
  }
}
