// ========================================
// AI Casino - Socket.io Game Server
// ========================================

import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import next from 'next';
import crypto from 'crypto';

// ========================================
// Input Sanitization (XSS Prevention)
// ========================================
function sanitizeMessage(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/\0/g, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .slice(0, 500)
    .trim();
}

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

// ========================================
// Security: Rate Limiting & Connection Tracking
// ========================================
const connectionsByIP = new Map<string, number>();
const authAttempts = new Map<string, { count: number; lastAttempt: number }>();
const registeredAgents = new Map<string, { name: string; createdAt: number }>();
const MAX_CONNECTIONS_PER_IP = 10;  // 봇 테스트 위해 상향
const MAX_AUTH_ATTEMPTS = 10;
const AUTH_WINDOW_MS = 60000; // 1 minute

function getClientIP(socket: Socket): string {
  return socket.handshake.headers['x-forwarded-for']?.toString().split(',')[0] || 
         socket.handshake.address || 
         'unknown';
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const attempts = authAttempts.get(ip);
  
  if (!attempts) {
    authAttempts.set(ip, { count: 1, lastAttempt: now });
    return true;
  }
  
  // Reset if window passed
  if (now - attempts.lastAttempt > AUTH_WINDOW_MS) {
    authAttempts.set(ip, { count: 1, lastAttempt: now });
    return true;
  }
  
  if (attempts.count >= MAX_AUTH_ATTEMPTS) {
    return false;
  }
  
  attempts.count++;
  attempts.lastAttempt = now;
  return true;
}

function validateApiKey(apiKey: string): { valid: boolean; error?: string } {
  if (!apiKey || typeof apiKey !== 'string') {
    return { valid: false, error: 'API key required' };
  }
  if (apiKey.length < 16) {
    return { valid: false, error: 'API key too short (min 16 chars)' };
  }
  if (apiKey.length > 128) {
    return { valid: false, error: 'API key too long' };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(apiKey)) {
    return { valid: false, error: 'Invalid API key format' };
  }
  return { valid: true };
}

// Simple PoW verification (optional challenge)
function verifyPoW(seed: string, nonce: string, targetPrefix: string = '000'): boolean {
  const hash = crypto.createHash('sha256').update(`${seed}${nonce}`).digest('hex');
  return hash.startsWith(targetPrefix);
}

// ========================================
// Behavior Analysis (Anti-Cheat)
// ========================================
interface BehaviorProfile {
  responseTimes: number[];
  actionPatterns: string[];
  lastActionTime: number;
  suspiciousScore: number;
  challengesPassed: number;
  challengesFailed: number;
}

const behaviorProfiles = new Map<string, BehaviorProfile>();

function initBehaviorProfile(agentId: string): BehaviorProfile {
  const profile: BehaviorProfile = {
    responseTimes: [],
    actionPatterns: [],
    lastActionTime: Date.now(),
    suspiciousScore: 0,
    challengesPassed: 0,
    challengesFailed: 0,
  };
  behaviorProfiles.set(agentId, profile);
  return profile;
}

function analyzeAction(agentId: string, action: string): { suspicious: boolean; reason?: string } {
  const profile = behaviorProfiles.get(agentId);
  if (!profile) return { suspicious: false };
  
  const now = Date.now();
  const responseTime = now - profile.lastActionTime;
  profile.lastActionTime = now;
  
  // Track response time
  profile.responseTimes.push(responseTime);
  if (profile.responseTimes.length > 100) {
    profile.responseTimes.shift();
  }
  
  // Track action patterns
  profile.actionPatterns.push(action);
  if (profile.actionPatterns.length > 50) {
    profile.actionPatterns.shift();
  }
  
  // Check for human-like slow responses (>5 seconds consistently)
  const avgResponseTime = profile.responseTimes.reduce((a, b) => a + b, 0) / profile.responseTimes.length;
  if (avgResponseTime > 5000 && profile.responseTimes.length > 10) {
    profile.suspiciousScore += 0.5;
    return { suspicious: true, reason: 'Response time too slow (possible human)' };
  }
  
  // Check for bot-like instant responses (<50ms consistently)
  if (avgResponseTime < 50 && profile.responseTimes.length > 10) {
    profile.suspiciousScore += 0.1;
    // This is actually expected for AI, but track it
  }
  
  // Check for repetitive patterns (same 5 actions in a row)
  if (profile.actionPatterns.length >= 5) {
    const lastFive = profile.actionPatterns.slice(-5);
    if (lastFive.every(a => a === lastFive[0])) {
      profile.suspiciousScore += 0.3;
      return { suspicious: true, reason: 'Repetitive action pattern' };
    }
  }
  
  // Threshold for flagging
  if (profile.suspiciousScore >= 5) {
    return { suspicious: true, reason: 'Suspicious score exceeded threshold' };
  }
  
  return { suspicious: false };
}

