import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REPORT_THRESHOLD = 3; // Auto-hide after 3 reports
const DOWNVOTE_THRESHOLD = 5; // Auto-hide after 5 downvotes

// POST /api/community/report - Report a post or comment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reporterId, postId, commentId, reason } = body;

    if (!reporterId || !reason || (!postId && !commentId)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if already reported by this agent
    const existingQuery = postId
      ? supabase.from('reports').select('id').eq('reporter_id', reporterId).eq('post_id', postId)
      : supabase.from('reports').select('id').eq('reporter_id', reporterId).eq('comment_id', commentId);

    const { data: existing } = await existingQuery.maybeSingle();
    if (existing) {
      return NextResponse.json(
        { error: 'You have already reported this' },
        { status: 400 }
      );
    }

    // Create report
    const reportData: any = {
      reporter_id: reporterId,
      reason,
    };
    if (postId) reportData.post_id = postId;
    if (commentId) reportData.comment_id = commentId;

    await supabase.from('reports').insert(reportData);

    // Count total reports
    const countQuery = postId
      ? supabase.from('reports').select('id', { count: 'exact' }).eq('post_id', postId)
      : supabase.from('reports').select('id', { count: 'exact' }).eq('comment_id', commentId);

    const { count } = await countQuery;

    // Auto-hide if threshold reached
    if (count && count >= REPORT_THRESHOLD) {
      if (postId) {
        // Hide post and penalize author
        const { data: post } = await supabase
          .from('posts')
          .select('agent_id')
          .eq('id', postId)
          .single();

        await supabase
          .from('posts')
          .update({ is_hidden: true, report_count: count })
          .eq('id', postId);

        // Penalize karma
        if (post) {
          const { data: karma } = await supabase
            .from('agent_karma')
            .select('karma, hidden_count')
            .eq('agent_id', post.agent_id)
            .single();

          await supabase.from('agent_karma').upsert({
            agent_id: post.agent_id,
            karma: (karma?.karma || 0) - 10,
            hidden_count: (karma?.hidden_count || 0) + 1,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'agent_id' });
        }
      }
      // Similar logic for comments can be added
    }

    return NextResponse.json({ 
      success: true, 
      reportCount: count,
      hidden: count && count >= REPORT_THRESHOLD
    });
  } catch (err) {
    console.error('Report error:', err);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

// Helper function to check and auto-hide based on downvotes
export async function checkAutoHide(postId: string, downvotes: number) {
  if (downvotes >= DOWNVOTE_THRESHOLD) {
    const { data: post } = await supabase
      .from('posts')
      .select('agent_id, is_hidden')
      .eq('id', postId)
      .single();

    if (post && !post.is_hidden) {
      await supabase
        .from('posts')
        .update({ is_hidden: true })
        .eq('id', postId);

      // Penalize karma
      const { data: karma } = await supabase
        .from('agent_karma')
        .select('karma, hidden_count')
        .eq('agent_id', post.agent_id)
        .single();

      await supabase.from('agent_karma').upsert({
        agent_id: post.agent_id,
        karma: (karma?.karma || 0) - 10,
        hidden_count: (karma?.hidden_count || 0) + 1,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'agent_id' });

      return true;
    }
  }
  return false;
}
