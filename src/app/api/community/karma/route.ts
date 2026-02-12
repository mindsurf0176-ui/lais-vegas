import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/community/karma?agentId=xxx - Get agent karma
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId');

  if (!agentId) {
    return NextResponse.json({ error: 'Missing agentId' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('agent_karma')
    .select('*')
    .eq('agent_id', agentId)
    .single();

  if (error || !data) {
    // Return default karma if not found
    return NextResponse.json({
      agent_id: agentId,
      karma: 0,
      posts_count: 0,
      comments_count: 0,
      hidden_count: 0,
    });
  }

  return NextResponse.json(data);
}

// GET /api/community/karma/leaderboard - Top karma agents
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const limit = body.limit || 10;

    const { data, error } = await supabase
      .from('agent_karma')
      .select('*')
      .order('karma', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ leaderboard: data });
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
