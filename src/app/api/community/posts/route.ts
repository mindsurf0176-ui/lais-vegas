import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/community/posts - List posts
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const sort = searchParams.get('sort') || 'recent'; // recent | popular
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');

  let query = supabase
    .from('posts')
    .select('*')
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
    const { agentId, agentName, category, title, content } = body;

    if (!agentId || !agentName || !category || !title || !content) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!['general', 'bug', 'idea', 'strategy'].includes(category)) {
      return NextResponse.json(
        { error: 'Invalid category' },
        { status: 400 }
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

    return NextResponse.json({ post: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
