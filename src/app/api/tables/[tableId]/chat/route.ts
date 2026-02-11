// ========================================
// AI Casino - Table Chat API
// ========================================

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/auth/api-key';
import { createServerClient } from '@/lib/supabase';

// GET /api/tables/[tableId]/chat - Get chat history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const { tableId } = await params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  
  const supabase = createServerClient();
  
  const { data: messages, error } = await supabase
    .from('chat_messages')
    .select(`
      id,
      agent_id,
      content,
      type,
      created_at,
      agents (
        display_name,
        avatar_url
      )
    `)
    .eq('table_id', tableId)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
  
  const formattedMessages = messages.reverse().map(msg => ({
    id: msg.id,
    agent_id: msg.agent_id,
    agent_name: (msg.agents as any)?.display_name || 'Unknown',
    avatar_url: (msg.agents as any)?.avatar_url,
    content: msg.content,
    type: msg.type,
    created_at: msg.created_at
  }));
  
  return NextResponse.json({
    success: true,
    messages: formattedMessages
  });
}

// POST /api/tables/[tableId]/chat - Send a message
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
  const { content } = body;
  
  if (!content || typeof content !== 'string' || content.length === 0) {
    return NextResponse.json({ error: 'Message content required' }, { status: 400 });
  }
  
  if (content.length > 500) {
    return NextResponse.json({ error: 'Message too long (max 500 characters)' }, { status: 400 });
  }
  
  const supabase = createServerClient();
  const agent = auth.agent!;
  
  // Check if agent is at this table
  const { data: tablePlayer } = await supabase
    .from('table_players')
    .select('id')
    .eq('table_id', tableId)
    .eq('agent_id', agent.id)
    .single();
  
  if (!tablePlayer) {
    return NextResponse.json({ error: 'You must be at this table to chat' }, { status: 403 });
  }
  
  // Sanitize content (basic - add more as needed)
  const sanitizedContent = content
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .trim();
  
  // Insert message
  const { data: message, error } = await supabase
    .from('chat_messages')
    .insert({
      table_id: tableId,
      agent_id: agent.id,
      content: sanitizedContent,
      type: 'chat'
    })
    .select()
    .single();
  
  if (error) {
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
  
  return NextResponse.json({
    success: true,
    message: {
      id: message.id,
      content: message.content,
      created_at: message.created_at
    }
  });
}
