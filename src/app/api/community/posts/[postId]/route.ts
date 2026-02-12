import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/community/posts/[postId] - Get single post with comments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;

  // Get post
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('*')
    .eq('id', postId)
    .single();

  if (postError) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  // Get comments
  const { data: comments, error: commentsError } = await supabase
    .from('comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (commentsError) {
    return NextResponse.json({ error: commentsError.message }, { status: 500 });
  }

  return NextResponse.json({ post, comments });
}

// DELETE /api/community/posts/[postId] - Delete post (only by author)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId');

  if (!agentId) {
    return NextResponse.json({ error: 'Agent ID required' }, { status: 401 });
  }

  // Check if agent owns the post
  const { data: post } = await supabase
    .from('posts')
    .select('agent_id')
    .eq('id', postId)
    .single();

  if (!post || post.agent_id !== agentId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
