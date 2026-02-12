'use client';

import { useState, useEffect, use, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Eye, 
  MessageCircle, 
  TrendingUp, 
  Volume2,
  VolumeX,
  Spade,
  Heart,
  Diamond,
  Club,
  ArrowLeft,
  Flame,
  Zap
} from 'lucide-react';
import Link from 'next/link';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { useTranslation } from '@/i18n/context';

// ========================================
// Sound Effects - Casino Style 🎰
// ========================================
const useSounds = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  
  const getContext = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);
  
  const playChipSound = useCallback(() => {
    const ctx = getContext();
    // Multiple chips falling - layered sound
    [0, 0.05, 0.1].forEach((delay, i) => {
      setTimeout(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        
        filter.type = 'highpass';
        filter.frequency.value = 2000 + Math.random() * 1000;
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        
        osc.frequency.value = 3000 + Math.random() * 2000;
        osc.type = 'square';
        gain.gain.value = 0.03;
        
        osc.start(ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.stop(ctx.currentTime + 0.08);
      }, delay * 1000);
    });
  }, [getContext]);
  
  const playCardSound = useCallback(() => {
    const ctx = getContext();
    // Card swoosh
    const noise = ctx.createBufferSource();
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    noise.buffer = noiseBuffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1500;
    filter.Q.value = 0.5;
    
    const gain = ctx.createGain();
    gain.gain.value = 0.08;
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    noise.start();
  }, [getContext]);
  
  const playWinSound = useCallback(() => {
    const ctx = getContext();
    // Victory fanfare - ascending notes
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      setTimeout(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.value = 0.1;
        
        osc.start(ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.stop(ctx.currentTime + 0.3);
      }, i * 100);
    });
  }, [getContext]);
  
  const playAllinSound = useCallback(() => {
    const ctx = getContext();
    // Dramatic tension - low rumble + high accent
    const bass = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bass.connect(bassGain);
    bassGain.connect(ctx.destination);
    bass.frequency.value = 80;
    bass.type = 'sawtooth';
    bassGain.gain.value = 0.15;
    bass.start(ctx.currentTime);
    bassGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    bass.stop(ctx.currentTime + 0.5);
    
    // High accent
    setTimeout(() => {
      const high = ctx.createOscillator();
      const highGain = ctx.createGain();
      high.connect(highGain);
      highGain.connect(ctx.destination);
      high.frequency.value = 880;
      high.type = 'triangle';
      highGain.gain.value = 0.08;
      high.start(ctx.currentTime);
      highGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      high.stop(ctx.currentTime + 0.2);
    }, 100);
  }, [getContext]);
  
  const playFoldSound = useCallback(() => {
    const ctx = getContext();
    // Soft thud
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.frequency.value = 150;
    osc.type = 'sine';
    gain.gain.value = 0.06;
    
    osc.start(ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.stop(ctx.currentTime + 0.15);
  }, [getContext]);
  
  const playSound = useCallback((type: 'chip' | 'card' | 'win' | 'allin' | 'fold') => {
    switch (type) {
      case 'chip': playChipSound(); break;
      case 'card': playCardSound(); break;
      case 'win': playWinSound(); break;
      case 'allin': playAllinSound(); break;
      case 'fold': playFoldSound(); break;
    }
  }, [playChipSound, playCardSound, playWinSound, playAllinSound, playFoldSound]);
  
  return { playSound };
};

// ========================================
// Card Components
// ========================================
const SuitIcon = ({ suit, className = '' }: { suit: string; className?: string }) => {
  const baseClass = `${className} ${suit === 'hearts' || suit === 'diamonds' ? 'text-red-500' : 'text-slate-900'}`;
  switch (suit) {
    case 'hearts': return <Heart className={baseClass} fill="currentColor" />;
    case 'diamonds': return <Diamond className={baseClass} fill="currentColor" />;
    case 'clubs': return <Club className={baseClass} fill="currentColor" />;
    case 'spades': return <Spade className={baseClass} fill="currentColor" />;
    default: return null;
  }
};

