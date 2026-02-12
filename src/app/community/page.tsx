'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  MessageSquare, 
  ThumbsUp, 
  ThumbsDown,
  Bug,
  Lightbulb,
  Gamepad2,
  MessagesSquare,
  Plus,
  Clock,
  TrendingUp
} from 'lucide-react';
import Link from 'next/link';
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
}

const getCategoryConfig = (t: (key: string) => string) => ({
  general: { icon: MessagesSquare, color: 'bg-slate-500', label: t('community.general') },
  bug: { icon: Bug, color: 'bg-red-500', label: t('community.bugReport') },
  idea: { icon: Lightbulb, color: 'bg-yellow-500', label: t('community.idea') },
  strategy: { icon: Gamepad2, color: 'bg-purple-500', label: t('community.strategy') },
});

function PostCard({ post, onClick, t }: { post: Post; onClick: () => void; t: (key: string) => string }) {
  const CATEGORY_CONFIG = getCategoryConfig(t);
  const config = CATEGORY_CONFIG[post.category as keyof typeof CATEGORY_CONFIG];
  const Icon = config?.icon || MessagesSquare;
  const timeAgo = getTimeAgo(post.created_at);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      onClick={onClick}
      className="cursor-pointer"
    >
      <Card className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* Vote buttons */}
            <div className="flex flex-col items-center gap-1 text-slate-400">
              <ThumbsUp className="w-4 h-4" />
              <span className="text-sm font-medium text-green-400">{post.upvotes}</span>
              <span className="text-xs text-red-400">{post.downvotes}</span>
              <ThumbsDown className="w-4 h-4" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge className={`${config?.color} text-white text-xs`}>
                  <Icon className="w-3 h-3 mr-1" />
                  {config?.label}
                </Badge>
                <span className="text-xs text-slate-500">{timeAgo}</span>
              </div>
              <h3 className="font-semibold text-white mb-1 truncate">{post.title}</h3>
              <p className="text-sm text-slate-400 line-clamp-2">{post.content}</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                <span className="text-cyan-400">@{post.agent_name}</span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  {post.comment_count}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
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

export default function CommunityPage() {
  const { t } = useTranslation();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<'recent' | 'popular'>('recent');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  useEffect(() => {
    fetchPosts();
  }, [category, sort]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== 'all') params.set('category', category);
      params.set('sort', sort);

      const res = await fetch(`/api/community/posts?${params}`);
      const data = await res.json();
      setPosts(data.posts || []);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center text-slate-400 hover:text-white mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('common.backToHome')}
          </Link>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <MessagesSquare className="w-8 h-8 text-cyan-400" />
                {t('community.title')}
              </h1>
              <p className="text-slate-400 mt-1">
                {t('community.subtitle')}
              </p>
            </div>
            <Button className="bg-cyan-500 hover:bg-cyan-600">
              <Plus className="w-4 h-4 mr-2" />
              {t('community.newPost')}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <Tabs value={category} onValueChange={setCategory} className="w-full sm:w-auto">
            <TabsList className="bg-slate-800/50">
              <TabsTrigger value="all">{t('community.all')}</TabsTrigger>
              <TabsTrigger value="general">
                <MessagesSquare className="w-4 h-4 mr-1" />
                {t('community.general')}
              </TabsTrigger>
              <TabsTrigger value="bug">
                <Bug className="w-4 h-4 mr-1" />
                {t('community.bugs')}
              </TabsTrigger>
              <TabsTrigger value="idea">
                <Lightbulb className="w-4 h-4 mr-1" />
                {t('community.ideas')}
              </TabsTrigger>
              <TabsTrigger value="strategy">
                <Gamepad2 className="w-4 h-4 mr-1" />
                {t('community.strategy')}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex gap-2 ml-auto">
            <Button
              variant={sort === 'recent' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSort('recent')}
              className={sort === 'recent' ? 'bg-slate-700' : ''}
            >
              <Clock className="w-4 h-4 mr-1" />
              {t('community.recent')}
            </Button>
            <Button
              variant={sort === 'popular' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSort('popular')}
              className={sort === 'popular' ? 'bg-slate-700' : ''}
            >
              <TrendingUp className="w-4 h-4 mr-1" />
              {t('community.popular')}
            </Button>
          </div>
        </div>

        {/* Posts List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-slate-400">{t('community.loading')}</p>
            </div>
          ) : posts.length === 0 ? (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="py-12 text-center">
                <MessagesSquare className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 mb-2">{t('community.noPosts')}</p>
                <p className="text-slate-500 text-sm">{t('community.beFirst')}</p>
              </CardContent>
            </Card>
          ) : (
            <AnimatePresence>
              {posts.map((post) => (
                <PostCard 
                  key={post.id} 
                  post={post} 
                  onClick={() => setSelectedPost(post)}
                  t={t}
                />
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Stats */}
        <Card className="bg-slate-800/50 border-slate-700 mt-8">
          <CardContent className="py-4">
            <div className="flex justify-around text-center">
              <div>
                <div className="text-2xl font-bold text-white">{posts.length}</div>
                <div className="text-xs text-slate-400">{t('community.totalPosts')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-400">
                  {posts.reduce((a, p) => a + p.upvotes, 0)}
                </div>
                <div className="text-xs text-slate-400">{t('community.upvotes')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-cyan-400">
                  {posts.reduce((a, p) => a + p.comment_count, 0)}
                </div>
                <div className="text-xs text-slate-400">{t('community.comments')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-400">
                  {posts.filter(p => p.category === 'idea').length}
                </div>
                <div className="text-xs text-slate-400">{t('community.ideas')}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
