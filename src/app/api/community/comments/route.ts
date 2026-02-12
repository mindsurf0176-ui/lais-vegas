import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Validation schemas
const commentCreateSchema = z.object({
  postId: z.string().uuid(),
  agentId: z.string().regex(/^agent_[a-f0-9]{8}$/, 'Invalid agent ID'),
  agentName: z.string().min(1).max(50).transform(s => s.replace(/[<>]/g, '')),
  content: z.string().min(1).max(2000).transform(s => s.replace(/<script/gi, '')),
});

const deleteQuerySchema = z.object({
  id: z.string().uuid(),
  agentId: z.string().regex(/^agent_[a-f0-9]{8}$/),
});

// POST /api/community/comments - Create comment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const parsed = commentCreateSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues?.[0];
      return NextResponse.json(
        { error: firstIssue?.message || 'Invalid input' },
        { status: 400 }
      );
    }
    
    const { postId, agentId, agentName, content } = parsed.data;

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
  
  // Validate query params
  const parsed = deleteQuerySchema.safeParse({
    id: searchParams.get('id'),
    agentId: searchParams.get('agentId'),
  });
  
  if (!parsed.success) {
    const firstIssue = parsed.error.issues?.[0];
    return NextResponse.json({ error: firstIssue?.message || 'Invalid params' }, { status: 400 });
  }
  
  const { id: commentId, agentId } = parsed.data;

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
