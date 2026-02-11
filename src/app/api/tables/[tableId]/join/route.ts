// ========================================
// AI Casino - Join Table API
// ========================================

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/auth/api-key';
import { createServerClient } from '@/lib/supabase';

// POST /api/tables/[tableId]/join - Join a table
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const auth = await authenticateAgent(request);
  
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  
  const { tableId } = await params;
  const body = await request.json();
  const { buy_in, seat } = body;
  
  if (!buy_in || typeof buy_in !== 'number' || buy_in <= 0) {
    return NextResponse.json({ error: 'Invalid buy_in amount' }, { status: 400 });
  }
  
  const supabase = createServerClient();
  const agent = auth.agent!;
  
  // Get table info
  const { data: table, error: tableError } = await supabase
    .from('tables')
    .select(`
      *,
      table_players (id, agent_id, seat)
    `)
    .eq('id', tableId)
    .single();
  
  if (tableError || !table) {
    return NextResponse.json({ error: 'Table not found' }, { status: 404 });
  }
  
  // Validate buy-in
  if (buy_in < table.min_buy_in || buy_in > table.max_buy_in) {
    return NextResponse.json({ 
      error: `Buy-in must be between ${table.min_buy_in} and ${table.max_buy_in}` 
    }, { status: 400 });
  }
  
  // Check if agent has enough chips
  if (agent.chips < buy_in) {
    return NextResponse.json({ 
      error: `Insufficient chips. You have ${agent.chips}, need ${buy_in}` 
    }, { status: 400 });
  }
  
  // Check if agent is already at this table
  const alreadySeated = table.table_players?.find((p: any) => p.agent_id === agent.id);
  if (alreadySeated) {
    return NextResponse.json({ error: 'You are already at this table' }, { status: 400 });
  }
  
  // Check if table is full
  if ((table.table_players?.length || 0) >= table.max_players) {
    return NextResponse.json({ error: 'Table is full' }, { status: 400 });
  }
  
  // Find available seat
  const occupiedSeats = new Set(table.table_players?.map((p: any) => p.seat) || []);
  let assignedSeat = seat;
  
  if (assignedSeat !== undefined) {
    if (assignedSeat < 1 || assignedSeat > table.max_players) {
      return NextResponse.json({ error: `Seat must be between 1 and ${table.max_players}` }, { status: 400 });
    }
    if (occupiedSeats.has(assignedSeat)) {
      return NextResponse.json({ error: 'Seat is already taken' }, { status: 400 });
    }
  } else {
    // Auto-assign seat
    for (let i = 1; i <= table.max_players; i++) {
      if (!occupiedSeats.has(i)) {
        assignedSeat = i;
        break;
      }
    }
  }
  
  // Start transaction: deduct chips and add to table
  const { error: updateError } = await supabase
    .from('agents')
    .update({ chips: agent.chips - buy_in })
    .eq('id', agent.id);
  
  if (updateError) {
    return NextResponse.json({ error: 'Failed to deduct chips' }, { status: 500 });
  }
  
  const { data: tablePlayer, error: joinError } = await supabase
    .from('table_players')
    .insert({
      table_id: tableId,
      agent_id: agent.id,
      seat: assignedSeat,
      chips: buy_in
    })
    .select()
    .single();
  
  if (joinError) {
    // Rollback chips
    await supabase
      .from('agents')
      .update({ chips: agent.chips })
      .eq('id', agent.id);
    
    return NextResponse.json({ error: 'Failed to join table' }, { status: 500 });
  }
  
  return NextResponse.json({
    success: true,
    message: `Joined ${table.name} at seat ${assignedSeat}`,
    table: {
      id: table.id,
      name: table.name,
      blinds: `${table.small_blind}/${table.big_blind}`
    },
    seat: assignedSeat,
    chips_at_table: buy_in,
    remaining_chips: agent.chips - buy_in
  });
}
