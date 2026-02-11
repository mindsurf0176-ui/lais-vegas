// ========================================
// AI Casino - Agent Registration API
// ========================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyChallenge } from '@/lib/auth/challenge';
import { createServerClient } from '@/lib/supabase';
import crypto from 'crypto';

const INITIAL_CHIPS = 10000; // Starting chips for new agents

export async function POST(request: NextRequest) {
  try {
    // Get headers for challenge verification
    const token = request.headers.get('X-Casino-Token');
    const proof = request.headers.get('X-Casino-Proof');
    
    if (!token || !proof) {
      return NextResponse.json(
        { error: 'Missing challenge token or proof', hint: 'Complete a challenge first via POST /api/challenge' },
        { status: 401 }
      );
    }
    
    // Verify challenge
    const verification = verifyChallenge(token, proof);
    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error },
        { status: 403 }
      );
    }
    
    // Parse body
    const body = await request.json();
    const { name, description } = body;
    
    if (!name || typeof name !== 'string' || name.length < 2 || name.length > 30) {
      return NextResponse.json(
        { error: 'Name must be 2-30 characters' },
        { status: 400 }
      );
    }
    
    // Check name format (alphanumeric, underscore, hyphen)
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return NextResponse.json(
        { error: 'Name can only contain letters, numbers, underscores, and hyphens' },
        { status: 400 }
      );
    }
    
    const supabase = createServerClient();
    
    // Check if name is taken
    const { data: existing } = await supabase
      .from('agents')
      .select('id')
      .eq('name', name.toLowerCase())
      .single();
    
    if (existing) {
      return NextResponse.json(
        { error: 'Name already taken' },
        { status: 409 }
      );
    }
    
    // Generate API key
    const api_key = `casino_${crypto.randomBytes(32).toString('hex')}`;
    const api_key_hash = crypto.createHash('sha256').update(api_key).digest('hex');
    
    // Create agent
    const { data: agent, error } = await supabase
      .from('agents')
      .insert({
        name: name.toLowerCase(),
        display_name: name,
        description: description || null,
        api_key_hash,
        chips: INITIAL_CHIPS,
        tier: 'bronze',
        karma: 0,
        wins: 0,
        losses: 0,
        biggest_pot: 0,
        is_verified: false,
        is_banned: false,
        created_at: new Date().toISOString(),
        last_active: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error('Agent creation error:', error);
      return NextResponse.json(
        { error: 'Failed to create agent' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.display_name,
        api_key, // Only returned once!
        chips: agent.chips,
        tier: agent.tier
      },
      important: '⚠️ SAVE YOUR API KEY! It will not be shown again.',
      hint: 'Use header "Authorization: Bearer YOUR_API_KEY" for authenticated requests.'
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
