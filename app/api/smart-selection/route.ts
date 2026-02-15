import { NextRequest, NextResponse } from 'next/server';
import { loadRoofSystemKnowledge } from '@/lib/loadRoofSystemKnowledge';
import { roofSystemIdToDisplayName } from '@/lib/roofSystemConstants';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      roofSystem,
      jobDescription,
      measurements,
      selectionItems,
      vendorQuoteItems,
      itemQuantities,
    } = body;

    if (!roofSystem) {
      return NextResponse.json(
        { error: 'roofSystem is required' },
        { status: 400 }
      );
    }

    const jdContext = jobDescription?.trim()
      ? `JOB DESCRIPTION:\n${jobDescription}`
      : 'JOB DESCRIPTION:\nNo specific job description provided. Use roof system rules and measurements to select appropriate items.';

    const { universalRules, systemRules, subType } =
      loadRoofSystemKnowledge(roofSystem);
    const systemName = roofSystemIdToDisplayName(roofSystem);

    let subTypeBlock = '';
    if (subType) {
      subTypeBlock = `\nSUB-TYPE: ${subType}\n`;
    }

    const prompt = `You are a roofing estimator assistant for Northstar Roofing in Aspen, Colorado.

SELECTED ROOF SYSTEM: ${systemName}
${subTypeBlock}
UNIVERSAL RULES:
${universalRules}

ROOF SYSTEM RULES:
${systemRules}

${jdContext}

MEASUREMENTS:
${JSON.stringify(measurements || {}, null, 2)}

PRICE LIST (selectionItems):
${JSON.stringify(selectionItems || [], null, 2)}

VENDOR QUOTE ITEMS:
${JSON.stringify(vendorQuoteItems || [], null, 2)}

EXISTING ITEM QUANTITIES (if any):
${JSON.stringify(itemQuantities || {}, null, 2)}

EXPLICIT QUANTITIES:
If the job description specifies an exact quantity for an item, extract it in the "explicitQuantities" object.
- Look for patterns like "250 snowguards", "3 rolloffs", "2 dumpsters", "3 porto potties", "need 2 rolloffs"
- Only extract when a NUMBER is directly stated with an item name
- Use a partial item name as the key (e.g., "snowguard" for "Snowguard Install", "rolloff" or "dumpster" for "Rolloff", "porto" for "Porto Potty")
- Do NOT guess quantities - only extract when explicitly stated
- Handle synonyms: "dumpster" and "rolloff" refer to the same item, "porto" and "porto potty" refer to the same item
- Examples:
  * "Also give us 250 snowguards" → {"snowguard": 250}
  * "add 2 dumpsters" → {"rolloff": 2} or {"dumpster": 2}
  * "need 2 rolloffs" → {"rolloff": 2}
  * "3 porto potties" → {"porto": 3}
  * "add snowguards" → NO explicit quantity
  * "Brava tile" → NO explicit quantity

Return ONLY JSON:
{
  "selectedItemIds": ["id1", "id2", ...],
  "explicitQuantities": {
    "item_name_partial": quantity_number
  },
  "reasoning": "Brief explanation of why you selected these items",
  "warnings": ["Any concerns or things to double-check"]
}

If no explicit quantities are found, use an empty object: "explicitQuantities": {}
Only return the JSON, no other text.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Anthropic API error:', errorData);
      return NextResponse.json(
        { error: 'Failed to process smart selection with Anthropic API' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Smart selection API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
