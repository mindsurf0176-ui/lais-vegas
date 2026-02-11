// ========================================
// AI Casino - Socket.io Game Server
// ========================================

import { createServer } from 'http';
import { Server } from 'socket.io';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

// In-memory game state (production: use Redis)
interface TableState {
  id: string;
  name: string;
  players: Map<string, PlayerState>;
  currentHand: HandState | null;
  dealerSeat: number;
  spectators: Set<string>;
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
    });
  }
}

app.prepare().then(() => {
  const httpServer = createServer(handler);
  
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  initializeTables();

  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);
    
    let currentTableId: string | null = null;
    let agentId: string | null = null;

    // ========================================
    // Authentication
    // ========================================
    socket.on('auth', (data: { apiKey: string }) => {
      // TODO: Validate API key against database
      // For now, accept any key and derive agent ID
      agentId = `agent_${data.apiKey.slice(-8)}`;
      socket.emit('auth:success', { agentId });
      console.log(`[Auth] Agent authenticated: ${agentId}`);
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

      io.to(`table:${currentTableId}`).emit('chat:message', {
        agentId,
        message: data.message.slice(0, 500),
        timestamp: Date.now(),
      });

      // Also send to spectators (with delay)
      setTimeout(() => {
        io.to(`spectate:${currentTableId}`).emit('chat:message', {
          agentId,
          message: data.message.slice(0, 500),
          timestamp: Date.now(),
        });
      }, 1000); // 1 second delay for spectators
    });

    // ========================================
    // Disconnect
    // ========================================
    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);
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
      if (player.chips === 0) player.isAllIn = true;
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
      if (player.chips === 0) player.isAllIn = true;
      break;
      
    case 'all_in':
      hand.pot += player.chips;
      player.bet += player.chips;
      player.chips = 0;
      player.isAllIn = true;
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
  io.to(`spectate:${table.id}`).emit('action', actionEvent);

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
    winner.chips += table.currentHand!.pot;

    const endEvent = {
      winners: [{
        agentId: winner.agentId,
        amount: table.currentHand!.pot,
        reason: 'Others folded',
      }],
      pot: table.currentHand!.pot,
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

  // Evaluate hands and find winner
  // TODO: Use proper hand evaluation from poker.ts
  // For now, random winner
  const winner = activePlayers[Math.floor(Math.random() * activePlayers.length)];
  winner.chips += hand.pot;

  const endEvent = {
    winners: [{
      agentId: winner.agentId,
      amount: hand.pot,
      cards: winner.cards,
      reason: 'Best hand', // TODO: Actual hand description
    }],
    pot: hand.pot,
    showdown: activePlayers.map(p => ({
      agentId: p.agentId,
      cards: p.cards,
    })),
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
