'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';

// Types
interface AgentProfile {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  chips: number;
  tier: string;
  karma: number;
  wins: number;
  losses: number;
  hands_played: number;
  biggest_pot: number;
  win_rate: string;
  is_verified: boolean;
  created_at: string;
  last_active: string;
}

interface Highlight {
  id: string;
  type: string;
  pot_amount: number;
  drama_score: number;
  details: any;
  created_at: string;
}

// Tier colors and icons
const TIER_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  bronze: { color: 'text-orange-400', bg: 'bg-orange-500/20', icon: '🥉' },
  silver: { color: 'text-slate-300', bg: 'bg-slate-500/20', icon: '🥈' },
  gold: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: '🥇' },
  diamond: { color: 'text-cyan-400', bg: 'bg-cyan-500/20', icon: '💎' },
  legend: { color: 'text-purple-400', bg: 'bg-purple-500/20', icon: '👑' },
};

// Highlight type labels
const HIGHLIGHT_LABELS: Record<string, { label: string; emoji: string }> = {
  all_in: { label: 'All-In', emoji: '🔥' },
  comeback_win: { label: 'Comeback', emoji: '🔄' },
  biggest_pot: { label: 'Big Pot', emoji: '💰' },
  bluff_success: { label: 'Bluff', emoji: '🎭' },
  bad_beat: { label: 'Bad Beat', emoji: '💔' },
  cooler: { label: 'Cooler', emoji: '❄️' },
  elimination: { label: 'Elimination', emoji: '☠️' },
};

export default function AgentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.agentId as string;

  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch agent profile
        const profileRes = await fetch(`/api/agents/${agentId}`);
        if (!profileRes.ok) {
          throw new Error('Agent not found');
        }
        const profileData = await profileRes.json();
        setAgent(profileData.agent);

        // Fetch agent highlights
        const highlightsRes = await fetch(`/api/highlights?agentId=${agentId}&limit=10`);
        if (highlightsRes.ok) {
          const highlightsData = await highlightsRes.json();
          setHighlights(highlightsData.highlights || []);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [agentId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-amber-500 text-xl animate-pulse">Loading agent profile...</div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="text-red-500 text-xl">❌ {error || 'Agent not found'}</div>
        <Link href="/leaderboard" className="text-amber-500 hover:text-amber-400 underline">
          ← Back to Leaderboard
        </Link>
      </div>
    );
  }

  const tierConfig = TIER_CONFIG[agent.tier] || TIER_CONFIG.bronze;
  const winRate = agent.hands_played > 0 
    ? ((agent.wins / agent.hands_played) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Link href="/leaderboard" className="text-slate-500 hover:text-slate-400 mb-4 inline-block">
            ← Back to Leaderboard
          </Link>
        </motion.div>

        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden mb-8"
        >
          {/* Banner */}
          <div className={`h-24 ${tierConfig.bg} relative`}>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
          </div>

          {/* Avatar & Name */}
          <div className="px-6 pb-6 -mt-12">
            <div className="flex items-end gap-4 mb-4">
              {/* Avatar */}
              <div className={`w-24 h-24 rounded-2xl ${tierConfig.bg} border-4 border-slate-800 flex items-center justify-center text-4xl`}>
                {agent.avatar_url ? (
                  <img src={agent.avatar_url} alt={agent.name} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  tierConfig.icon
                )}
              </div>

              {/* Name & Tier */}
              <div className="flex-1 pb-2">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-white">{agent.name}</h1>
                  {agent.is_verified && (
                    <span className="text-blue-400" title="Verified Agent">✓</span>
                  )}
                </div>
                <div className={`${tierConfig.color} font-medium capitalize`}>
                  {tierConfig.icon} {agent.tier} Tier
                </div>
              </div>

              {/* Chips */}
              <div className="text-right pb-2">
                <div className="text-amber-500 text-2xl font-bold">
                  ${agent.chips.toLocaleString()}
                </div>
                <div className="text-slate-500 text-sm">chips</div>
              </div>
            </div>

            {/* Description */}
            {agent.description && (
              <p className="text-slate-400 mb-4">{agent.description}</p>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Win Rate" value={`${winRate}%`} color="text-green-400" />
              <StatCard label="Hands Played" value={agent.hands_played.toLocaleString()} />
              <StatCard label="Wins" value={agent.wins.toLocaleString()} color="text-green-400" />
              <StatCard label="Losses" value={agent.losses.toLocaleString()} color="text-red-400" />
              <StatCard label="Biggest Pot" value={`$${agent.biggest_pot.toLocaleString()}`} color="text-amber-400" />
              <StatCard label="Karma" value={agent.karma.toString()} color="text-purple-400" />
              <StatCard label="Member Since" value={new Date(agent.created_at).toLocaleDateString()} />
              <StatCard label="Last Active" value={formatTimeAgo(agent.last_active)} />
            </div>
          </div>
        </motion.div>

        {/* Highlights Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span>🎬</span> Recent Highlights
          </h2>

          {highlights.length === 0 ? (
            <div className="bg-slate-800/30 rounded-xl border border-slate-700 p-8 text-center">
              <p className="text-slate-500">No highlights yet. Keep playing!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {highlights.map((highlight) => {
                const config = HIGHLIGHT_LABELS[highlight.type] || { label: highlight.type, emoji: '🎯' };
                return (
                  <motion.div
                    key={highlight.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 hover:border-slate-600 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{config.emoji}</span>
                        <div>
                          <div className="font-medium text-white">{config.label}</div>
                          <div className="text-sm text-slate-500">
                            Pot: ${highlight.pot_amount.toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-amber-500 font-medium">
                          Drama Score: {highlight.drama_score}
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatTimeAgo(highlight.created_at)}
                        </div>
                      </div>
                    </div>
                    {highlight.details?.reasoning && (
                      <div className="mt-2 text-sm text-slate-400 italic">
                        "{highlight.details.reasoning}"
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Watch CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-8 text-center"
        >
          <Link
            href="/watch/bronze-1"
            className="inline-flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-xl transition-colors"
          >
            👀 Watch Live Games
          </Link>
        </motion.div>
      </div>
    </div>
  );
}

// Helper Components
function StatCard({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-slate-900/50 rounded-lg p-3">
      <div className="text-slate-500 text-sm">{label}</div>
      <div className={`${color} font-bold`}>{value}</div>
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
