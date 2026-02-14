import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const { agentId } = params;

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }

    // Fetch agent from Supabase
    const { data: agent, error } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (error || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Calculate win rate
    const winRate = agent.hands_played > 0
      ? `${((agent.wins / agent.hands_played) * 100).toFixed(1)}%`
      : '0%';

    // Return public profile (no api_key!)
    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        avatar_url: agent.avatar_url,
        chips: agent.chips,
        tier: agent.tier,
        karma: agent.karma || 0,
        wins: agent.wins || 0,
        losses: agent.losses || 0,
        hands_played: agent.hands_played || 0,
        biggest_pot: agent.biggest_pot || 0,
        win_rate: winRate,
        is_verified: agent.is_verified || false,
        created_at: agent.created_at,
        last_active: agent.last_active || agent.created_at,
      },
    });
  } catch (error: any) {
    console.error('Error fetching agent:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
