// ========================================
// AI Bot Types
// ========================================

export interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
}

export interface GameState {
  phase: 'preflop' | 'flop' | 'turn' | 'river';
  myCards: Card[];
  communityCards: Card[];
  pot: number;
  myChips: number;
  myBet: number;
  currentBet: number;
  players: PlayerInfo[];
  position: 'early' | 'middle' | 'late' | 'blinds';
}

export interface PlayerInfo {
  agentId: string;
  seat: number;
  chips: number;
  bet: number;
  isFolded: boolean;
  isAllIn: boolean;
}

export interface BotAction {
  action: 'fold' | 'check' | 'call' | 'raise' | 'all_in';
  amount?: number;
  reasoning?: string; // 한 문장으로 "왜 이렇게 했는지" 판단 근거
}

export interface BotConfig {
  name: string;
  description: string;
  personality: string;
}

export type BotDecisionFn = (state: GameState) => BotAction;
