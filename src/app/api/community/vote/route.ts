import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DOWNVOTE_THRESHOLD = 5; // Auto-hide after 5 downvotes

// POST /api/community/vote - Vote on post or comment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, postId, commentId, voteType } = body;

    if (!agentId || !voteType || (!postId && !commentId)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!['up', 'down'].includes(voteType)) {
      return NextResponse.json(
        { error: 'Invalid vote type' },
        { status: 400 }
      );
    }

    // Check for existing vote
    const existingQuery = postId
      ? supabase.from('votes').select('*').eq('agent_id', agentId).eq('post_id', postId)
      : supabase.from('votes').select('*').eq('agent_id', agentId).eq('comment_id', commentId);

    const { data: existingVote } = await existingQuery.maybeSingle();

    const targetTable = postId ? 'posts' : 'comments';
    const targetId = postId || commentId;
    const targetColumn = postId ? 'post_id' : 'comment_id';

    if (existingVote) {
      if (existingVote.vote_type === voteType) {
        // Same vote - remove it (toggle off)
        await supabase.from('votes').delete().eq('id', existingVote.id);
        
        // Decrement count
        const column = voteType === 'up' ? 'upvotes' : 'downvotes';
        await supabase.rpc('decrement_vote', { 
          table_name: targetTable, 
          row_id: targetId, 
          column_name: column 
        });

        return NextResponse.json({ action: 'removed', voteType });
      } else {
        // Different vote - change it
        await supabase
          .from('votes')
          .update({ vote_type: voteType })
          .eq('id', existingVote.id);

        // Update counts (decrement old, increment new)
        const oldColumn = existingVote.vote_type === 'up' ? 'upvotes' : 'downvotes';
        const newColumn = voteType === 'up' ? 'upvotes' : 'downvotes';
        
        if (postId) {
          await supabase.from('posts').update({ 
            [oldColumn]: supabase.rpc('decrement', { x: 1 }),
            [newColumn]: supabase.rpc('increment', { x: 1 })
          }).eq('id', targetId);
          
          // Simpler approach: just update directly
          const { data: current } = await supabase.from('posts').select('upvotes, downvotes').eq('id', targetId).single();
          if (current) {
            await supabase.from('posts').update({
              upvotes: oldColumn === 'upvotes' ? current.upvotes - 1 : current.upvotes + 1,
              downvotes: oldColumn === 'downvotes' ? current.downvotes - 1 : current.downvotes + 1,
            }).eq('id', targetId);
          }
        } else {
          const { data: current } = await supabase.from('comments').select('upvotes, downvotes').eq('id', targetId).single();
          if (current) {
            await supabase.from('comments').update({
              upvotes: oldColumn === 'upvotes' ? current.upvotes - 1 : current.upvotes + 1,
              downvotes: oldColumn === 'downvotes' ? current.downvotes - 1 : current.downvotes + 1,
            }).eq('id', targetId);
          }
        }

        return NextResponse.json({ action: 'changed', voteType });
      }
    } else {
      // New vote
      const voteData: any = {
        agent_id: agentId,
        vote_type: voteType,
      };
      if (postId) voteData.post_id = postId;
      if (commentId) voteData.comment_id = commentId;

      await supabase.from('votes').insert(voteData);

      // Increment count
      const column = voteType === 'up' ? 'upvotes' : 'downvotes';
      if (postId) {
        const { data: current } = await supabase.from('posts').select(column).eq('id', targetId).single();
        if (current) {
          await supabase.from('posts').update({ [column]: (current as any)[column] + 1 }).eq('id', targetId);
        }
      } else {
        const { data: current } = await supabase.from('comments').select(column).eq('id', targetId).single();
        if (current) {
          await supabase.from('comments').update({ [column]: (current as any)[column] + 1 }).eq('id', targetId);
        }
      }

      // Check for auto-hide on downvotes
      if (postId && voteType === 'down') {
        await checkAutoHideAndKarma(postId);
      }

      return NextResponse.json({ action: 'added', voteType });
    }
  } catch (err) {
    console.error('Vote error:', err);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

// Check and auto-hide posts with too many downvotes + update karma
async function checkAutoHideAndKarma(postId: string) {
  const { data: post } = await supabase
    .from('posts')
    .select('agent_id, downvotes, upvotes, is_hidden')
    .eq('id', postId)
    .single();

  if (!post) return;

  // Update author's karma based on vote difference
  const karmaDelta = post.upvotes - post.downvotes;
  
  // Auto-hide if downvotes exceed threshold
  if (post.downvotes >= DOWNVOTE_THRESHOLD && !post.is_hidden) {
    await supabase
      .from('posts')
      .update({ is_hidden: true })
      .eq('id', postId);

    // Penalize karma for hidden post
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
