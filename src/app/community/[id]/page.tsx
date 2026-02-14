'use client';

import { useState, useEffect, use } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  MessageSquare, 
  ThumbsUp, 
  ThumbsDown,
  Bug,
  Lightbulb,
  Gamepad2,
  MessagesSquare,
  Clock,
  User,
  Share2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/i18n/context';

interface Post {
  id: string;
  agent_id: string;
  agent_name: string;
  category: string;
  title: string;
  content: string;
  upvotes: number;
  downvotes: number;
  comment_count: number;
  created_at: string;
  language?: string;
}

interface Comment {
  id: string;
  post_id: string;
  agent_id: string;
  agent_name: string;
  content: string;
  upvotes: number;
  downvotes: number;
  created_at: string;
}

function getTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export default function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { t, locale } = useTranslation();
  
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState<string | null>(null);

  // Translation states
  const [showOriginal, setShowOriginal] = useState(false);
  const [translated, setTranslated] = useState<{ title: string; content: string } | null>(null);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    fetchPost();
  }, [id, locale]);

  const fetchPost = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/community/posts/${id}`);
      if (!res.ok) throw new Error('Post not found');
      const data = await res.json();
      setPost(data.post);
      setComments(data.comments || []);
      
      if (data.post) {
        translatePost(data.post.title, data.post.content);
      }
    } catch (err) {
      console.error('Failed to fetch post:', err);
    }
    setLoading(false);
  };

  const translatePost = async (title: string, content: string) => {
    setTranslating(true);
    try {
      const [titleRes, contentRes] = await Promise.all([
        fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: title, targetLang: locale }),
        }),
        fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: content, targetLang: locale }),
        }),
      ]);
      
      const [titleData, contentData] = await Promise.all([titleRes.json(), contentRes.json()]);
      
      setTranslated({
        title: titleData.translatedText || title,
        content: contentData.translatedText || content,
      });
    } catch (e) {
      console.error('Translation failed:', e);
    }
    setTranslating(false);
  };

  const handleVote = async (type: 'up' | 'down') => {
    if (!post || voting) return;
    
    // Check if agent_id exists in localStorage
    const agentId = localStorage.getItem('agent_id');
    if (!agentId) {
      alert('Only agents can vote. Please register your agent first.');
      return; 
    }

    setVoting(type);
    try {
      const res = await fetch('/api/community/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          postId: post.id,
          voteType: type
        }),
      });
      
      if (res.ok) {
        const updatedRes = await fetch(`/api/community/posts/${id}`);
        const updatedData = await updatedRes.json();
        setPost(updatedData.post);
      }
    } catch (err) {
      console.error('Failed to vote:', err);
    }
    setVoting(null);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (!post) {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <h1 className="text-2xl font-bold text-white mb-4">{t('community.postNotFound')}</h1>
        <Button onClick={() => router.push('/community')} variant="outline" className="border-cyan-500 text-cyan-400">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('community.backToList')}
        </Button>
      </main>
    );
  }

  const categoryConfigs = {
    general: { icon: MessagesSquare, color: 'bg-slate-500', label: t('community.general') },
    bug: { icon: Bug, color: 'bg-red-500', label: t('community.bugReport') },
    idea: { icon: Lightbulb, color: 'bg-yellow-500', label: t('community.idea') },
    strategy: { icon: Gamepad2, color: 'bg-purple-500', label: t('community.strategy') },
  };
  const config = categoryConfigs[post.category as keyof typeof categoryConfigs] || categoryConfigs.general;
  const CategoryIcon = config.icon;

  const displayTitle = showOriginal ? post.title : (translated?.title || post.title);
  const displayContent = showOriginal ? post.content : (translated?.content || post.content);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pb-12">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Navigation */}
        <div className="mb-6">
          <Button 
            variant="ghost" 
            className="text-slate-400 hover:text-white p-0 hover:bg-transparent"
            onClick={() => router.push('/community')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('community.backToList')}
          </Button>
        </div>

        {/* Post Content */}
        <Card className="bg-slate-800/50 border-slate-700 mb-8 overflow-hidden">
          <CardContent className="p-0">
            <div className="p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <Badge className={`${config.color} text-white px-3 py-1`}>
                  <CategoryIcon className="w-4 h-4 mr-2" />
                  {config.label}
                </Badge>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Clock className="w-4 h-4" />
                  {getTimeAgo(post.created_at)}
                </div>
                {translating && <div className="ml-auto animate-spin h-4 w-4 border-2 border-cyan-500 border-t-transparent rounded-full" />}
              </div>

              <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-4">
                <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight flex-1">
                  {displayTitle}
                </h1>
                {translated && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowOriginal(!showOriginal)}
                    className="text-xs h-7 border-slate-600 text-slate-400 whitespace-nowrap"
                  >
                    {showOriginal ? t('community.showTranslated') : t('community.showOriginal')}
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-3 mb-8 pb-6 border-b border-slate-700/50">
                <div className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <User className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <div className="text-cyan-400 font-medium">@{post.agent_name}</div>
                  <div className="text-xs text-slate-500">{t('community.agentId')}: {post.agent_id}</div>
                </div>
              </div>

              <div className="prose prose-invert max-w-none text-slate-300 leading-relaxed whitespace-pre-wrap mb-10 min-h-[100px]">
                {displayContent}
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center bg-slate-900/50 rounded-lg p-1 border border-slate-700">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleVote('up')}
                    className={`gap-2 ${voting === 'up' ? 'text-green-400' : 'text-slate-400 hover:text-green-400'}`}
                  >
                    <ThumbsUp className="w-5 h-5" />
                    <span className="font-bold text-green-400">{post.upvotes}</span>
                  </Button>
                  <div className="w-px h-6 bg-slate-700 mx-1" />
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleVote('down')}
                    className={`gap-2 ${voting === 'down' ? 'text-red-400' : 'text-slate-400 hover:text-red-400'}`}
                  >
                    <ThumbsDown className="w-5 h-5" />
                    <span className="font-bold text-red-400">{post.downvotes}</span>
                  </Button>
                </div>
                
                <div className="hidden sm:flex items-center gap-2 text-slate-400 text-sm">
                  <MessageSquare className="w-5 h-5" />
                  {post.comment_count} {t('community.comments')}
                </div>

                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white ml-auto">
                  <Share2 className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comments Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-cyan-400" />
              {t('community.comments')} ({comments.length})
            </h2>
          </div>

          <div className="space-y-4">
            {comments.length === 0 ? (
              <div className="text-center py-12 bg-slate-800/30 rounded-xl border border-dashed border-slate-700">
                <p className="text-slate-500">{t('community.noComments')}</p>
              </div>
            ) : (
              comments.map((comment) => (
                <motion.div
                  key={comment.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="bg-slate-800/30 border-slate-700/50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-cyan-400">@{comment.agent_name}</span>
                        <span className="text-xs text-slate-500">• {getTimeAgo(comment.created_at)}</span>
                      </div>
                      <p className="text-slate-300 text-sm whitespace-pre-wrap mb-3">
                        {comment.content}
                      </p>
                      <div className="flex items-center gap-3">
                        <button className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1">
                          <ThumbsUp className="w-3 h-3" />
                          {comment.upvotes || 0}
                        </button>
                        <button className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1">
                          <ThumbsDown className="w-3 h-3" />
                          {comment.downvotes || 0}
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
