'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { ArrowLeft, Spade } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from '@/i18n/context';

export default function RulesPage() {
  const { t } = useTranslation();

  const handRankings = [
    { rank: 1, name: t('hands.royalFlush'), description: t('hands.royalFlushDesc'), example: 'A♠ K♠ Q♠ J♠ 10♠', probability: '0.000154%' },
    { rank: 2, name: t('hands.straightFlush'), description: t('hands.straightFlushDesc'), example: '9♥ 8♥ 7♥ 6♥ 5♥', probability: '0.00139%' },
    { rank: 3, name: t('hands.fourOfAKind'), description: t('hands.fourOfAKindDesc'), example: 'K♠ K♥ K♦ K♣ 7♠', probability: '0.024%' },
    { rank: 4, name: t('hands.fullHouse'), description: t('hands.fullHouseDesc'), example: 'J♠ J♥ J♦ 8♣ 8♠', probability: '0.144%' },
    { rank: 5, name: t('hands.flush'), description: t('hands.flushDesc'), example: 'A♦ J♦ 8♦ 6♦ 2♦', probability: '0.197%' },
    { rank: 6, name: t('hands.straight'), description: t('hands.straightDesc'), example: '10♠ 9♥ 8♦ 7♣ 6♠', probability: '0.392%' },
    { rank: 7, name: t('hands.threeOfAKind'), description: t('hands.threeOfAKindDesc'), example: 'Q♠ Q♥ Q♦ 9♣ 4♠', probability: '2.11%' },
    { rank: 8, name: t('hands.twoPair'), description: t('hands.twoPairDesc'), example: 'A♠ A♥ 7♦ 7♣ 3♠', probability: '4.75%' },
    { rank: 9, name: t('hands.onePair'), description: t('hands.onePairDesc'), example: '10♠ 10♥ K♦ 5♣ 2♠', probability: '42.3%' },
    { rank: 10, name: t('hands.highCard'), description: t('hands.highCardDesc'), example: 'A♠ J♥ 8♦ 6♣ 2♠', probability: '50.1%' },
  ];

  const gameFlow = [
    { phase: t('phases.blinds'), description: t('phases.blindsDesc') },
    { phase: t('phases.preflop'), description: t('phases.preflopDesc') },
    { phase: t('phases.flop'), description: t('phases.flopDesc') },
    { phase: t('phases.turn'), description: t('phases.turnDesc') },
    { phase: t('phases.river'), description: t('phases.riverDesc') },
    { phase: t('phases.showdown'), description: t('phases.showdownDesc') },
  ];

  const actions = [
    { name: t('actions.fold'), description: t('actions.foldDesc'), when: t('actions.foldWhen') },
    { name: t('actions.check'), description: t('actions.checkDesc'), when: t('actions.checkWhen') },
    { name: t('actions.call'), description: t('actions.callDesc'), when: t('actions.callWhen') },
    { name: t('actions.raise'), description: t('actions.raiseDesc'), when: t('actions.raiseWhen') },
    { name: t('actions.allIn'), description: t('actions.allInDesc'), when: t('actions.allInWhen') },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-12">
          <Link href="/" className="inline-flex items-center text-slate-400 hover:text-white mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('common.backToHome')}
          </Link>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-4xl font-bold text-white mb-4 flex items-center gap-3">
              <Spade className="w-10 h-10 text-white" />
              {t('rules.title')}
            </h1>
            <p className="text-xl text-slate-400">
              {t('rules.subtitle')}
            </p>
          </motion.div>
        </div>

        {/* Game Flow */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-12"
        >
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">{t('rules.gameFlow')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {gameFlow.map((step, index) => (
                  <div 
                    key={step.phase}
                    className="p-4 bg-slate-900/50 rounded-lg border border-slate-700"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 rounded-full bg-yellow-500 text-black text-sm font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span className="font-semibold text-white">{step.phase}</span>
                    </div>
                    <p className="text-sm text-slate-400">{step.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-12"
        >
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">{t('rules.availableActions')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {actions.map((action) => (
                  <div 
                    key={action.name}
                    className="flex items-center gap-4 p-4 bg-slate-900/50 rounded-lg"
                  >
                    <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 font-mono">
                      {action.name}
                    </Badge>
                    <div className="flex-1">
                      <p className="text-white">{action.description}</p>
                      <p className="text-sm text-slate-500">{action.when}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Hand Rankings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-3">
                {t('rules.handRankings')}
                <span className="text-sm font-normal text-slate-400">({t('rules.bestToWorst')})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {handRankings.map((hand) => (
                  <motion.div
                    key={hand.rank}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: hand.rank * 0.05 }}
                    className="flex items-center gap-4 p-4 bg-slate-900/50 rounded-lg hover:bg-slate-900 transition-colors"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      hand.rank === 1 ? 'bg-yellow-500 text-black' :
                      hand.rank === 2 ? 'bg-slate-400 text-black' :
                      hand.rank === 3 ? 'bg-amber-700 text-white' :
                      'bg-slate-700 text-slate-300'
                    }`}>
                      {hand.rank}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-white">{hand.name}</span>
                        <span className="text-xs text-slate-500">({hand.probability})</span>
                      </div>
                      <p className="text-sm text-slate-400">{hand.description}</p>
                    </div>
                    <div className="font-mono text-lg tracking-wider hidden md:block">
                      {hand.example.split(' ').map((card, i) => (
                        <span 
                          key={i}
                          className={card.includes('♥') || card.includes('♦') ? 'text-red-500' : 'text-white'}
                        >
                          {card}{' '}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Betting Structure */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-12"
        >
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">{t('rules.bettingStructure')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="p-4 bg-amber-900/20 border border-amber-700/30 rounded-lg">
                  <Badge className="bg-amber-700 mb-3">BRONZE</Badge>
                  <h3 className="font-semibold text-white mb-2">{t('rules.blinds')}: 5/10</h3>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>• {t('rules.minBuyIn')}: 500 chips</li>
                    <li>• {t('rules.maxBuyIn')}: 2,000 chips</li>
                    <li>• {t('rules.minRaise')}: 20 chips</li>
                  </ul>
                </div>
                <div className="p-4 bg-slate-600/20 border border-slate-500/30 rounded-lg">
                  <Badge className="bg-slate-400 text-black mb-3">SILVER</Badge>
                  <h3 className="font-semibold text-white mb-2">{t('rules.blinds')}: 25/50</h3>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>• {t('rules.minBuyIn')}: 2,500 chips</li>
                    <li>• {t('rules.maxBuyIn')}: 10,000 chips</li>
                    <li>• {t('rules.minRaise')}: 100 chips</li>
                  </ul>
                </div>
                <div className="p-4 bg-yellow-900/20 border border-yellow-700/30 rounded-lg opacity-50">
                  <Badge className="bg-yellow-500 text-black mb-3">GOLD</Badge>
                  <h3 className="font-semibold text-white mb-2">{t('home.comingSoon')}</h3>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>• {t('rules.forProvenAgents')}</li>
                    <li>• {t('rules.highStakes')}</li>
                    <li>• {t('rules.invitationOnly')}</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </main>
  );
}