// ========================================
// AI Challenge System (In-Game Verification)
// ========================================
interface ActiveChallenge {
  agentId: string;
  question: string;
  answer: string;
  expiresAt: number;
  socketId: string;
}

const activeChallenges = new Map<string, ActiveChallenge>();

function generateQuickChallenge(): { question: string; answer: string } {
  const challenges = [
    () => {
      const a = Math.floor(Math.random() * 100);
      const b = Math.floor(Math.random() * 100);
      return { question: `${a} + ${b} = ?`, answer: (a + b).toString() };
    },
    () => {
      const text = crypto.randomBytes(4).toString('hex');
      return { question: `Reverse: ${text}`, answer: text.split('').reverse().join('') };
    },
    () => {
      const n = Math.floor(Math.random() * 20) + 1;
      return { question: `${n} * 7 = ?`, answer: (n * 7).toString() };
    },
    () => {
      const words = ['hello', 'world', 'agent', 'poker', 'chips'];
      const word = words[Math.floor(Math.random() * words.length)];
      return { question: `Length of "${word}"?`, answer: word.length.toString() };
    },
  ];
  
  return challenges[Math.floor(Math.random() * challenges.length)]();
}

function issueChallenge(agentId: string, socketId: string): ActiveChallenge {
  const { question, answer } = generateQuickChallenge();
  const challenge: ActiveChallenge = {
    agentId,
    question,
    answer,
    expiresAt: Date.now() + 5000, // 5 seconds
    socketId,
  };
  activeChallenges.set(agentId, challenge);
  return challenge;
}

function verifyChallenge(agentId: string, answer: string): boolean {
  const challenge = activeChallenges.get(agentId);
  if (!challenge) return false;
  
  if (Date.now() > challenge.expiresAt) {
    activeChallenges.delete(agentId);
    const profile = behaviorProfiles.get(agentId);
    if (profile) {
      profile.challengesFailed++;
      profile.suspiciousScore += 2;
    }
    return false;
  }
  
  const correct = challenge.answer.toLowerCase() === answer.toLowerCase().trim();
  activeChallenges.delete(agentId);
  
  const profile = behaviorProfiles.get(agentId);
  if (profile) {
    if (correct) {
      profile.challengesPassed++;
      profile.suspiciousScore = Math.max(0, profile.suspiciousScore - 0.5);
    } else {
      profile.challengesFailed++;
      profile.suspiciousScore += 1;
    }
  }
  
  return correct;
}

// ========================================
// Spectator Delay (Random 30s - 2min)
// ========================================
const SPECTATOR_DELAY_MIN = 30000; // 30 seconds
const SPECTATOR_DELAY_MAX = 120000; // 2 minutes

function getRandomSpectatorDelay(): number {
  return SPECTATOR_DELAY_MIN + Math.random() * (SPECTATOR_DELAY_MAX - SPECTATOR_DELAY_MIN);
}

function emitToSpectatorsWithDelay(io: Server, tableId: string, event: string, data: unknown) {
  const delay = getRandomSpectatorDelay();
  setTimeout(() => {
    io.to(`spectate:${tableId}`).emit(event, data);
  }, delay);
}

// In-memory game state (production: use Redis)
interface TableStats {
  totalHands: number;
  biggestPot: number;
  totalAllIns: number;
  startedAt: number;
}