const PlayingCard = ({ 
  card, 
  hidden = false,
  revealed = false,
  size = 'normal'
}: { 
  card?: { suit: string; rank: string }; 
  hidden?: boolean;
  revealed?: boolean;
  size?: 'small' | 'normal' | 'large';
}) => {
  const sizeClasses = {
    small: 'w-10 h-14',
    normal: 'w-14 h-20',
    large: 'w-20 h-28'
  };
  
  if (hidden || !card) {
    return (
      <motion.div 
        className={`${sizeClasses[size]} bg-gradient-to-br from-blue-800 to-blue-900 rounded-lg border-2 border-blue-700 flex items-center justify-center shadow-lg`}
        animate={revealed ? { rotateY: [0, 90] } : {}}
      >
        <div className="w-8 h-8 rounded-full bg-blue-700/50" />
      </motion.div>
    );
  }
  
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  
  return (
    <motion.div 
      className={`${sizeClasses[size]} bg-white rounded-lg border-2 border-slate-200 flex flex-col items-center justify-center gap-1 shadow-lg ${isRed ? 'text-red-500' : 'text-slate-900'}`}
      initial={revealed ? { rotateY: 90 } : {}}
      animate={{ rotateY: 0 }}
      transition={{ duration: 0.3 }}
    >
      <span className={`font-bold ${size === 'large' ? 'text-2xl' : size === 'small' ? 'text-sm' : 'text-lg'}`}>
        {card.rank}
      </span>
      <SuitIcon suit={card.suit} className={size === 'large' ? 'w-6 h-6' : 'w-4 h-4'} />
    </motion.div>
  );
};

// ========================================
// Player Seat Component
// ========================================
const PlayerSeat = ({ 
  player, 
  position, 
  isActive,
  isShowdown,
  lastAction
}: { 
  player?: any; 
  position: React.CSSProperties;
  isActive: boolean;
  isShowdown: boolean;
  lastAction?: { action: string; amount?: number };
}) => {
  if (!player) {
    return (
      <div 
        className="absolute w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-full border-2 border-dashed border-slate-700/30 flex items-center justify-center text-slate-600 text-[10px] sm:text-xs"
        style={position}
      >
        
      </div>
    );
  }
  
  const isFolded = player.isFolded || player.is_folded;
  
  return (
    <motion.div 
      className={`absolute flex flex-col items-center gap-0.5 sm:gap-1 ${isActive ? 'z-10' : ''} ${isFolded ? 'opacity-40' : ''}`}
      style={position}
      animate={isActive ? { scale: 1.05 } : { scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      {/* Player Cards - Hidden on very small screens, shown on sm+ */}
      <div className="hidden sm:flex gap-0.5">
        {player.cards && player.cards.length > 0 && isShowdown ? (
          player.cards.map((card: any, i: number) => (
            <PlayingCard key={i} card={card} size="small" revealed />
          ))
        ) : (
          <>
            <PlayingCard hidden size="small" />
            <PlayingCard hidden size="small" />
          </>
        )}
      </div>
      
      {/* Last Action Badge */}
      <AnimatePresence>
        {lastAction && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`absolute -top-4 sm:-top-6 px-1 sm:px-2 py-0.5 rounded text-[9px] sm:text-xs font-bold whitespace-nowrap ${
              lastAction.action === 'fold' ? 'bg-red-500/90 text-white' :
              lastAction.action === 'all-in' ? 'bg-purple-500 text-white animate-pulse' :
              lastAction.action === 'raise' ? 'bg-green-500 text-white' :
              'bg-slate-600 text-white'
            }`}
          >
            {lastAction.action.toUpperCase()}
            {lastAction.amount ? ` $${lastAction.amount}` : ''}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Avatar & Info - Compact on mobile */}
      <div className={`flex flex-col items-center p-1 sm:p-2 rounded-lg transition-all ${
        isActive 
          ? 'bg-yellow-500/30 ring-2 ring-yellow-500 shadow-lg shadow-yellow-500/20' 
          : 'bg-slate-800/90'
      }`}>
        <Avatar className="w-6 h-6 sm:w-8 sm:h-8 border sm:border-2 border-slate-600">
          <AvatarFallback className="text-[10px] sm:text-xs bg-slate-700">
            {player.name?.[0] || '?'}
          </AvatarFallback>
        </Avatar>
        <span className="text-[9px] sm:text-xs font-medium text-white mt-0.5 max-w-[50px] sm:max-w-[80px] truncate">
          {player.name}
        </span>
        <span className="text-[9px] sm:text-xs text-yellow-400 font-mono">
          ${(player.chips >= 1000 ? `${(player.chips/1000).toFixed(0)}K` : player.chips?.toLocaleString())}
        </span>
        {player.bet > 0 && (
          <Badge variant="outline" className="mt-0.5 text-[8px] sm:text-[10px] px-1 py-0 h-4">
            ${player.bet}
          </Badge>
        )}
        {player.isAllIn && (
          <Badge className="mt-0.5 bg-purple-500 text-[8px] sm:text-[10px] px-1 py-0 h-4 animate-pulse">
            ALL-IN
          </Badge>
        )}
      </div>
    </motion.div>
  );
};

// Seat positions (9 seats around oval table)
// Responsive: uses CSS clamp() for mobile vs desktop
const SEAT_POSITIONS: React.CSSProperties[] = [
  { bottom: '2%', left: '50%', transform: 'translateX(-50%)' },    // seat 1: bottom center
  { bottom: '12%', left: '15%' },                                    // seat 2: bottom left
  { top: '45%', left: '2%' },                                        // seat 3: left middle
  { top: '12%', left: '12%' },                                       // seat 4: top left
  { top: '2%', left: '50%', transform: 'translateX(-50%)' },        // seat 5: top center
  { top: '12%', right: '12%' },                                      // seat 6: top right
  { top: '45%', right: '2%' },                                       // seat 7: right middle
  { bottom: '12%', right: '15%' },                                   // seat 8: bottom right
  { bottom: '25%', right: '5%' },                                    // seat 9: bottom right side
];

// ========================================
// Highlight Overlay Component
// ========================================
const HighlightOverlay = ({ 
  type, 
  message, 
  onClose 
}: { 
  type: 'allin' | 'bigwin' | 'showdown';
  message: string;
  onClose: () => void;
}) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);
  
  const colors = {
    allin: 'from-purple-600 to-pink-600',
    bigwin: 'from-yellow-500 to-orange-500',
    showdown: 'from-red-600 to-orange-600'
  };
  
  const icons = {
    allin: '🔥',
    bigwin: '💰',
    showdown: '⚔️'
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
    >
      <div className={`bg-gradient-to-r ${colors[type]} p-6 sm:p-8 rounded-2xl shadow-2xl text-center max-w-sm mx-4`}>
        <div className="text-4xl sm:text-6xl mb-2">{icons[type]}</div>
        <div className="text-white text-xl sm:text-2xl font-bold">{message}</div>
      </div>
    </motion.div>
  );
};

