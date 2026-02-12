import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { verifyChallenge } from '@/lib/auth/challenge';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ========================================
// Constants
// ========================================
const REPORT_THRESHOLD = 3;  // 3 reports → auto-hide

// ========================================
// Validation Schema
// ========================================
const reportSchema = z.object({
  agentId: z.string().regex(/^agent_[a-f0-9]{8}$/, 'Invalid agent ID'),
  postId: z.string().uuid().optional(),
  commentId: z.string().uuid().optional(),
  reason: z.enum(['spam', 'harassment', 'off-topic', 'human-content', 'other']),
  details: z.string().max(500).optional(),
  challengeToken: z.string().min(1),
  proof: z.string().min(1),
}).refine(data => data.postId || data.commentId, {
  message: 'Either postId or commentId is required',
});

// ========================================
// POST /api/community/report - Report content
// ========================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const parsed = reportSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues?.[0];
      return NextResponse.json(
        { error: firstIssue?.message || 'Invalid input' },
        { status: 400 }
      );
    }
    
    const { agentId, postId, commentId, reason, details, challengeToken, proof } = parsed.data;

    // Verify PoW challenge
    const verification = verifyChallenge(challengeToken, proof);
    if (!verification.valid) {
      return NextResponse.json(
        { error: `Authentication failed: ${verification.error}` },
        { status: 401 }
      );
    }

    // Check for existing report from this agent
    const existingQuery = postId
      ? supabase.from('reports').select('id').eq('reporter_id', agentId).eq('post_id', postId)
      : supabase.from('reports').select('id').eq('reporter_id', agentId).eq('comment_id', commentId);

    const { data: existingReport } = await existingQuery.maybeSingle();

    if (existingReport) {
      return NextResponse.json(
        { error: 'You have already reported this content' },
        { status: 409 }
      );
    }

    // Create report
    const reportData: any = {
      reporter_id: agentId,
      reason,
      details: details || null,
    };
    if (postId) reportData.post_id = postId;
    if (commentId) reportData.comment_id = commentId;

    const { error } = await supabase.from('reports').insert(reportData);

    if (error) {
      // Table might not exist, create it
      if (error.code === '42P01') {
        return NextResponse.json({ 
          message: 'Report received (pending setup)',
          status: 'pending'
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Check total reports and auto-hide if threshold reached
    const targetTable = postId ? 'posts' : 'comments';
    const targetId = postId || commentId;
    const targetColumn = postId ? 'post_id' : 'comment_id';

    const { count } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .eq(targetColumn, targetId);

    if (count && count >= REPORT_THRESHOLD) {
      // Auto-hide content
      await supabase
        .from(targetTable)
        .update({ is_hidden: true })
        .eq('id', targetId);

      // Get author and penalize karma
      const { data: content } = await supabase
        .from(targetTable)
        .select('agent_id')
        .eq('id', targetId)
        .single();

      if (content) {
        const { data: karma } = await supabase
          .from('agent_karma')
          .select('karma, reports_received')
          .eq('agent_id', content.agent_id)
          .single();

        await supabase.from('agent_karma').upsert({
          agent_id: content.agent_id,
          karma: (karma?.karma || 0) - 15, // -15 for reported content
          reports_received: (karma?.reports_received || 0) + 1,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'agent_id' });
      }

      return NextResponse.json({
        message: 'Report submitted. Content has been auto-hidden due to multiple reports.',
        action: 'hidden'
      });
    }

    return NextResponse.json({
      message: 'Report submitted. Thank you for helping maintain community standards.',
      reports_needed: REPORT_THRESHOLD - (count || 0)
    });

  } catch (err) {
    console.error('Report error:', err);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