interface TableState {
  id: string;
  name: string;
  players: Map<string, PlayerState>;
  currentHand: HandState | null;
  dealerSeat: number;
  spectators: Set<string>;
  stats: TableStats;
}

interface PlayerState {
  agentId: string;
  name: string;
  seat: number;
  chips: number;
  bet: number;
  cards: { suit: string; rank: string }[];
  isFolded: boolean;
  isAllIn: boolean;
  socketId: string;
}

interface HandState {
  id: string;
  phase: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
  pot: number;
  communityCards: { suit: string; rank: string }[];
  currentBet: number;
  activePlayerSeat: number;
  lastAction: { agentId: string; action: string; amount?: number } | null;
}

const tables = new Map<string, TableState>();

// Initialize default tables
function initializeTables() {
  const defaultTables = [
    { id: 'bronze-1', name: 'Bronze Beginners', smallBlind: 5, bigBlind: 10 },
    { id: 'bronze-2', name: 'Bronze Standard', smallBlind: 10, bigBlind: 20 },
    { id: 'silver-1', name: 'Silver Stakes', smallBlind: 25, bigBlind: 50 },
  ];

  for (const t of defaultTables) {
    tables.set(t.id, {
      id: t.id,
      name: t.name,
      players: new Map(),
      currentHand: null,
      dealerSeat: 0,
      spectators: new Set(),
      stats: {
        totalHands: 0,
        biggestPot: 0,
        totalAllIns: 0,
        startedAt: Date.now(),
      },
    });
  }
}

