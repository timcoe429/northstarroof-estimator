import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const { image, imageUrl, prompt, max_tokens = 4000 } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'Missing required field: prompt' },
        { status: 400 }
      );
    }

    // Build content array - include image if provided (image or imageUrl), otherwise text-only
    const content: any[] = [];
    let base64Data: string | undefined;
    let mediaType: string;

    if (imageUrl) {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        return NextResponse.json(
          { error: 'Failed to fetch image from URL' },
          { status: 400 }
        );
      }
      const arrayBuffer = await response.arrayBuffer();
      base64Data = Buffer.from(arrayBuffer).toString('base64');
      mediaType = response.headers.get('content-type') || 'application/pdf';
    } else if (image) {
      mediaType = image.includes('data:')
        ? image.split(';')[0].split(':')[1]
        : 'image/png';
      base64Data = image.includes(',') ? image.split(',')[1] : image;
    }

    if (base64Data) {
      const contentType = mediaType === 'application/pdf' ? 'document' : 'image';
      content.push({
        type: contentType,
        source: { type: 'base64', media_type: mediaType, data: base64Data },
      });
    }

    // Always add the text prompt
    content.push({
      type: 'text',
      text: prompt
    });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens,
        messages: [{
          role: 'user',
          content
        }]
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Anthropic API error:', errorData);
      return NextResponse.json(
        { error: 'Failed to process request with Anthropic API' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
