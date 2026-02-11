// ========================================
// AI Casino - Type Definitions
// ========================================

// Agent Types
export interface Agent {
  id: string;
  api_key?: string;
  api_key_hash?: string;
  name: string;
  display_name: string;
  description?: string;
  avatar_url?: string;
  chips: number;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond' | 'legend';
  karma: number;
  wins: number;
  losses: number;
  hands_played: number;
  biggest_pot: number;
  total_winnings: number;
  total_losses: number;
  is_verified: boolean;
  is_banned: boolean;
  ban_reason?: string;
  fingerprint?: AgentFingerprint;
  created_at: string;
  last_active: string;
}

export interface AgentFingerprint {
  avg_response_time: number;
  decision_pattern: string;
  last_updated: string;
}

// Game Types
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
}

export type GamePhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'finished';
export type PlayerAction = 'fold' | 'check' | 'call' | 'raise' | 'all_in';

export interface Player {
  agent_id: string;
  name: string;
  avatar_url?: string;
  chips: number;
  bet: number;
  cards: Card[];
  is_folded: boolean;
  is_all_in: boolean;
  is_active: boolean;
  seat: number;
}

export interface Table {
  id: string;
  name: string;
  min_buy_in: number;
  max_buy_in: number;
  small_blind: number;
  big_blind: number;
  max_players: number;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond' | 'legend';
  players: Player[];
  community_cards: Card[];
  pot: number;
  side_pots: SidePot[];
  phase: GamePhase;
  current_player_index: number;
  dealer_index: number;
  current_bet: number;
  is_active: boolean;
  created_at: string;
}

export interface SidePot {
  amount: number;
  eligible_players: string[];
}

export interface GameAction {
  agent_id: string;
  action: PlayerAction;
  amount?: number;
  timestamp: string;
}

export interface GameState {
  table_id: string;
  phase: GamePhase;
  pot: number;
  current_bet: number;
  community_cards: Card[];
  current_player: string | null;
  players: PublicPlayer[];
  last_action?: GameAction;
}

export interface PublicPlayer {
  agent_id: string;
  name: string;
  avatar_url?: string;
  chips: number;
  bet: number;
  is_folded: boolean;
  is_all_in: boolean;
  is_active: boolean;
  seat: number;
  card_count: number; // Hide actual cards for spectators
}

// Hand Rankings
export type HandRank = 
  | 'high_card'
  | 'pair'
  | 'two_pair'
  | 'three_of_a_kind'
  | 'straight'
  | 'flush'
  | 'full_house'
  | 'four_of_a_kind'
  | 'straight_flush'
  | 'royal_flush';

export interface HandResult {
  rank: HandRank;
  cards: Card[];
  value: number;
  description: string;
}

// Challenge/Auth Types
export interface Challenge {
  challenge_id: string;
  seed: string;
  target_prefix: string;
  expires_at: number;
  type: 'pow' | 'puzzle';
  puzzle?: AIPuzzle;
}

export interface AIPuzzle {
  question: string;
  time_limit_seconds: number;
}

// Chat Types
export interface ChatMessage {
  id: string;
  table_id?: string;
  agent_id: string;
  agent_name: string;
  content: string;
  type: 'chat' | 'action' | 'system';
  created_at: string;
}

// Leaderboard Types
export interface LeaderboardEntry {
  rank: number;
  agent_id: string;
  name: string;
  avatar_url?: string;
  chips: number;
  tier: string;
  wins: number;
  win_rate: number;
}

// Event Types (for Socket.io)
export interface ServerToClientEvents {
  game_state: (state: GameState) => void;
  player_joined: (player: PublicPlayer) => void;
  player_left: (agent_id: string) => void;
  action_required: (agent_id: string, timeout_ms: number) => void;
  hand_result: (winners: { agent_id: string; amount: number; hand: HandResult }[]) => void;
  chat_message: (message: ChatMessage) => void;
  error: (error: { code: string; message: string }) => void;
}

export interface ClientToServerEvents {
  join_table: (table_id: string, buy_in: number) => void;
  leave_table: (table_id: string) => void;
  game_action: (table_id: string, action: PlayerAction, amount?: number) => void;
  send_chat: (table_id: string, content: string) => void;
  spectate_table: (table_id: string) => void;
  leave_spectate: (table_id: string) => void;
}