app.prepare().then(() => {
  const httpServer = createServer(handler);
  
  // CORS: Restrict in production
  const corsOrigin = process.env.NODE_ENV === 'production'
    ? ['https://lais-vegas.com', 'https://www.lais-vegas.com']
    : '*';
  
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Connection security
    pingTimeout: 30000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e6, // 1MB max message size
  });

  initializeTables();

  io.on('connection', (socket) => {
    const clientIP = getClientIP(socket);
    
    // Rate limit connections per IP
    const currentConnections = connectionsByIP.get(clientIP) || 0;
    if (currentConnections >= MAX_CONNECTIONS_PER_IP) {
      console.log(`[Security] Connection rejected - too many connections from ${clientIP}`);
      socket.emit('error', { message: 'Too many connections from your IP' });
      socket.disconnect(true);
      return;
    }
    connectionsByIP.set(clientIP, currentConnections + 1);
    
    console.log(`[Socket] Connected: ${socket.id} from ${clientIP}`);
    
    let currentTableId: string | null = null;
    let agentId: string | null = null;
    let isAuthenticated = false;

    // ========================================
    // Authentication (with security checks)
    // ========================================
    socket.on('auth', (data: { apiKey: string; powProof?: { seed: string; nonce: string } }) => {
      // Rate limit auth attempts
      if (!checkRateLimit(clientIP)) {
        socket.emit('error', { message: 'Too many auth attempts. Try again later.' });
        console.log(`[Security] Auth rate limited: ${clientIP}`);
        return;
      }
      
      // Validate API key format
      const validation = validateApiKey(data.apiKey);
      if (!validation.valid) {
        socket.emit('error', { message: validation.error });
        console.log(`[Security] Invalid API key format from ${clientIP}: ${validation.error}`);
        return;
      }
      
      // Optional PoW verification for extra security
      if (data.powProof) {
        if (!verifyPoW(data.powProof.seed, data.powProof.nonce)) {
          socket.emit('error', { message: 'Invalid proof of work' });
          console.log(`[Security] PoW failed from ${clientIP}`);
          return;
        }
        console.log(`[Security] PoW verified for ${clientIP}`);
      }
      
      // Generate deterministic agent ID from API key
      const keyHash = crypto.createHash('sha256').update(data.apiKey).digest('hex');
      agentId = `agent_${keyHash.slice(0, 8)}`;
      isAuthenticated = true;
      
      // Track registered agents
      if (!registeredAgents.has(agentId)) {
        registeredAgents.set(agentId, { name: agentId, createdAt: Date.now() });
      }
      
      // Initialize behavior profile
      if (!behaviorProfiles.has(agentId)) {
        initBehaviorProfile(agentId);
      }
      
      socket.emit('auth:success', { agentId });
      console.log(`[Auth] Agent authenticated: ${agentId} from ${clientIP}`);
    });
    
    // ========================================
    // Challenge Response
    // ========================================
    socket.on('challenge:answer', (data: { answer: string }) => {
      if (!agentId) return;
      
      const correct = verifyChallenge(agentId, data.answer);
      socket.emit('challenge:result', { correct });
      
      if (!correct) {
        const profile = behaviorProfiles.get(agentId);
        if (profile && profile.suspiciousScore >= 10) {
          socket.emit('error', { message: 'Account flagged for review. Too many failed challenges.' });
          console.log(`[Security] Agent ${agentId} flagged for failed challenges`);
        }
      }
    });

    // ========================================
    // Table Events
    // ========================================
    socket.on('table:join', (data: { tableId: string; buyIn: number; seat?: number }) => {
      if (!agentId) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      const table = tables.get(data.tableId);
      if (!table) {
        socket.emit('error', { message: 'Table not found' });
        return;
      }

      // Find available seat
      const occupiedSeats = new Set(Array.from(table.players.values()).map(p => p.seat));
      let seat = data.seat;
      if (seat === undefined || occupiedSeats.has(seat)) {
        for (let i = 1; i <= 9; i++) {
          if (!occupiedSeats.has(i)) {
            seat = i;
            break;
          }
        }
      }

      if (seat === undefined) {
        socket.emit('error', { message: 'Table is full' });
        return;
      }

      // Add player
      table.players.set(agentId, {
        agentId,
        name: `Player_${agentId.slice(-4)}`,
        seat,
        chips: data.buyIn,
        bet: 0,
        cards: [],
        isFolded: false,
        isAllIn: false,
        socketId: socket.id,
      });

      currentTableId = data.tableId;
      socket.join(`table:${data.tableId}`);
      socket.emit('table:joined', { tableId: data.tableId, seat });
      
      // Broadcast to table
      io.to(`table:${data.tableId}`).emit('player:joined', {
        agentId,
        seat,
        chips: data.buyIn,
      });

      console.log(`[Table] ${agentId} joined ${data.tableId} at seat ${seat}`);

      // Auto-start game if 2+ players
      if (table.players.size >= 2 && !table.currentHand) {
        startHand(table, io);
      }
    });

    socket.on('table:leave', () => {
      if (currentTableId && agentId) {
        leaveTable(currentTableId, agentId, socket, io);
      }
    });

    // ========================================
    // Spectator Events
    // ========================================
    socket.on('spectate:join', (data: { tableId: string }) => {
      const table = tables.get(data.tableId);
      if (!table) {
        socket.emit('error', { message: 'Table not found' });
        return;
      }

      table.spectators.add(socket.id);
      socket.join(`spectate:${data.tableId}`);
      
      // Send current state
      socket.emit('table:state', getTableState(table));
      console.log(`[Spectator] ${socket.id} watching ${data.tableId}`);
    });

    socket.on('spectate:leave', (data: { tableId: string }) => {
      const table = tables.get(data.tableId);
      if (table) {
        table.spectators.delete(socket.id);
        socket.leave(`spectate:${data.tableId}`);
      }
    });

    // ========================================
    // Game Actions
    // ========================================
    socket.on('action', (data: { action: string; amount?: number }) => {
      if (!currentTableId || !agentId) {
        socket.emit('error', { message: 'Not in a game' });
        return;
      }

      const table = tables.get(currentTableId);
      if (!table || !table.currentHand) {
        socket.emit('error', { message: 'No active hand' });
        return;
      }

      const player = table.players.get(agentId);
      if (!player) {
        socket.emit('error', { message: 'Not at this table' });
        return;
      }

      // Validate it's player's turn
      if (player.seat !== table.currentHand.activePlayerSeat) {
        socket.emit('error', { message: 'Not your turn' });
        return;
      }

      processAction(table, player, data.action, data.amount, io);
    });

    // ========================================
    // Chat
    // ========================================
    socket.on('chat', (data: { message: string }) => {
      if (!currentTableId || !agentId) return;
      
      // Sanitize message (XSS prevention)
      const safeMessage = sanitizeMessage(data.message);
      if (!safeMessage) return;

      io.to(`table:${currentTableId}`).emit('chat:message', {
        agentId,
        message: safeMessage,
        timestamp: Date.now(),
      });

      // Also send to spectators (with delay)
      setTimeout(() => {
        io.to(`spectate:${currentTableId}`).emit('chat:message', {
          agentId,
          message: safeMessage,
          timestamp: Date.now(),
        });
      }, 1000); // 1 second delay for spectators
    });

    // ========================================
    // Spectator Chat (spectators only)
    // ========================================
    socket.on('spectate:chat', (data: { tableId: string; message: string; nickname?: string }) => {
      const table = tables.get(data.tableId);
      if (!table || !table.spectators.has(socket.id)) {
        socket.emit('error', { message: 'Not spectating this table' });
        return;
      }

      // Sanitize inputs (XSS prevention)
      const nickname = sanitizeMessage(data.nickname || `Spectator_${socket.id.slice(-4)}`).slice(0, 20);
      const message = sanitizeMessage(data.message).slice(0, 300);
      if (!message) return;

      // Broadcast to all spectators of this table only
      io.to(`spectate:${data.tableId}`).emit('spectator:chat', {
        nickname,
        message,
        timestamp: Date.now(),
        socketId: socket.id,
      });
    });

    // ========================================
    // Disconnect
    // ========================================
    socket.on('disconnect', () => {
      // Decrease connection count
      const count = connectionsByIP.get(clientIP) || 1;
      if (count <= 1) {
        connectionsByIP.delete(clientIP);
      } else {
        connectionsByIP.set(clientIP, count - 1);
      }
      
      console.log(`[Socket] Disconnected: ${socket.id} from ${clientIP}`);
      if (currentTableId && agentId) {
        leaveTable(currentTableId, agentId, socket, io);
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`
🎰 AI Casino Server running on http://localhost:${port}
📡 Socket.io ready for connections
    `);
    
    // Auto-start bots after server is ready
    if (process.env.AUTO_BOTS !== 'false') {
      setTimeout(async () => {
        console.log('\n🤖 Auto-starting bots...');
        try {
          const { runBot } = await import('./bots/runner.js');
          const serverUrl = `http://localhost:${port}`;
          
          // Start bots with staggered timing
          const bots: Array<{ type: 'conservative' | 'aggressive' | 'balanced'; buyIn: number; delay: number }> = [
            { type: 'conservative', buyIn: 1000, delay: 0 },
            { type: 'aggressive', buyIn: 1500, delay: 2000 },
            { type: 'balanced', buyIn: 1200, delay: 4000 },
          ];
          
          for (const bot of bots) {
            setTimeout(() => {
              console.log(`🚀 Starting ${bot.type} bot...`);
              runBot(bot.type, 'bronze-1', bot.buyIn, serverUrl).catch(err => {
                console.error(`Failed to start ${bot.type}: ${err.message}`);
              });
            }, bot.delay);
          }
        } catch (err) {
          console.error('Failed to auto-start bots:', err);
        }
      }, 3000); // Wait 3 seconds for server to fully initialize
    }
  });
});

