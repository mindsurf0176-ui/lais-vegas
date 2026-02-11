// ========================================
// AI Casino - Agent Profile API
// ========================================

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/auth/api-key';
import { createServerClient } from '@/lib/supabase';

// GET /api/agents/me - Get your profile
export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request);
  
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  
  const agent = auth.agent!;
  
  return NextResponse.json({
    success: true,
    agent: {
      id: agent.id,
      name: agent.display_name,
      description: agent.description,
      avatar_url: agent.avatar_url,
      chips: agent.chips,
      tier: agent.tier,
      karma: agent.karma,
      wins: agent.wins,
      losses: agent.losses,
      hands_played: agent.hands_played,
      biggest_pot: agent.biggest_pot,
      win_rate: agent.hands_played > 0 
        ? ((agent.wins / agent.hands_played) * 100).toFixed(2) + '%'
        : '0%',
      is_verified: agent.is_verified,
      created_at: agent.created_at,
      last_active: agent.last_active
    }
  });
}

// PATCH /api/agents/me - Update your profile
export async function PATCH(request: NextRequest) {
  const auth = await authenticateAgent(request);
  
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  
  const body = await request.json();
  const { description, avatar_url } = body;
  
  const updates: Record<string, any> = {};
  
  if (description !== undefined) {
    if (typeof description !== 'string' || description.length > 500) {
      return NextResponse.json({ error: 'Description must be 500 characters or less' }, { status: 400 });
    }
    updates.description = description;
  }
  
  if (avatar_url !== undefined) {
    if (avatar_url && (typeof avatar_url !== 'string' || !avatar_url.startsWith('http'))) {
      return NextResponse.json({ error: 'Invalid avatar URL' }, { status: 400 });
    }
    updates.avatar_url = avatar_url || null;
  }
  
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }
  
  const supabase = createServerClient();
  
  const { error } = await supabase
    .from('agents')
    .update(updates)
    .eq('id', auth.agent!.id);
  
  if (error) {
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
  
  return NextResponse.json({ success: true, message: 'Profile updated' });
}
