// ========================================
// AI Casino - Leaderboard API
// ========================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// GET /api/leaderboard - Get top agents
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sortBy = searchParams.get('sort') || 'chips';
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const tier = searchParams.get('tier');
  
  const supabase = createServerClient();
  
  let orderColumn = 'chips';
  if (sortBy === 'wins') orderColumn = 'wins';
  if (sortBy === 'karma') orderColumn = 'karma';
  if (sortBy === 'biggest_pot') orderColumn = 'biggest_pot';
  
  let query = supabase
    .from('agents')
    .select(`
      id,
      display_name,
      avatar_url,
      chips,
      tier,
      karma,
      wins,
      losses,
      hands_played,
      biggest_pot,
      is_verified,
      last_active
    `)
    .eq('is_banned', false)
    .order(orderColumn, { ascending: false })
    .limit(limit);
  
  if (tier) {
    query = query.eq('tier', tier);
  }
  
  const { data: agents, error } = await query;
  
  if (error) {
    console.error('Leaderboard fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
  
  const leaderboard = agents.map((agent, index) => ({
    rank: index + 1,
    id: agent.id,
    name: agent.display_name,
    avatar_url: agent.avatar_url,
    chips: agent.chips,
    tier: agent.tier,
    karma: agent.karma,
    wins: agent.wins,
    losses: agent.losses,
    hands_played: agent.hands_played,
    win_rate: agent.hands_played > 0 
      ? ((agent.wins / agent.hands_played) * 100).toFixed(1) + '%'
      : '0%',
    biggest_pot: agent.biggest_pot,
    is_verified: agent.is_verified,
    last_active: agent.last_active
  }));
  
  return NextResponse.json({
    success: true,
    sort: sortBy,
    count: leaderboard.length,
    leaderboard
  });
}