// ========================================
// Game Logic
// ========================================

function leaveTable(tableId: string, agentId: string, socket: any, io: Server) {
  const table = tables.get(tableId);
  if (table) {
    const player = table.players.get(agentId);
    table.players.delete(agentId);
    socket.leave(`table:${tableId}`);
    
    io.to(`table:${tableId}`).emit('player:left', { agentId });
    io.to(`spectate:${tableId}`).emit('player:left', { agentId });
    
    console.log(`[Table] ${agentId} left ${tableId}`);

    // If game in progress and player was active, fold them
    if (table.currentHand && player && !player.isFolded) {
      player.isFolded = true;
      checkHandEnd(table, io);
    }
  }
}

function getTableState(table: TableState) {
  const players = Array.from(table.players.values()).map(p => ({
    agentId: p.agentId,
    name: p.name,
    seat: p.seat,
    chips: p.chips,
    bet: p.bet,
    isFolded: p.isFolded,
    isAllIn: p.isAllIn,
    // Hide cards for spectators
    cards: p.isFolded ? [] : ['hidden', 'hidden'],
  }));

  return {
    id: table.id,
    name: table.name,
    players,
    currentHand: table.currentHand ? {
      phase: table.currentHand.phase,
      pot: table.currentHand.pot,
      communityCards: table.currentHand.communityCards,
      currentBet: table.currentHand.currentBet,
      activePlayerSeat: table.currentHand.activePlayerSeat,
    } : null,
    stats: {
      totalHands: table.stats.totalHands,
      biggestPot: table.stats.biggestPot,
      totalAllIns: table.stats.totalAllIns,
      uptime: Math.floor((Date.now() - table.stats.startedAt) / 1000),
    },
  };
}

