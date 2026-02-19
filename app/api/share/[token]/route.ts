import { NextRequest, NextResponse } from 'next/server';
import { resolveShareToken } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json(
        { error: 'Share token is required' },
        { status: 400 }
      );
    }

    const result = await resolveShareToken(token);

    if (result.kind === 'expired') {
      return NextResponse.json(
        { error: 'Share link has expired', code: 'expired' },
        { status: 410 }
      );
    }

    if (result.kind === 'not_found') {
      return NextResponse.json(
        { error: 'Share link not found or invalid', code: 'not_found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result.estimate);
  } catch (error) {
    console.error('Share API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
