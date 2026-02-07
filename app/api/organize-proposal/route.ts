import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const { items, jobDescription, customerAddress } = await request.json();

    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Missing required field: items (array)' },
        { status: 400 }
      );
    }

    // Validate items have IDs
    if (!items.every(item => typeof item.id === 'number')) {
      return NextResponse.json(
        { error: 'All items must have numeric id field' },
        { status: 400 }
      );
    }

    // Read style guide
    const styleGuidePath = path.join(process.cwd(), 'data', 'proposal-style-guide.md');
    const styleGuide = fs.readFileSync(styleGuidePath, 'utf-8');

    // Build prompt for Claude with IDs
    const itemsList = items.map(item => {
      const lockedFlag = item.locked ? ' LOCKED' : '';
      return `${item.id}: ${item.name} ($${item.total.toFixed(2)}) [${item.category}]${lockedFlag}`;
    }).join('\n');

    const prompt = `Organize these roofing estimate items for a professional client proposal.

STYLE GUIDE:
${styleGuide}

RULES:
- Items marked LOCKED must stay standalone with their exact name
- Every item ID must appear in exactly one group
- Respond with ONLY valid JSON

${jobDescription ? `JOB DESCRIPTION: ${jobDescription}\n` : ''}${customerAddress ? `CUSTOMER ADDRESS: ${customerAddress}\n` : ''}
ITEMS:
${itemsList}

JSON FORMAT:
{"groups":[{"displayName":"Group Name","itemIds":[1,2,3]},{"displayName":"Standalone Item","itemIds":[4]}]}`;

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
        messages: [{
          role: 'user',
          content: prompt
        }]
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Anthropic API error:', errorData);
      // Fallback: return ungrouped items
      return NextResponse.json(getFallbackResponse(items));
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    
    // Try to parse JSON from response
    try {
      // Extract JSON from response (might have markdown code blocks)
      let jsonText = text.trim();
      if (jsonText.includes('```')) {
        const match = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match) {
          jsonText = match[1];
        }
      }
      
      const organized = JSON.parse(jsonText);
      
      // Validate structure
      if (!organized.groups || !Array.isArray(organized.groups)) {
        throw new Error('Invalid response structure: missing groups array');
      }

      // Validate each group has displayName and itemIds
      if (!organized.groups.every((g: any) => g.displayName && Array.isArray(g.itemIds))) {
        throw new Error('Invalid response structure: groups must have displayName and itemIds');
      }
      
      return NextResponse.json(organized);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('Response text:', text);
      // Fallback: return ungrouped items
      return NextResponse.json(getFallbackResponse(items));
    }
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      console.error('API request timed out after 15 seconds');
      // Fallback: return ungrouped items
      const { items } = await request.json().catch(() => ({ items: [] }));
      return NextResponse.json(getFallbackResponse(items || []));
    }
    
    console.error('API route error:', error);
    // Fallback: return ungrouped items
    try {
      const { items } = await request.json().catch(() => ({ items: [] }));
      return NextResponse.json(getFallbackResponse(items || []));
    } catch {
      return NextResponse.json(getFallbackResponse([]));
    }
  }
}

// Fallback: return each item as its own group
function getFallbackResponse(items: Array<{ id: number; name: string; category: string }>) {
  const groups = items.map(item => ({
    displayName: item.name,
    itemIds: [item.id],
  }));

  return { groups };
}