function startHand(table: TableState, io: Server) {
  console.log(`[Game] Starting hand at ${table.id}`);
  
  const players = Array.from(table.players.values());
  const activePlayers = players.filter(p => p.chips > 0);
  
  if (activePlayers.length < 2) {
    console.log(`[Game] Not enough players with chips`);
    return;
  }

  // Create deck and shuffle
  const deck = createAndShuffleDeck();
  
  // Deal cards
  for (const player of activePlayers) {
    player.cards = [deck.pop()!, deck.pop()!];
    player.bet = 0;
    player.isFolded = false;
    player.isAllIn = false;
  }

  // Sort by seat for turn order
  activePlayers.sort((a, b) => a.seat - b.seat);
  
  // Post blinds
  const smallBlind = 5; // TODO: Get from table config
  const bigBlind = 10;
  
  const sbPlayer = activePlayers[0];
  const bbPlayer = activePlayers[1];
  
  sbPlayer.bet = Math.min(smallBlind, sbPlayer.chips);
  sbPlayer.chips -= sbPlayer.bet;
  
  bbPlayer.bet = Math.min(bigBlind, bbPlayer.chips);
  bbPlayer.chips -= bbPlayer.bet;

  // Set up hand state
  table.currentHand = {
    id: `hand_${Date.now()}`,
    phase: 'preflop',
    pot: sbPlayer.bet + bbPlayer.bet,
    communityCards: [],
    currentBet: bigBlind,
    activePlayerSeat: activePlayers.length > 2 ? activePlayers[2].seat : activePlayers[0].seat,
    lastAction: null,
  };

  // Store deck for later phases
  (table as any).deck = deck;

  // Emit to players (with their cards)
  for (const player of activePlayers) {
    const playerSocket = io.sockets.sockets.get(player.socketId);
    if (playerSocket) {
      playerSocket.emit('hand:start', {
        handId: table.currentHand.id,
        yourCards: player.cards,
        seat: player.seat,
        yourBet: player.bet,
        players: activePlayers.map(p => ({
          agentId: p.agentId,
          seat: p.seat,
          chips: p.chips,
          bet: p.bet,
        })),
        pot: table.currentHand.pot,
        currentBet: table.currentHand.currentBet,
        activePlayerSeat: table.currentHand.activePlayerSeat,
      });
    }
  }

  // Emit to spectators (hidden cards)
  io.to(`spectate:${table.id}`).emit('hand:start', {
    handId: table.currentHand.id,
    players: activePlayers.map(p => ({
      agentId: p.agentId,
      seat: p.seat,
      chips: p.chips,
      bet: p.bet,
      cards: ['hidden', 'hidden'],
    })),
    pot: table.currentHand.pot,
    activePlayerSeat: table.currentHand.activePlayerSeat,
  });
}

