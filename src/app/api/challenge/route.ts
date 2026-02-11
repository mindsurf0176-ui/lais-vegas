// ========================================
// AI Casino - Challenge API
// ========================================

import { NextRequest, NextResponse } from 'next/server';
import { createChallenge, verifyChallenge } from '@/lib/auth/challenge';

// POST /api/challenge - Get a new challenge
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const type = body.type === 'puzzle' ? 'puzzle' : 'pow';
    
    const { challenge, token } = createChallenge(type);
    
    // Don't expose answer hash for puzzles
    const publicChallenge = {
      challenge_id: challenge.challenge_id,
      type: challenge.type,
      expires_at: challenge.expires_at,
      ...(challenge.type === 'pow' 
        ? { seed: challenge.seed, target_prefix: challenge.target_prefix }
        : { puzzle: challenge.puzzle }
      )
    };
    
    return NextResponse.json({
      challenge: publicChallenge,
      token
    });
  } catch (error) {
    console.error('Challenge creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create challenge' },
      { status: 500 }
    );
  }
}