// ========================================
// Main Component
// ========================================
export default function WatchTable({ params }: { params: Promise<{ tableId: string }> }) {
  const { tableId } = use(params);
  const { t } = useTranslation();
  const [connected, setConnected] = useState(false);
  const [tableData, setTableData] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [spectators, setSpectators] = useState(0);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastActions, setLastActions] = useState<Record<string, any>>({});
  const [highlight, setHighlight] = useState<{ type: 'allin' | 'bigwin' | 'showdown'; message: string } | null>(null);
  const [spectatorMessages, setSpectatorMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [nickname, setNickname] = useState(() => `Spectator_${Math.random().toString(36).slice(2, 6)}`);
  const socketRef = useRef<any>(null);
  const { playSound } = useSounds();
  
  // Connect to socket
  useEffect(() => {
    const socket = connectSocket();
    socketRef.current = socket;
    
    socket.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
      socket.emit('spectate:join', { tableId });
    });
    
    socket.on('disconnect', () => {
      console.log('Disconnected');
      setConnected(false);
    });
    
    socket.on('table:state', (state: any) => {
      console.log('Table state:', state);
      setTableData(state);
      setSpectators(state.spectatorCount || 0);
      setLoading(false);
    });
    
    socket.on('hand:start', (data: any) => {
      console.log('Hand started:', data);
      setTableData((prev: any) => ({
        ...prev,
        ...data,
        phase: 'preflop'
      }));
      if (soundEnabled) playSound('card');
    });
    
    socket.on('action', (data: any) => {
      console.log('Action:', data);
      
      // Play sound
      if (soundEnabled) {
        if (data.action === 'all-in') playSound('allin');
        else if (data.action === 'fold') playSound('fold');
        else playSound('chip');
      }
      
      // Show highlight for all-in
      if (data.action === 'all-in') {
        setHighlight({
          type: 'allin',
          message: `${data.agentId} goes ALL-IN!`
        });
      }
      
      // Update last action for player
      setLastActions(prev => ({
        ...prev,
        [data.agentId]: { action: data.action, amount: data.amount }
      }));
      
      // Clear after 2 seconds
      setTimeout(() => {
        setLastActions(prev => {
          const next = { ...prev };
          delete next[data.agentId];
          return next;
        });
      }, 2000);
      
      // Add to action log
      setActions(prev => [
        { ...data, time: new Date() },
        ...prev.slice(0, 19)
      ]);
    });
    
    socket.on('phase:change', (data: any) => {
      console.log('Phase:', data);
      setTableData((prev: any) => ({
        ...prev,
        phase: data.phase,
        communityCards: data.communityCards,
        pot: data.pot
      }));
      if (soundEnabled) playSound('card');
      
      // Show highlight for showdown
      if (data.phase === 'showdown') {
        setHighlight({
          type: 'showdown',
          message: 'SHOWDOWN!'
        });
      }
    });
    
    socket.on('hand:end', (data: any) => {
      console.log('Hand ended:', data);
      if (soundEnabled) playSound('win');
      
      // Update stats if provided
      if (data.stats) {
        setTableData((prev: any) => ({
          ...prev,
          stats: data.stats,
        }));
      }
      
      // Show highlight for big wins
      if (data.pot >= 5000) {
        setHighlight({
          type: 'bigwin',
          message: `${data.winners?.[0]?.agentId || 'Winner'} wins $${data.pot.toLocaleString()}!`
        });
      }
      
      setActions(prev => [
        { 
          agentId: data.winners?.[0]?.agentId || 'Unknown',
          action: 'wins',
          amount: data.pot,
          handName: data.winners?.[0]?.reason,
          time: new Date()
        },
        ...prev.slice(0, 19)
      ]);
    });
    
    socket.on('chat', (data: any) => {
      setMessages(prev => [...prev, data].slice(-50));
    });
    
    socket.on('spectator:chat', (data: any) => {
      setSpectatorMessages(prev => [...prev, data].slice(-50));
    });
    
    socket.on('player:joined', (data: any) => {
      setTableData((prev: any) => {
        if (!prev) return prev;
        const players = [...(prev.players || [])];
        players.push(data);
        return { ...prev, players };
      });
    });
    
    socket.on('player:left', (data: any) => {
      setTableData((prev: any) => {
        if (!prev) return prev;
        const players = (prev.players || []).filter((p: any) => p.agentId !== data.agentId);
        return { ...prev, players };
      });
    });
    
    socket.on('spectator:count', (count: number) => {
      setSpectators(count);
    });
    
    socket.on('error', (err: any) => {
      console.error('Socket error:', err);
    });
    
    return () => {
      socket.emit('spectate:leave', { tableId });
      disconnectSocket();
    };
  }, [tableId, soundEnabled, playSound]);
  
  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">
            {connected ? t('watch.loadingTable') : t('watch.connecting')}
          </p>
        </div>
      </div>
    );
  }
  
  // No data
  if (!tableData) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">{t('watch.tableNotFound')}</p>
          <Link href="/">
            <Button variant="outline">{t('watch.backToLobby')}</Button>
          </Link>
        </div>
      </div>
    );
  }
  
  const isShowdown = tableData.phase === 'showdown';
  const players = tableData.players || [];
  const communityCards = tableData.communityCards || tableData.community_cards || [];
  const pot = tableData.pot || 0;
  const phase = tableData.phase || 'waiting';
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900">
      {/* Highlight Overlay */}
      <AnimatePresence>
        {highlight && (
          <HighlightOverlay
            type={highlight.type}
            message={highlight.message}
            onClose={() => setHighlight(null)}
          />
        )}
      </AnimatePresence>
      
      {/* Header - Responsive */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white px-2 sm:px-3">
                <ArrowLeft className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">{t('watch.lobby')}</span>
              </Button>
            </Link>
            <div>
              <h1 className="text-sm sm:text-lg font-bold text-white flex items-center gap-1 sm:gap-2">
                <span className="max-w-[120px] sm:max-w-none truncate">
                  {tableData.name || `Table ${tableId}`}
                </span>
                {isShowdown && (
                  <Badge className="bg-orange-500 animate-pulse text-[10px] sm:text-xs px-1 sm:px-2">
                    <Flame className="w-3 h-3 sm:mr-1" />
                    <span className="hidden sm:inline">{t('watch.showdown')}</span>
                  </Badge>
                )}
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-400">
                Blinds: {tableData.blinds || '10/20'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="text-slate-400 p-1 sm:p-2"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
            <div className="flex items-center gap-1 text-slate-400 text-xs sm:text-sm">
              <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>{spectators}</span>
            </div>
            <Badge className={`text-[10px] sm:text-xs px-1.5 sm:px-2 ${connected 
              ? "bg-green-500/20 text-green-400 border-green-500/30"
              : "bg-red-500/20 text-red-400 border-red-500/30"
            }`}>
              <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full mr-1 sm:mr-2 ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="hidden sm:inline">{connected ? 'LIVE' : 'OFFLINE'}</span>
              <span className="sm:hidden">●</span>
            </Badge>
          </div>
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Main Table */}
          <div className="lg:col-span-3">
            <Card className="bg-slate-800/50 border-slate-700 overflow-hidden">
              <CardContent className="p-0">
                {/* Poker Table - Responsive */}
                <div className="relative h-[380px] sm:h-[450px] lg:h-[550px] bg-gradient-to-b from-green-900 to-green-800 rounded-[50px] sm:rounded-[70px] lg:rounded-[100px] m-2 sm:m-4 lg:m-6 border-4 sm:border-6 lg:border-8 border-amber-900/80 shadow-2xl overflow-hidden">
                  {/* Table felt pattern */}
                  <div className="absolute inset-4 border-2 border-green-700/30 rounded-[60px] lg:rounded-[80px]" />
                  
                  {/* Center - Pot & Community Cards */}
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                    {/* Pot */}
                    <motion.div 
                      className="bg-slate-900/90 px-6 py-3 rounded-xl shadow-lg mb-4"
                      animate={{ scale: pot > 10000 ? [1, 1.02, 1] : 1 }}
                      transition={{ repeat: pot > 10000 ? Infinity : 0, duration: 1 }}
                    >
                      <p className="text-xs text-slate-400 uppercase tracking-wide">{t('watch.pot')}</p>
                      <p className={`text-2xl font-bold ${pot > 50000 ? 'text-orange-400' : 'text-yellow-400'}`}>
                        ${pot.toLocaleString()}
                      </p>
                    </motion.div>
                    
                    {/* Community Cards */}
                    <div className="flex gap-2 justify-center mb-3">
                      {communityCards.map((card: any, i: number) => (
                        <motion.div
                          key={i}
                          initial={{ rotateY: 180, opacity: 0 }}
                          animate={{ rotateY: 0, opacity: 1 }}
                          transition={{ delay: i * 0.15, duration: 0.4 }}
                        >
                          <PlayingCard card={card} size="normal" />
                        </motion.div>
                      ))}
                      {/* Placeholder slots */}
                      {[...Array(Math.max(0, 5 - communityCards.length))].map((_, i) => (
                        <div 
                          key={`empty-${i}`} 
                          className="w-14 h-20 border-2 border-dashed border-green-700/40 rounded-lg"
                        />
                      ))}
                    </div>
                    
                    {/* Phase */}
                    <Badge className={`${
                      phase === 'showdown' ? 'bg-orange-500' :
                      phase === 'river' ? 'bg-blue-500' :
                      'bg-slate-700'
                    } text-white uppercase text-xs`}>
                      {phase === 'preflop' ? t('watch.preflop') :
                       phase === 'flop' ? t('watch.flop') :
                       phase === 'turn' ? t('watch.turn') :
                       phase === 'river' ? t('watch.river') :
                       phase === 'showdown' ? t('watch.showdownPhase') :
                       t('watch.waiting')}
                    </Badge>
                  </div>
                  
                  {/* Player Seats */}
                  {SEAT_POSITIONS.map((pos, index) => {
                    const player = players.find((p: any) => p.seat === index + 1);
                    const isActive = player && tableData.activePlayer === player.agentId;
                    return (
                      <PlayerSeat 
                        key={index}
                        player={player}
                        position={pos}
                        isActive={isActive}
                        isShowdown={isShowdown}
                        lastAction={player ? lastActions[player.agentId] : undefined}
                      />
                    );
                  })}
                </div>
              </CardContent>
            </Card>
            
            {/* Action Log */}
            <Card className="bg-slate-800/50 border-slate-700 mt-4">
              <CardHeader className="py-2 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  {t('watch.liveActions')}
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2 px-4 max-h-32 overflow-y-auto">
                <AnimatePresence>
                  {actions.length === 0 ? (
                    <p className="text-slate-500 text-sm">{t('watch.waitingForAction')}</p>
                  ) : (
                    <div className="space-y-1">
                      {actions.slice(0, 5).map((action, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span className={`w-2 h-2 rounded-full ${
                            action.action === 'wins' ? 'bg-yellow-500' :
                            action.action === 'all-in' ? 'bg-purple-500' :
                            action.action === 'raise' ? 'bg-green-500' :
                            action.action === 'fold' ? 'bg-red-500' :
                            'bg-slate-500'
                          }`} />
                          <span className="text-yellow-400 font-medium">{action.agentId}</span>
                          <span className="text-slate-400">{action.action}</span>
                          {action.amount && (
                            <span className="text-green-400">${action.amount.toLocaleString()}</span>
                          )}
                          {action.handName && (
                            <span className="text-orange-400">with {action.handName}</span>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>
          
          {/* Sidebar */}
          <div className="space-y-4">
            {/* Table Info */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="py-2 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  {t('watch.sessionStats')}
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2 px-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('watch.players')}</span>
                  <span className="text-white">{players.length}/9</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('watch.avgStack')}</span>
                  <span className="text-white">
                    ${players.length > 0 
                      ? Math.round(players.reduce((a: number, p: any) => a + (p.chips || 0), 0) / players.length).toLocaleString()
                      : 0
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('watch.totalHands')}</span>
                  <span className="text-white">{tableData.stats?.totalHands || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('watch.biggestPot')}</span>
                  <span className="text-yellow-400 font-medium">
                    ${(tableData.stats?.biggestPot || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('watch.allIns')}</span>
                  <span className="text-purple-400 font-medium">
                    {tableData.stats?.totalAllIns || 0}
                  </span>
                </div>
                {tableData.stats?.uptime && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t('watch.uptime')}</span>
                    <span className="text-slate-300 font-mono text-xs">
                      {Math.floor((tableData.stats.uptime) / 3600)}h {Math.floor(((tableData.stats.uptime) % 3600) / 60)}m
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Spectator Chat */}
            <Card className="bg-slate-800/50 border-slate-700 flex flex-col h-[300px]">
              <CardHeader className="py-2 px-4 border-b border-slate-700">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  {t('watch.spectatorChat')}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto py-2 px-4 space-y-2">
                {spectatorMessages.length === 0 ? (
                  <p className="text-slate-500 text-sm">{t('watch.beFirstToChat')}</p>
                ) : (
                  <AnimatePresence>
                    {spectatorMessages.slice(-20).map((msg, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-sm"
                      >
                        <span className="text-cyan-400 font-medium">{msg.nickname}:</span>
                        <span className="text-slate-300 ml-2">{msg.message}</span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </CardContent>
              <div className="p-2 border-t border-slate-700">
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (chatInput.trim() && socketRef.current) {
                      socketRef.current.emit('spectate:chat', {
                        tableId,
                        message: chatInput.trim(),
                        nickname
                      });
                      setChatInput('');
                    }
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={t('watch.saySomething')}
                    maxLength={300}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                  />
                  <Button type="submit" size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-black">
                    {t('watch.send')}
                  </Button>
                </form>
              </div>
            </Card>
            
            {/* Players List */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="py-2 px-4">
                <CardTitle className="text-sm">{t('watch.players')}</CardTitle>
              </CardHeader>
              <CardContent className="py-2 px-4 space-y-2">
                {players.length === 0 ? (
                  <p className="text-slate-500 text-sm">{t('watch.waitingForPlayers')}</p>
                ) : (
                  players.map((player: any, i: number) => (
                    <div 
                      key={i}
                      className={`flex items-center justify-between p-2 rounded ${
                        tableData.activePlayer === player.agentId 
                          ? 'bg-yellow-500/20' 
                          : 'bg-slate-900/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          <AvatarFallback className="text-[10px] bg-slate-700">
                            {player.name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-white truncate max-w-[100px]">
                          {player.name}
                        </span>
                      </div>
                      <span className="text-sm text-yellow-400 font-mono">
                        ${player.chips?.toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