function processAction(table: TableState, player: PlayerState, action: string, amount: number | undefined, io: Server) {
  const hand = table.currentHand!;
  
  console.log(`[Action] ${player.agentId}: ${action} ${amount || ''}`);
  
  // Behavior analysis
  const analysis = analyzeAction(player.agentId, action);
  if (analysis.suspicious) {
    console.log(`[Security] Suspicious behavior from ${player.agentId}: ${analysis.reason}`);
    
    // Random chance to issue challenge (10% when suspicious)
    if (Math.random() < 0.1) {
      const playerSocket = io.sockets.sockets.get(player.socketId);
      if (playerSocket) {
        const challenge = issueChallenge(player.agentId, player.socketId);
        playerSocket.emit('challenge', { question: challenge.question, timeLimit: 5 });
        console.log(`[Security] Challenge issued to ${player.agentId}`);
      }
    }
  }
  
  // Random challenge for all players (1% chance per action)
  if (Math.random() < 0.01) {
    const playerSocket = io.sockets.sockets.get(player.socketId);
    if (playerSocket) {
      const challenge = issueChallenge(player.agentId, player.socketId);
      playerSocket.emit('challenge', { question: challenge.question, timeLimit: 5 });
      console.log(`[Security] Random challenge issued to ${player.agentId}`);
    }
  }

  switch (action) {
    case 'fold':
      player.isFolded = true;
      break;
      
    case 'check':
      if (player.bet < hand.currentBet) {
        io.to(player.socketId).emit('error', { message: 'Cannot check, must call or fold' });
        return;
      }
      break;
      
    case 'call':
      const callAmount = Math.min(hand.currentBet - player.bet, player.chips);
      player.chips -= callAmount;
      player.bet += callAmount;
      hand.pot += callAmount;
      if (player.chips === 0) {
        player.isAllIn = true;
        table.stats.totalAllIns++;
      }
      break;
      
    case 'raise':
      if (!amount || amount < hand.currentBet * 2) {
        io.to(player.socketId).emit('error', { message: 'Raise must be at least 2x current bet' });
        return;
      }
      const raiseAmount = Math.min(amount - player.bet, player.chips);
      player.chips -= raiseAmount;
      player.bet += raiseAmount;
      hand.pot += raiseAmount;
      hand.currentBet = player.bet;
      if (player.chips === 0) {
        player.isAllIn = true;
        table.stats.totalAllIns++;
      }
      break;
      
    case 'all_in':
      hand.pot += player.chips;
      player.bet += player.chips;
      player.chips = 0;
      player.isAllIn = true;
      table.stats.totalAllIns++;
      if (player.bet > hand.currentBet) {
        hand.currentBet = player.bet;
      }
      break;
      
    default:
      io.to(player.socketId).emit('error', { message: 'Invalid action' });
      return;
  }

  hand.lastAction = { agentId: player.agentId, action, amount };

  // Broadcast action
  const actionEvent = {
    agentId: player.agentId,
    action,
    amount,
    pot: hand.pot,
    playerChips: player.chips,
    playerBet: player.bet,
  };
  
  io.to(`table:${table.id}`).emit('action', actionEvent);
  // Spectators get delayed feed (anti-cheat)
  emitToSpectatorsWithDelay(io, table.id, 'action', actionEvent);

  // Check if hand should end
  if (checkHandEnd(table, io)) return;

  // Move to next player
  moveToNextPlayer(table, io);
}

function moveToNextPlayer(table: TableState, io: Server) {
  const hand = table.currentHand!;
  const players = Array.from(table.players.values())
    .filter(p => !p.isFolded && !p.isAllIn)
    .sort((a, b) => a.seat - b.seat);

  if (players.length === 0) {
    advancePhase(table, io);
    return;
  }

  const currentIndex = players.findIndex(p => p.seat === hand.activePlayerSeat);
  const nextPlayer = players[(currentIndex + 1) % players.length];

  // Check if betting round is complete
  const allBetsEqual = players.every(p => p.bet === hand.currentBet);
  if (allBetsEqual && currentIndex === players.length - 1) {
    advancePhase(table, io);
    return;
  }

  hand.activePlayerSeat = nextPlayer.seat;

  io.to(`table:${table.id}`).emit('turn', { 
    activePlayerSeat: nextPlayer.seat,
    agentId: nextPlayer.agentId,
  });
  io.to(`spectate:${table.id}`).emit('turn', { 
    activePlayerSeat: nextPlayer.seat,
  });
}

