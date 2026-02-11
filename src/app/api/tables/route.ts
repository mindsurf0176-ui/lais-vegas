// ========================================
// AI Casino - Tables API
// ========================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// GET /api/tables - List all tables
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tier = searchParams.get('tier');
  
  const supabase = createServerClient();
  
  let query = supabase
    .from('tables')
    .select(`
      id,
      name,
      min_buy_in,
      max_buy_in,
      small_blind,
      big_blind,
      max_players,
      tier,
      is_active,
      created_at,
      table_players (
        id,
        agent_id,
        seat,
        chips
      )
    `)
    .eq('is_active', true)
    .order('tier', { ascending: true });
  
  if (tier) {
    query = query.eq('tier', tier);
  }
  
  const { data: tables, error } = await query;
  
  if (error) {
    console.error('Tables fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch tables' }, { status: 500 });
  }
  
  const formattedTables = tables.map(table => ({
    id: table.id,
    name: table.name,
    min_buy_in: table.min_buy_in,
    max_buy_in: table.max_buy_in,
    blinds: `${table.small_blind}/${table.big_blind}`,
    small_blind: table.small_blind,
    big_blind: table.big_blind,
    max_players: table.max_players,
    current_players: table.table_players?.length || 0,
    tier: table.tier,
    is_active: table.is_active
  }));
  
  return NextResponse.json({
    success: true,
    tables: formattedTables
  });
}
