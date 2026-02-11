// ========================================
// AI Casino - Game Action API
// ========================================

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/auth/api-key';
import { createServerClient } from '@/lib/supabase';
import { PlayerAction } from '@/types';

// POST /api/tables/[tableId]/action - Make a game action
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const startTime = Date.now();
  
  const auth = await authenticateAgent(request);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  
  const { tableId } = await params;
  const body = await request.json();
  const { action, amount } = body as { action: PlayerAction; amount?: number };
  
  // Validate action
  const validActions: PlayerAction[] = ['fold', 'check', 'call', 'raise', 'all_in'];
  if (!validActions.includes(action)) {
    return NextResponse.json({ 
      error: 'Invalid action',
      valid_actions: validActions 
    }, { status: 400 });
  }
  
  if ((action === 'raise' || action === 'all_in') && (amount === undefined || amount <= 0)) {
    return NextResponse.json({ error: 'Amount required for raise/all_in' }, { status: 400 });
  }
  
  const supabase = createServerClient();
  const agent = auth.agent!;
  
  // Get table and current hand
  const { data: table, error: tableError } = await supabase
    .from('tables')
    .select(`
      *,
      table_players (*)
    `)
    .eq('id', tableId)
    .single();
  
  if (tableError || !table) {
    return NextResponse.json({ error: 'Table not found' }, { status: 404 });
  }
  
  if (!table.current_hand_id) {
    return NextResponse.json({ error: 'No active hand at this table' }, { status: 400 });
  }
  
  // Get current hand with players
  const { data: hand, error: handError } = await supabase
    .from('hands')
    .select(`
      *,
      hand_players (*)
    `)
    .eq('id', table.current_hand_id)
    .single();
  
  if (handError || !hand) {
    return NextResponse.json({ error: 'Hand not found' }, { status: 404 });
  }
  
  // Find player in hand
  const handPlayer = hand.hand_players?.find((p: any) => p.agent_id === agent.id);
  if (!handPlayer) {
    return NextResponse.json({ error: 'You are not in this hand' }, { status: 400 });
  }
  
  if (handPlayer.is_folded) {
    return NextResponse.json({ error: 'You have already folded' }, { status: 400 });
  }
  
  // Get table player for chip count
  const tablePlayer = table.table_players?.find((p: any) => p.agent_id === agent.id);
  if (!tablePlayer) {
    return NextResponse.json({ error: 'You are not at this table' }, { status: 400 });
  }
  
  // Calculate response time (for human detection)
  const responseTime = Date.now() - startTime;
  
  // Process action
  let newBet = handPlayer.bet;
  let chipsUsed = 0;
  
  // Get current bet to call
  const maxBet = Math.max(...(hand.hand_players?.map((p: any) => p.bet) || [0]));
  const toCall = maxBet - handPlayer.bet;
  
  switch (action) {
    case 'fold':
      // Mark as folded
      await supabase
        .from('hand_players')
        .update({ is_folded: true })
        .eq('id', handPlayer.id);
      break;
      
    case 'check':
      if (toCall > 0) {
        return NextResponse.json({ error: 'Cannot check, must call or fold' }, { status: 400 });
      }
      break;
      
    case 'call':
      if (toCall === 0) {
        return NextResponse.json({ error: 'Nothing to call, use check instead' }, { status: 400 });
      }
      chipsUsed = Math.min(toCall, tablePlayer.chips);
      newBet = handPlayer.bet + chipsUsed;
      break;
      
    case 'raise':
      const minRaise = maxBet + table.big_blind;
      if (amount! < minRaise) {
        return NextResponse.json({ 
          error: `Minimum raise is ${minRaise}`,
          current_bet: maxBet,
          min_raise: minRaise
        }, { status: 400 });
      }
      if (amount! > tablePlayer.chips + handPlayer.bet) {
        return NextResponse.json({ error: 'Not enough chips' }, { status: 400 });
      }
      chipsUsed = amount! - handPlayer.bet;
      newBet = amount!;
      break;
      
    case 'all_in':
      chipsUsed = tablePlayer.chips;
      newBet = handPlayer.bet + chipsUsed;
      await supabase
        .from('hand_players')
        .update({ is_all_in: true })
        .eq('id', handPlayer.id);
      break;
  }
  
  // Update hand player bet
  if (chipsUsed > 0) {
    await supabase
      .from('hand_players')
      .update({ bet: newBet })
      .eq('id', handPlayer.id);
    
    // Update table player chips
    await supabase
      .from('table_players')
      .update({ chips: tablePlayer.chips - chipsUsed })
      .eq('id', tablePlayer.id);
    
    // Update pot
    await supabase
      .from('hands')
      .update({ pot: hand.pot + chipsUsed })
      .eq('id', hand.id);
  }
  
  // Log action
  await supabase
    .from('actions')
    .insert({
      hand_id: hand.id,
      agent_id: agent.id,
      action,
      amount: chipsUsed || null,
      phase: hand.phase,
      response_time_ms: responseTime
    });
  
  return NextResponse.json({
    success: true,
    action,
    amount: chipsUsed || 0,
    new_bet: newBet,
    remaining_chips: tablePlayer.chips - chipsUsed,
    pot: hand.pot + chipsUsed,
    response_time_ms: responseTime
  });
}
