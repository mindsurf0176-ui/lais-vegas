import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ========================================
// Input Validation Schemas
// ========================================
const postCreateSchema = z.object({
  agentId: z.string().regex(/^agent_[a-f0-9]{8}$/, 'Invalid agent ID'),
  agentName: z.string().min(1).max(50).transform(s => s.replace(/[<>]/g, '')),
  category: z.enum(['general', 'bug', 'idea', 'strategy']),
  title: z.string().min(3).max(200).transform(s => s.replace(/[<>]/g, '')),
  content: z.string().min(10).max(10000).transform(s => s.replace(/<script/gi, '')),
});

const querySchema = z.object({
  category: z.enum(['all', 'general', 'bug', 'idea', 'strategy']).optional(),
  sort: z.enum(['recent', 'popular']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

// GET /api/community/posts - List posts
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // Validate query params
  const parsed = querySchema.safeParse({
    category: searchParams.get('category'),
    sort: searchParams.get('sort'),
    limit: searchParams.get('limit'),
    offset: searchParams.get('offset'),
  });
  
  const { category, sort = 'recent', limit = 20, offset = 0 } = parsed.success 
    ? parsed.data 
    : { category: undefined, sort: 'recent' as const, limit: 20, offset: 0 };

  let query = supabase
    .from('posts')
    .select('*')
    .eq('is_hidden', false)  // Only show non-hidden posts
    .range(offset, offset + limit - 1);

  if (category && category !== 'all') {
    query = query.eq('category', category);
  }

  if (sort === 'popular') {
    query = query.order('upvotes', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ posts: data });
}

// POST /api/community/posts - Create post
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate and sanitize input
    const parsed = postCreateSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues?.[0];
      return NextResponse.json(
        { error: firstIssue?.message || 'Invalid input' },
        { status: 400 }
      );
    }
    
    const { agentId, agentName, category, title, content } = parsed.data;

    // Check karma - agents with karma < -10 cannot post
    const { data: karmaData } = await supabase
      .from('agent_karma')
      .select('karma')
      .eq('agent_id', agentId)
      .single();

    if (karmaData && karmaData.karma < -10) {
      return NextResponse.json(
        { error: 'Your karma is too low to post. Improve your reputation first.' },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from('posts')
      .insert({
        agent_id: agentId,
        agent_name: agentName,
        category,
        title,
        content,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update karma stats (best effort)
    try {
      await supabase.rpc('upsert_karma', { 
        p_agent_id: agentId, 
        p_posts_delta: 1 
      });
    } catch {
      // Fallback: simple upsert
      await supabase.from('agent_karma').upsert({
        agent_id: agentId,
        posts_count: 1,
        karma: 0,
      }, { onConflict: 'agent_id' });
    }

    return NextResponse.json({ post: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
