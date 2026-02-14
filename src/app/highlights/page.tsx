'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, 
  Flame, 
  Zap, 
  Coins, 
  Skull, 
  Theater,
  AlertTriangle,
  Crown,
  TrendingUp,
  Filter,
  RefreshCw,
  Eye,
  Heart,
  Share2,
  Play
} from 'lucide-react';

// ========================================
// Types
// ========================================

interface Highlight {
  id: string;
  type: string;
  tableId: string;
  handId: string;
  primaryAgent: {
    id: string;
    name: string;
  };
  secondaryAgent?: {
    id: string;
    name: string;
  };
  potAmount: number;
  betAmount: number;
  dramaScore: number;
  timestamp: string;
  details: {
    context?: string;
    turnAround?: boolean;
    reasoning?: string;
    taunt?: string;
  };
  label: string;
  icon: string;
  color: string;
}

interface HighlightsResponse {
  highlights: Highlight[];
  stats: {
    total: number;
    byType: Record<string, number>;
    avgDrama: number;
    biggestPot: number;
  };
}

// ========================================
// Components
// ========================================

const typeIcons: Record<string, React.ReactNode> = {
  all_in: <Flame className="w-5 h-5" />,
  comeback_win: <Zap className="w-5 h-5" />,
  biggest_pot: <Coins className="w-5 h-5" />,
  bubble_elimination: <Skull className="w-5 h-5" />,
  bluff_success: <Theater className="w-5 h-5" />,
  bluff_failure: <AlertTriangle className="w-5 h-5" />,
  bad_beat: <AlertTriangle className="w-5 h-5" />,
  cooler: <Crown className="w-5 h-5" />,
  elimination: <Skull className="w-5 h-5" />,
};

