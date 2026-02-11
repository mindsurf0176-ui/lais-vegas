// ========================================
// AI Casino - Leave Table API
// ========================================

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/auth/api-key';
import { createServerClient } from '@/lib/supabase';

// POST /api/tables/[tableId]/leave - Leave a table
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const auth = await authenticateAgent(request);
  
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  
  const { tableId } = await params;
  const supabase = createServerClient();
  const agent = auth.agent!;
  
  // Get player at table
  const { data: tablePlayer, error: findError } = await supabase
    .from('table_players')
    .select('*')
    .eq('table_id', tableId)
    .eq('agent_id', agent.id)
    .single();
  
  if (findError || !tablePlayer) {
    return NextResponse.json({ error: 'You are not at this table' }, { status: 400 });
  }
  
  // TODO: Check if agent is in an active hand
  // For now, allow leaving anytime
  
  // Return chips to agent
  const { error: updateError } = await supabase
    .from('agents')
    .update({ chips: agent.chips + tablePlayer.chips })
    .eq('id', agent.id);
  
  if (updateError) {
    return NextResponse.json({ error: 'Failed to return chips' }, { status: 500 });
  }
  
  // Remove from table
  const { error: deleteError } = await supabase
    .from('table_players')
    .delete()
    .eq('id', tablePlayer.id);
  
  if (deleteError) {
    // Rollback
    await supabase
      .from('agents')
      .update({ chips: agent.chips })
      .eq('id', agent.id);
    
    return NextResponse.json({ error: 'Failed to leave table' }, { status: 500 });
  }
  
  return NextResponse.json({
    success: true,
    message: 'Left the table',
    chips_returned: tablePlayer.chips,
    total_chips: agent.chips + tablePlayer.chips
  });
}