function advancePhase(table: TableState, io: Server) {
  const hand = table.currentHand!;
  const deck = (table as any).deck as { suit: string; rank: string }[];

  // Reset bets
  for (const player of table.players.values()) {
    player.bet = 0;
  }
  hand.currentBet = 0;

  const phaseOrder = ['preflop', 'flop', 'turn', 'river', 'showdown'] as const;
  const currentIndex = phaseOrder.indexOf(hand.phase as any);
  const nextPhase = phaseOrder[currentIndex + 1];

  hand.phase = nextPhase;

  // Deal community cards
  switch (nextPhase) {
    case 'flop':
      deck.pop(); // Burn
      hand.communityCards = [deck.pop()!, deck.pop()!, deck.pop()!];
      break;
    case 'turn':
      deck.pop(); // Burn
      hand.communityCards.push(deck.pop()!);
      break;
    case 'river':
      deck.pop(); // Burn
      hand.communityCards.push(deck.pop()!);
      break;
    case 'showdown':
      resolveShowdown(table, io);
      return;
  }

  // Find first active player
  const activePlayers = Array.from(table.players.values())
    .filter(p => !p.isFolded && !p.isAllIn)
    .sort((a, b) => a.seat - b.seat);

  if (activePlayers.length > 0) {
    hand.activePlayerSeat = activePlayers[0].seat;
  }

  const phaseEvent = {
    phase: nextPhase,
    communityCards: hand.communityCards,
    pot: hand.pot,
    activePlayerSeat: hand.activePlayerSeat,
  };

  io.to(`table:${table.id}`).emit('phase', phaseEvent);
  io.to(`spectate:${table.id}`).emit('phase', phaseEvent);
}

function checkHandEnd(table: TableState, io: Server): boolean {
  const activePlayers = Array.from(table.players.values()).filter(p => !p.isFolded);

  if (activePlayers.length === 1) {
    // Winner by fold
    const winner = activePlayers[0];
    const potAmount = table.currentHand!.pot;
    winner.chips += potAmount;

    // Update stats
    table.stats.totalHands++;
    if (potAmount > table.stats.biggestPot) {
      table.stats.biggestPot = potAmount;
    }

    const endEvent = {
      winners: [{
        agentId: winner.agentId,
        amount: potAmount,
        reason: 'Others folded',
      }],
      pot: potAmount,
      stats: table.stats,
    };

    io.to(`table:${table.id}`).emit('hand:end', endEvent);
    io.to(`spectate:${table.id}`).emit('hand:end', endEvent);

    table.currentHand = null;
    
    // Start new hand after delay
    setTimeout(() => {
      if (table.players.size >= 2) {
        startHand(table, io);
      }
    }, 3000);

    return true;
  }

  return false;
}

function resolveShowdown(table: TableState, io: Server) {
  const hand = table.currentHand!;
  const activePlayers = Array.from(table.players.values()).filter(p => !p.isFolded);
  const potAmount = hand.pot;

  // Evaluate hands and find winner
  // TODO: Use proper hand evaluation from poker.ts
  // For now, random winner
  const winner = activePlayers[Math.floor(Math.random() * activePlayers.length)];
  winner.chips += potAmount;

  // Update stats
  table.stats.totalHands++;
  if (potAmount > table.stats.biggestPot) {
    table.stats.biggestPot = potAmount;
  }

  const endEvent = {
    winners: [{
      agentId: winner.agentId,
      amount: potAmount,
      cards: winner.cards,
      reason: 'Best hand', // TODO: Actual hand description
    }],
    pot: potAmount,
    showdown: activePlayers.map(p => ({
      agentId: p.agentId,
      cards: p.cards,
    })),
    stats: table.stats,
  };

  io.to(`table:${table.id}`).emit('hand:end', endEvent);
  io.to(`spectate:${table.id}`).emit('hand:end', endEvent);

  table.currentHand = null;

  // Start new hand after delay
  setTimeout(() => {
    if (table.players.size >= 2) {
      startHand(table, io);
    }
  }, 5000);
}

// ========================================
// Deck Utilities
// ========================================

function createAndShuffleDeck(): { suit: string; rank: string }[] {
  const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  
  const deck: { suit: string; rank: string }[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank });
    }
  }

  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}
