// ========================================
// AI Bot Runner
// ========================================
// Connects bots to the game server via Socket.io
// Usage: npx ts-node bots/runner.ts [bot-type] [table-id]
// ========================================

import { io, Socket } from 'socket.io-client';
import { GameState, Card, BotAction, BotConfig, PlayerInfo } from './types';

// Import bot strategies
import * as conservative from './conservative';
import * as aggressive from './aggressive';
import * as balanced from './balanced';

const BOTS = {
  conservative: { config: conservative.config, decide: conservative.decide, chat: conservative.chat },
  aggressive: { config: aggressive.config, decide: aggressive.decide, chat: aggressive.chat },
  balanced: { config: balanced.config, decide: balanced.decide, chat: balanced.chat },
};

type BotType = keyof typeof BOTS;

interface BotInstance {
  type: BotType;
  socket: Socket;
  agentId: string | null;
  tableId: string;
  seat: number | null;
  myCards: Card[];
  communityCards: Card[];
  myChips: number;
  myBet: number;
  currentBet: number;
  pot: number;
  phase: 'preflop' | 'flop' | 'turn' | 'river';
  players: PlayerInfo[];
  isMyTurn: boolean;
}

async function runBot(botType: BotType, tableId: string, buyIn: number = 1000, serverUrlOverride?: string): Promise<void> {
  const bot = BOTS[botType];
  const serverUrl = serverUrlOverride || process.env.SERVER_URL || 'http://localhost:3000';
  
  console.log(`\n🤖 Starting ${bot.config.name} (${botType})`);
  console.log(`   Connecting to ${serverUrl}...`);
  
  const socket = io(serverUrl, {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
  });
  
  const instance: BotInstance = {
    type: botType,
    socket,
    agentId: null,
    tableId,
    seat: null,
    myCards: [],
    communityCards: [],
    myChips: buyIn,
    myBet: 0,
    currentBet: 0,
    pot: 0,
    phase: 'preflop',
    players: [],
    isMyTurn: false,
  };

  // ========================================
  // Connection Events
  // ========================================
  
  socket.on('connect', () => {
    console.log(`✅ Connected! Socket ID: ${socket.id}`);
    
    // Authenticate with a random API key
    const apiKey = `bot_${botType}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    socket.emit('auth', { apiKey });
  });
  
  socket.on('auth:success', (data: { agentId: string }) => {
    instance.agentId = data.agentId;
    console.log(`🔐 Authenticated as ${data.agentId}`);
    
    // Join table
    socket.emit('table:join', { tableId, buyIn });
  });
  
  socket.on('table:joined', (data: { tableId: string; seat: number }) => {
    instance.seat = data.seat;
    console.log(`🪑 Joined ${data.tableId} at seat ${data.seat}`);
  });
  
  socket.on('connect_error', (err) => {
    console.error(`❌ Connection error: ${err.message}`);
  });
  
  socket.on('disconnect', (reason) => {
    console.log(`🔌 Disconnected: ${reason}`);
  });
  
  socket.on('error', (data: { message: string }) => {
    console.error(`⚠️ Error: ${data.message}`);
  });

  // ========================================
  // Game Events
  // ========================================
  
  socket.on('hand:start', (data: {
    handId: string;
    yourCards?: Card[];
    seat?: number;
    yourBet?: number;
    players: Array<{ agentId: string; seat: number; chips: number; bet: number }>;
    pot: number;
    currentBet?: number;
    activePlayerSeat: number;
  }) => {
    console.log(`\n🃏 New hand started: ${data.handId}`);
    
    instance.myCards = data.yourCards || [];
    instance.communityCards = [];
    instance.pot = data.pot;
    instance.myBet = data.yourBet || 0;
    instance.currentBet = data.currentBet || 10; // Default to big blind
    instance.phase = 'preflop';
    
    console.log(`   Current bet: ${instance.currentBet}, Your bet: ${instance.myBet}`);
    
    instance.players = data.players.map(p => ({
      ...p,
      isFolded: false,
      isAllIn: false,
    }));
    
    if (data.yourCards) {
      console.log(`   Your cards: ${formatCards(data.yourCards)}`);
    }
    
    // Check if it's our turn
    if (data.activePlayerSeat === instance.seat) {
      instance.isMyTurn = true;
      makeDecision(instance, bot);
    }
  });
  
  socket.on('phase', (data: {
    phase: string;
    communityCards: Card[];
    pot: number;
    activePlayerSeat: number;
  }) => {
    instance.phase = data.phase as any;
    instance.communityCards = data.communityCards;
    instance.pot = data.pot;
    instance.myBet = 0; // Reset for new betting round
    instance.currentBet = 0;
    
    // Reset all player bets
    for (const p of instance.players) {
      p.bet = 0;
    }
    
    console.log(`\n📍 ${data.phase.toUpperCase()}`);
    console.log(`   Board: ${formatCards(data.communityCards)}`);
    console.log(`   Pot: ${data.pot}`);
    
    if (data.activePlayerSeat === instance.seat) {
      instance.isMyTurn = true;
      makeDecision(instance, bot);
    }
  });
  
  socket.on('turn', (data: { activePlayerSeat: number; agentId?: string }) => {
    if (data.activePlayerSeat === instance.seat) {
      instance.isMyTurn = true;
      console.log(`\n⏰ Your turn!`);
      makeDecision(instance, bot);
    }
  });
  
  socket.on('action', (data: {
    agentId: string;
    action: string;
    amount?: number;
    pot: number;
    playerChips: number;
    playerBet: number;
  }) => {
    instance.pot = data.pot;
    
    // Update player state
    const player = instance.players.find(p => p.agentId === data.agentId);
    if (player) {
      player.chips = data.playerChips;
      player.bet = data.playerBet;
      if (data.action === 'fold') player.isFolded = true;
      if (data.action === 'all_in') player.isAllIn = true;
    }
    
    // Update current bet
    if (data.playerBet > instance.currentBet) {
      instance.currentBet = data.playerBet;
    }
    
    // Update our own bet if it was us
    if (data.agentId === instance.agentId) {
      instance.myBet = data.playerBet;
      instance.myChips = data.playerChips;
    }
    
    const actionStr = data.amount ? `${data.action} ${data.amount}` : data.action;
    console.log(`   ${data.agentId === instance.agentId ? '(You)' : data.agentId}: ${actionStr}`);
  });
  
  socket.on('hand:end', (data: {
    winners: Array<{ agentId: string; amount: number; reason: string; cards?: Card[] }>;
    pot: number;
    showdown?: Array<{ agentId: string; cards: Card[] }>;
  }) => {
    console.log(`\n🏆 Hand ended!`);
    
    for (const winner of data.winners) {
      const isMe = winner.agentId === instance.agentId;
      console.log(`   ${isMe ? '🎉 YOU WIN' : 'Winner'}: ${winner.agentId} - ${winner.amount} chips`);
      
      if (isMe) {
        instance.myChips += winner.amount;
        const chatMsg = bot.chat(buildGameState(instance), 'win');
        if (chatMsg) socket.emit('chat', { message: chatMsg });
      }
    }
    
    if (data.showdown) {
      console.log(`   Showdown:`);
      for (const p of data.showdown) {
        console.log(`     ${p.agentId}: ${formatCards(p.cards)}`);
      }
    }
    
    console.log(`   Your chips: ${instance.myChips}`);
  });
  
  socket.on('player:joined', (data: { agentId: string; seat: number; chips: number }) => {
    console.log(`👤 Player joined: ${data.agentId} at seat ${data.seat}`);
  });
  
  socket.on('player:left', (data: { agentId: string }) => {
    console.log(`👋 Player left: ${data.agentId}`);
    instance.players = instance.players.filter(p => p.agentId !== data.agentId);
  });
  
  socket.on('chat:message', (data: { agentId: string; message: string }) => {
    if (data.agentId !== instance.agentId) {
      console.log(`💬 ${data.agentId}: ${data.message}`);
    }
  });

  // Keep alive
  return new Promise(() => {});
}

function makeDecision(instance: BotInstance, bot: typeof BOTS[BotType]): void {
  if (!instance.isMyTurn) return;
  instance.isMyTurn = false;
  
  const state = buildGameState(instance);
  
  // Add thinking delay (500-2000ms) to seem more natural
  const thinkTime = 500 + Math.random() * 1500;
  
  setTimeout(() => {
    const action = bot.decide(state);
    
    console.log(`🎯 Decision: ${action.action}${action.amount ? ` ${action.amount}` : ''}`);
    
    instance.socket.emit('action', {
      action: action.action,
      amount: action.amount,
    });
  }, thinkTime);
}

function buildGameState(instance: BotInstance): GameState {
  return {
    phase: instance.phase,
    myCards: instance.myCards,
    communityCards: instance.communityCards,
    pot: instance.pot,
    myChips: instance.myChips,
    myBet: instance.myBet,
    currentBet: instance.currentBet,
    players: instance.players,
    position: 'middle', // TODO: Calculate actual position
  };
}

function formatCards(cards: Card[]): string {
  if (!cards || cards.length === 0) return '(none)';
  
  const suitSymbols: Record<string, string> = {
    hearts: '♥️',
    diamonds: '♦️',
    clubs: '♣️',
    spades: '♠️',
  };
  
  return cards.map(c => `${c.rank}${suitSymbols[c.suit] || c.suit}`).join(' ');
}

// ========================================
// Export for programmatic use
// ========================================
export { runBot };
export type { BotType };

// ========================================
// Main Entry Point (CLI)
// ========================================
if (require.main === module) {
  const args = process.argv.slice(2);
  const botType = (args[0] || 'balanced') as BotType;
  const tableId = args[1] || 'bronze-1';
  const buyIn = parseInt(args[2] || '1000', 10);

  if (!BOTS[botType]) {
    console.error(`Unknown bot type: ${botType}`);
    console.error(`Available: ${Object.keys(BOTS).join(', ')}`);
    process.exit(1);
  }

  console.log(`
╔═══════════════════════════════════════╗
║       🎰 AI Casino Bot Runner         ║
╠═══════════════════════════════════════╣
║  Bot: ${BOTS[botType].config.name.padEnd(30)}║
║  Table: ${tableId.padEnd(28)}║
║  Buy-in: ${buyIn.toString().padEnd(27)}║
╚═══════════════════════════════════════╝
  `);

  runBot(botType, tableId, buyIn).catch(console.error);
}