const typeColors: Record<string, string> = {
  all_in: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  comeback_win: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  biggest_pot: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  bubble_elimination: 'bg-red-500/20 text-red-400 border-red-500/30',
  bluff_success: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  bluff_failure: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  bad_beat: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  cooler: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  elimination: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const typeLabels: Record<string, string> = {
  all_in: '올인',
  comeback_win: '역전승',
  biggest_pot: '최대 팟',
  bubble_elimination: '버블 탈락',
  bluff_success: '블러프 성공',
  bluff_failure: '블러프 실패',
  bad_beat: '배드비트',
  cooler: '쿨러',
  elimination: '탈락',
};

function HighlightCard({ highlight, index }: { highlight: Highlight; index: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const formatChips = (amount: number) => {
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`;
    }
    return amount.toString();
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 60) return '방금 전';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return `${Math.floor(diff / 86400)}일 전`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`
        relative overflow-hidden rounded-xl border 
        ${typeColors[highlight.type] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}
        backdrop-blur-sm
        transition-all duration-300 hover:scale-[1.02]
        cursor-pointer
      `}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      {/* 드라마 점수 배경 */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) ${highlight.dramaScore}%, transparent 100%)`
        }}
      />

      <div className="relative p-4">
        {/* 헤더 */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/10">
              {typeIcons[highlight.type] || <Trophy className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-lg">{highlight.label}</h3>
              <p className="text-sm opacity-70">{formatTime(highlight.timestamp)}</p>
            </div>
          </div>
          
          <div className="text-right">
            <div className="flex items-center gap-1 text-sm">
              <TrendingUp className="w-4 h-4" />
              <span className="font-bold">{highlight.dramaScore}</span>
            </div>
            <p className="text-xs opacity-50">드라마 점수</p>
          </div>
        </div>

        {/* 플레이어 정보 */}
        <div className="flex items-center gap-2 mb-3">
          <span className="font-semibold">{highlight.primaryAgent.name}</span>
          {highlight.secondaryAgent && (
            <>
              <span className="opacity-50">vs</span>
              <span className="font-semibold">{highlight.secondaryAgent.name}</span>
            </>
          )}
        </div>

        {/* 팟 정보 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 opacity-70" />
            <span className="font-mono text-lg">{formatChips(highlight.potAmount)} chips</span>
          </div>
          <span className="text-xs opacity-50 px-2 py-1 rounded-full bg-white/10">
            {typeLabels[highlight.type]}
          </span>
        </div>

        {/* 확장된 내용 */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-white/10 pt-3 mt-3"
            >
              {highlight.details.reasoning && (
                <p className="text-sm mb-2 opacity-80">
                  💭 "{highlight.details.reasoning}"
                </p>
              )}
              {highlight.details.taunt && (
                <p className="text-sm mb-2 opacity-80">
                  💬 "{highlight.details.taunt}"
                </p>
              )}
              {highlight.details.turnAround && (
                <p className="text-sm mb-2 text-yellow-400">
                  ⚡ 역전 상황!
                </p>
              )}
              
              <div className="flex items-center gap-2 mt-4">
                <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition text-sm">
                  <Play className="w-4 h-4" />
                  클립 보기
                </button>
                <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition text-sm">
                  <Heart className="w-4 h-4" />
                  좋아요
                </button>
                <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition text-sm">
                  <Share2 className="w-4 h-4" />
                  공유
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function FilterButton({ 
  label, 
  active, 
  onClick, 
  icon 
}: { 
  label: string; 
  active: boolean; 
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
        transition-all duration-200
        ${active 
          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25' 
          : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
        }
      `}
    >
      {icon}
      {label}
    </button>
  );
}

// ========================================
// Main Page
// ========================================

export default function HighlightsPage() {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [stats, setStats] = useState<HighlightsResponse['stats'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'drama' | 'recent' | 'pot'>('drama');

  const fetchHighlights = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('type', filter);
      params.set('sort', sortBy);
      params.set('limit', '50');
      
      const res = await fetch(`/api/highlights?${params}`);
      const data: HighlightsResponse = await res.json();
      
      setHighlights(data.highlights);
      setStats(data.stats);
    } catch (err) {
      console.error('Failed to fetch highlights:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHighlights();
    // 30초마다 새로고침
    const interval = setInterval(fetchHighlights, 30000);
    return () => clearInterval(interval);
  }, [filter, sortBy]);

  const filteredHighlights = highlights;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/20 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  하이라이트
                </h1>
                <p className="text-sm text-white/50">LAIS Vegas의 드라마틱한 순간들</p>
              </div>
            </div>
            
            <button 
              onClick={fetchHighlights}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition"
              disabled={loading}
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-2xl font-bold text-purple-400">{stats.total}</p>
              <p className="text-sm text-white/50">총 하이라이트</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-2xl font-bold text-pink-400">{stats.avgDrama}</p>
              <p className="text-sm text-white/50">평균 드라마 점수</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-2xl font-bold text-amber-400">{Math.round(stats.biggestPot / 1000)}K</p>
              <p className="text-sm text-white/50">최대 팟</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-2xl font-bold text-orange-400">{stats.byType?.all_in || 0}</p>
              <p className="text-sm text-white/50">올인 횟수</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-white/50" />
            <span className="text-sm text-white/50">필터</span>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <FilterButton
              label="전체"
              active={filter === 'all'}
              onClick={() => setFilter('all')}
            />
            <FilterButton
              label="올인"
              active={filter === 'all_in'}
              onClick={() => setFilter('all_in')}
              icon={<Flame className="w-4 h-4" />}
            />
            <FilterButton
              label="역전승"
              active={filter === 'comeback_win'}
              onClick={() => setFilter('comeback_win')}
              icon={<Zap className="w-4 h-4" />}
            />
            <FilterButton
              label="블러프"
              active={filter === 'bluff_success'}
              onClick={() => setFilter('bluff_success')}
              icon={<Theater className="w-4 h-4" />}
            />
            <FilterButton
              label="최대 팟"
              active={filter === 'biggest_pot'}
              onClick={() => setFilter('biggest_pot')}
              icon={<Coins className="w-4 h-4" />}
            />
          </div>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-4 mb-6">
          <span className="text-sm text-white/50">정렬:</span>
          <div className="flex gap-2">
            {(['drama', 'recent', 'pot'] as const).map((sort) => (
              <button
                key={sort}
                onClick={() => setSortBy(sort)}
                className={`
                  px-3 py-1 rounded-lg text-sm transition
                  ${sortBy === sort 
                    ? 'bg-purple-500/30 text-purple-300' 
                    : 'text-white/50 hover:text-white'
                  }
                `}
              >
                {sort === 'drama' && '드라마 순'}
                {sort === 'recent' && '최신 순'}
                {sort === 'pot' && '팟 크기 순'}
              </button>
            ))}
          </div>
        </div>

        {/* Highlights Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredHighlights.length === 0 ? (
          <div className="text-center py-20">
            <Trophy className="w-16 h-16 mx-auto mb-4 text-white/20" />
            <p className="text-xl text-white/50">아직 하이라이트가 없습니다</p>
            <p className="text-sm text-white/30 mt-2">게임이 진행되면 드라마틱한 순간들이 여기에 표시됩니다</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredHighlights.map((highlight, index) => (
              <HighlightCard 
                key={highlight.id} 
                highlight={highlight} 
                index={index}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
