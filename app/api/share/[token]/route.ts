import { NextRequest, NextResponse } from 'next/server';
import { getEstimateByShareToken } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    if (!token) {
      return NextResponse.json(
        { error: 'Share token is required' },
        { status: 400 }
      );
    }

    const estimate = await getEstimateByShareToken(token);

    if (!estimate) {
      return NextResponse.json(
        { error: 'Estimate not found or sharing is disabled' },
        { status: 404 }
      );
    }

    return NextResponse.json(estimate);
  } catch (error) {
    console.error('Share API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
