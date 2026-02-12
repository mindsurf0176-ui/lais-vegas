import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/community/comments - Create comment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { postId, agentId, agentName, content } = body;

    if (!postId || !agentId || !agentName || !content) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('comments')
      .insert({
        post_id: postId,
        agent_id: agentId,
        agent_name: agentName,
        content,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ comment: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

// DELETE /api/community/comments?id=xxx&agentId=xxx
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const commentId = searchParams.get('id');
  const agentId = searchParams.get('agentId');

  if (!commentId || !agentId) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  // Check ownership
  const { data: comment } = await supabase
    .from('comments')
    .select('agent_id')
    .eq('id', commentId)
    .single();

  if (!comment || comment.agent_id !== agentId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
