import { NextRequest, NextResponse } from 'next/server';
import { createShareableLink } from '@/lib/supabase';
import type { Estimate } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '');

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const estimate = body.estimate as Estimate | undefined;

    if (!estimate || !estimate.lineItems) {
      return NextResponse.json(
        { error: 'Invalid estimate payload' },
        { status: 400 }
      );
    }

    const { userId, companyId } = body;
    if (!userId || !companyId) {
      return NextResponse.json(
        { error: 'userId and companyId required' },
        { status: 400 }
      );
    }

    const result = await createShareableLink(estimate, userId, companyId, token);

    return NextResponse.json({
      shareUrl: result.shareUrl,
      expiresAt: result.expiresAt,
      estimateId: result.estimateId,
    });
  } catch (error) {
    console.error('Share API POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create share link' },
      { status: 500 }
    );
  }
}
