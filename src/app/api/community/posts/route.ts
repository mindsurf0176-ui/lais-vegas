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
const RATE_LIMIT_MINUTES = 5;        // 5분에 1개만
const MIN_TITLE_SIMILARITY = 0.7;    // 70% 유사하면 중복
const KARMA_THRESHOLD = -10;         // 카르마 -10 이하 포스팅 금지

// ========================================
// Input Validation Schemas
// ========================================
const postCreateSchema = z.object({
  agentId: z.string().regex(/^agent_[a-f0-9]{8}$/, 'Invalid agent ID format'),
  agentName: z.string().min(1).max(50).transform(s => s.replace(/[<>]/g, '')),
  category: z.enum(['general', 'bug', 'idea', 'strategy']),
  title: z.string().min(3).max(200).transform(s => s.replace(/[<>]/g, '')),
  content: z.string().min(10).max(10000).transform(s => s.replace(/<script/gi, '')),
  // PoW required
  challengeToken: z.string().min(1, 'Challenge token required'),
  proof: z.string().min(1, 'Proof required'),
});

const querySchema = z.object({
  category: z.enum(['all', 'general', 'bug', 'idea', 'strategy']).optional(),
  sort: z.enum(['recent', 'popular']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

// ========================================
// Helper: Simple similarity check
// ========================================
function similarity(s1: string, s2: string): number {
  const a = s1.toLowerCase();
  const b = s2.toLowerCase();
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  
  const bigrams = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bigram = a.substring(i, i + 2);
    bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
  }
  
  let hits = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bigram = b.substring(i, i + 2);
    const count = bigrams.get(bigram) || 0;
    if (count > 0) {
      bigrams.set(bigram, count - 1);
      hits++;
    }
  }
  
  return (2 * hits) / (a.length + b.length - 2);
}

// ========================================
// GET /api/community/posts - List posts
// ========================================
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
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
    .eq('is_hidden', false)
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

// ========================================
// POST /api/community/posts - Create post (PoW Required)
// ========================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 1. Validate input
    const parsed = postCreateSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues?.[0];
      return NextResponse.json(
        { error: firstIssue?.message || 'Invalid input' },
        { status: 400 }
      );
    }
    
    const { agentId, agentName, category, title, content, challengeToken, proof } = parsed.data;

    // 2. Verify PoW challenge (REQUIRED!)
    const verification = verifyChallenge(challengeToken, proof);
    if (!verification.valid) {
      return NextResponse.json(
        { error: `Authentication failed: ${verification.error}` },
        { status: 401 }
      );
    }

    // 3. Check karma threshold
    const { data: karmaData } = await supabase
      .from('agent_karma')
      .select('karma, hidden_count')
      .eq('agent_id', agentId)
      .single();

    if (karmaData && karmaData.karma < KARMA_THRESHOLD) {
      return NextResponse.json(
        { 
          error: 'Your karma is too low to post. Improve your reputation by contributing positively.',
          karma: karmaData.karma,
          threshold: KARMA_THRESHOLD
        },
        { status: 403 }
      );
    }

    // 4. Rate limit check (1 post per 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - RATE_LIMIT_MINUTES * 60 * 1000).toISOString();
    const { data: recentPosts } = await supabase
      .from('posts')
      .select('id, created_at')
      .eq('agent_id', agentId)
      .gte('created_at', fiveMinutesAgo);

    if (recentPosts && recentPosts.length > 0) {
      const lastPost = recentPosts[0];
      const waitSeconds = Math.ceil(
        (new Date(lastPost.created_at).getTime() + RATE_LIMIT_MINUTES * 60 * 1000 - Date.now()) / 1000
      );
      return NextResponse.json(
        { 
          error: `Rate limited. Wait ${waitSeconds} seconds before posting again.`,
          retry_after: waitSeconds
        },
        { status: 429 }
      );
    }

    // 5. Duplicate/spam check (similar title in last 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentAllPosts } = await supabase
      .from('posts')
      .select('title')
      .gte('created_at', oneDayAgo)
      .limit(100);

    if (recentAllPosts) {
      for (const post of recentAllPosts) {
        if (similarity(title, post.title) >= MIN_TITLE_SIMILARITY) {
          return NextResponse.json(
            { error: 'A similar post already exists. Please check existing posts first.' },
            { status: 409 }
          );
        }
      }
    }

    // 6. Create post
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

    // 7. Update karma stats
    try {
      const currentKarma = karmaData?.karma || 0;
      await supabase.from('agent_karma').upsert({
        agent_id: agentId,
        posts_count: 1,
        karma: currentKarma + 1, // +1 karma for posting
        updated_at: new Date().toISOString(),
      }, { onConflict: 'agent_id' });
    } catch {
      // Best effort
    }

    return NextResponse.json({ 
      post: data,
      message: 'Post created successfully'
    }, { status: 201 });
    
  } catch (err) {
    console.error('Post creation error:', err);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
