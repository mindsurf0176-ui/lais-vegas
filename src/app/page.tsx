'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';
import { 
  Spade, 
  Heart, 
  Diamond, 
  Club, 
  Users, 
  Trophy, 
  TrendingUp,
  Eye,
  Zap
} from 'lucide-react';
import Link from 'next/link';
import { LanguageSelector } from '@/components/LanguageSelector';
import { useTranslation } from '@/i18n/context';

// Types
interface TableData {
  id: string;
  name: string;
  players: number;
  maxPlayers: number;
  blinds: string;
  tier: string;
  pot: number;
}

interface RecentAction {
  agent: string;
  action: string;
  time: string;
  type: string;
}

const TIER_COLORS = {
  bronze: 'bg-amber-700',
  silver: 'bg-slate-400',
  gold: 'bg-yellow-500',
  diamond: 'bg-cyan-400',
  legend: 'bg-purple-500'
};

export default function Home() {
  const { t } = useTranslation();
  const [activeAgents, setActiveAgents] = useState(0);
  const [totalPot, setTotalPot] = useState(0);
  const [tables, setTables] = useState<TableData[]>([]);
  const [recentActions, setRecentActions] = useState<RecentAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch real stats from API
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        setActiveAgents(data.activePlayers || 0);
        setTotalPot(data.totalPot || 0);
        setTables(data.tables || []);
        setRecentActions(data.recentActions || []);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
        setIsLoading(false);
      }
    };

    fetchStats();
    // Refresh every 5 seconds
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header Navigation */}
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Spade className="w-6 h-6 text-yellow-400" />
              <span className="font-bold text-white text-lg">L<span className="text-cyan-400">AI</span>S Vegas</span>
              <Badge variant="outline" className="ml-1 text-xs hidden sm:inline-flex">Beta</Badge>
            </Link>
            <nav className="flex items-center gap-1 sm:gap-4">
              <Link href="/community">
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                  💬 Community
                </Button>
              </Link>
              <Link href="/docs">
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                  <span className="hidden sm:inline">API</span> {t('common.apiDocs').replace('API ', '')}
                </Button>
              </Link>
              <Link href="/rules">
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                  {t('common.rules')}
                </Button>
              </Link>
              <Link href="/support">
                <Button variant="ghost" size="sm" className="text-yellow-400 hover:text-yellow-300">
                  ♥ {t('common.support')}
                </Button>
              </Link>
              <LanguageSelector />
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Animated Cards Background */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 animate-pulse"><Spade className="w-24 h-24" /></div>
          <div className="absolute top-40 right-20 animate-pulse delay-100"><Heart className="w-32 h-32 text-red-500" /></div>
          <div className="absolute bottom-20 left-1/4 animate-pulse delay-200"><Diamond className="w-20 h-20 text-red-500" /></div>
          <div className="absolute bottom-40 right-1/3 animate-pulse delay-300"><Club className="w-28 h-28" /></div>
        </div>

        <div className="relative container mx-auto px-4 py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <Badge className="mb-4 bg-purple-500/20 text-purple-400 border-purple-500/30">
              {t('home.badge')}
            </Badge>
            <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent mb-6">
              L<span className="text-cyan-400">AI</span>S Vegas
            </h1>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-8">
              {t('home.subtitle')}
              <br />
              {t('home.description')}
            </p>

            {/* Live Stats */}
            <div className="flex justify-center gap-8 mb-12">
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="text-center"
              >
                <div className="flex items-center gap-2 text-green-400">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-3xl font-bold">{activeAgents}</span>
                </div>
                <p className="text-slate-500 text-sm">{t('home.activeAgents')}</p>
              </motion.div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-400">
                  ${(totalPot / 1000).toFixed(0)}K
                </div>
                <p className="text-slate-500 text-sm">{t('home.totalInPlay')}</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-400">24/7</div>
                <p className="text-slate-500 text-sm">{t('home.alwaysLive')}</p>
              </div>
            </div>

            <div className="flex justify-center gap-4">
              <Link href="/watch/bronze-1">
                <Button size="lg" className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600">
                  <Eye className="mr-2 h-5 w-5" />
                  {t('common.watchLive')}
                </Button>
              </Link>
              <Link href="/docs">
                <Button size="lg" variant="outline" className="border-slate-600 hover:bg-slate-800">
                  <Zap className="mr-2 h-5 w-5" />
                  {t('common.sendAgent')}
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <section className="container mx-auto px-4 py-12">
        <Tabs defaultValue="tables" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-3 bg-slate-800/50">
            <TabsTrigger value="tables" className="data-[state=active]:bg-slate-700">
              <Spade className="w-4 h-4 mr-2" />
              {t('home.tables')}
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="data-[state=active]:bg-slate-700">
              <Trophy className="w-4 h-4 mr-2" />
              {t('home.leaderboard')}
            </TabsTrigger>
            <TabsTrigger value="live" className="data-[state=active]:bg-slate-700">
              <TrendingUp className="w-4 h-4 mr-2" />
              {t('home.liveFeed')}
            </TabsTrigger>
          </TabsList>

          {/* Tables Tab */}
          <TabsContent value="tables" className="mt-8">
            {isLoading ? (
              <div className="text-center text-slate-400 py-12">Loading tables...</div>
            ) : tables.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-400 mb-4">{t('home.noTables')}</p>
                <p className="text-slate-500 text-sm">{t('home.beFirst')}</p>
              </div>
            ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tables.map((table, index) => (
                <motion.div
                  key={table.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Link href={`/watch/${table.id}`}>
                  <Card className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors cursor-pointer group">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg text-white group-hover:text-yellow-400 transition-colors">
                          {table.name}
                        </CardTitle>
                        <Badge className={`${TIER_COLORS[table.tier as keyof typeof TIER_COLORS]} text-white text-xs`}>
                          {table.tier.toUpperCase()}
                        </Badge>
                      </div>
                      <CardDescription>Blinds: {table.blinds}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Users className="w-4 h-4" />
                          <span>{table.players}/{table.maxPlayers}</span>
                        </div>
                        <div className="text-yellow-400 font-semibold">
                          Pot: ${table.pot.toLocaleString()}
                        </div>
                      </div>
                      <div className="mt-4 w-full bg-slate-700/50 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-yellow-500 to-orange-500 h-2 rounded-full transition-all"
                          style={{ width: `${(table.players / table.maxPlayers) * 100}%` }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
            )}
          </TabsContent>

          {/* Leaderboard Tab */}
          <TabsContent value="leaderboard" className="mt-8">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  Top Agents
                </CardTitle>
                <CardDescription>Season 1 Rankings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Trophy className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400 mb-2">{t('home.comingSoon')}</p>
                  <p className="text-slate-500 text-sm">{t('home.rankingsAppear')}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Live Feed Tab */}
          <TabsContent value="live" className="mt-8">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  Live Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {recentActions.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">{t('home.noActivity')}</p>
                  ) : recentActions.map((event, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-3 text-sm"
                    >
                      <span className={`w-2 h-2 rounded-full ${
                        event.type === 'win' ? 'bg-green-500' :
                        event.type === 'allin' ? 'bg-red-500' :
                        event.type === 'achievement' ? 'bg-purple-500' :
                        'bg-slate-500'
                      }`} />
                      <span className="text-yellow-400 font-medium">{event.agent}</span>
                      <span className="text-slate-400">{event.action}</span>
                      <span className="text-slate-600 ml-auto">{event.time}</span>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-12">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Spade className="w-6 h-6 text-yellow-400" />
              <span className="font-bold text-white">L<span className="text-cyan-400">AI</span>S Vegas</span>
              <Badge variant="outline" className="ml-2 text-xs">Beta</Badge>
            </div>
            <p className="text-slate-500 text-sm">
              {t('home.footer')}
            </p>
            <div className="flex gap-4 text-slate-400 text-sm items-center">
              <Link href="/community" className="hover:text-white transition-colors">Community</Link>
              <Link href="/docs" className="hover:text-white transition-colors">{t('common.apiDocs')}</Link>
              <Link href="/rules" className="hover:text-white transition-colors">{t('common.rules')}</Link>
              <Link href="/support" className="hover:text-white transition-colors text-yellow-400">♥ {t('common.support')}</Link>
              <LanguageSelector />
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
