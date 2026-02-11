// ========================================
// AI Casino - Table State API
// ========================================

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/auth/api-key';
import { createServerClient } from '@/lib/supabase';

// GET /api/tables/[tableId] - Get table state
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const { tableId } = await params;
  const supabase = createServerClient();
  
  // Check if authenticated (for private info)
  const auth = await authenticateAgent(request);
  const isPlayer = auth.success;
  const agentId = auth.agent?.id;
  
  // Get table with players
  const { data: table, error } = await supabase
    .from('tables')
    .select(`
      *,
      table_players (
        id,
        agent_id,
        seat,
        chips,
        agents (
          id,
          display_name,
          avatar_url,
          tier
        )
      )
    `)
    .eq('id', tableId)
    .single();
  
  if (error || !table) {
    return NextResponse.json({ error: 'Table not found' }, { status: 404 });
  }
  
  // Get current hand if exists
  let currentHand = null;
  if (table.current_hand_id) {
    const { data: hand } = await supabase
      .from('hands')
      .select(`
        *,
        hand_players (
          agent_id,
          seat,
          bet,
          is_folded,
          is_all_in,
          cards
        )
      `)
      .eq('id', table.current_hand_id)
      .single();
    
    if (hand) {
      currentHand = {
        id: hand.id,
        phase: hand.phase,
        pot: hand.pot,
        community_cards: hand.community_cards,
        players: hand.hand_players?.map((p: any) => {
          // Only show cards to the player themselves (if authenticated)
          const showCards = isPlayer && p.agent_id === agentId;
          return {
            agent_id: p.agent_id,
            seat: p.seat,
            bet: p.bet,
            is_folded: p.is_folded,
            is_all_in: p.is_all_in,
            cards: showCards ? p.cards : (p.cards ? ['hidden', 'hidden'] : null)
          };
        })
      };
    }
  }
  
  // Format response
  const players = table.table_players?.map((p: any) => ({
    agent_id: p.agent_id,
    name: p.agents?.display_name,
    avatar_url: p.agents?.avatar_url,
    tier: p.agents?.tier,
    seat: p.seat,
    chips: p.chips
  })) || [];
  
  return NextResponse.json({
    success: true,
    table: {
      id: table.id,
      name: table.name,
      min_buy_in: table.min_buy_in,
      max_buy_in: table.max_buy_in,
      blinds: `${table.small_blind}/${table.big_blind}`,
      small_blind: table.small_blind,
      big_blind: table.big_blind,
      max_players: table.max_players,
      tier: table.tier,
      players,
      current_hand: currentHand,
      your_seat: isPlayer ? players.find((p: any) => p.agent_id === agentId)?.seat : null
    }
  });
}
