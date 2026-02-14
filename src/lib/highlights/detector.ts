// ========================================
// LAIS Vegas - Highlight Detection System
// ========================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 하이라이트 타입 정의
export type HighlightType = 
  | 'all_in'
  | 'comeback_win'
  | 'biggest_pot'
  | 'bubble_elimination'
  | 'bluff_success'
  | 'bluff_failure'
  | 'bad_beat'
  | 'cooler'
  | 'elimination';

// 하이라이트 이벤트 데이터
export interface HighlightEvent {
  type: HighlightType;
  tableId: string;
  handId: string;
  primaryAgentId: string;
  secondaryAgentId?: string;
  potAmount: number;
  betAmount: number;
  dramaScore: number;
  details: HighlightDetails;
}

export interface HighlightDetails {
  winnerCards?: Card[];
  loserCards?: Card[];
  communityCards?: Card[];
  winnerHandRank?: string;
  loserHandRank?: string;
  context?: string;
  turnAround?: boolean;
  previousChips?: number;
  finalChips?: number;
  reasoning?: string;
  taunt?: string;
  handHistory?: GameAction[];
}

export interface Card {
  suit: string;
  rank: string;
}

export interface GameAction {
  agentId: string;
  action: string;
  amount?: number;
  phase: string;
  timestamp: number;
}

// 테이블별 하이라이트 트래킹 상태
interface TableHighlightState {
  biggestPot: number;
  allInCount: number;
  handHistory: GameAction[];
  playerStartChips: Map<string, number>;
  showdownData?: ShowdownData;
}

interface ShowdownData {
  players: Map<string, {
    cards: Card[];
    handRank?: string;
    isWinner: boolean;
    amountWon: number;
  }>;
}

// 글로벌 상태 (메모리)
const tableHighlightStates = new Map<string, TableHighlightState>();

// Supabase 클라이언트 (서버 환경에서만 초기화)
let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    console.warn('[Highlight] Supabase credentials not configured, using in-memory storage');
    return null;
  }
  
  supabaseClient = createClient(url, key);
  return supabaseClient;
}

// ========================================
// State Management
// ========================================

export function initTableHighlightState(tableId: string): void {
  tableHighlightStates.set(tableId, {
    biggestPot: 0,
    allInCount: 0,
    handHistory: [],
    playerStartChips: new Map(),
  });
}

export function getTableHighlightState(tableId: string): TableHighlightState | undefined {
  return tableHighlightStates.get(tableId);
}

export function clearTableHighlightState(tableId: string): void {
  tableHighlightStates.delete(tableId);
}

// ========================================
// Action Tracking
// ========================================

export function recordAction(
  tableId: string,
  agentId: string,
  action: string,
  amount: number | undefined,
  phase: string
): void {
  const state = tableHighlightStates.get(tableId);
  if (!state) return;

  state.handHistory.push({
    agentId,
    action,
    amount,
    phase,
    timestamp: Date.now(),
  });

  // 히스토리 제한 (메모리 관리)
  if (state.handHistory.length > 50) {
    state.handHistory.shift();
  }
}

export function recordPlayerStartChips(tableId: string, agentId: string, chips: number): void {
  const state = tableHighlightStates.get(tableId);
  if (!state) return;
  state.playerStartChips.set(agentId, chips);
}

// ========================================
// Detection Functions
// ========================================

/**
 * 올인 발생 감지
 */
export function detectAllIn(
  tableId: string,
  handId: string,
  agentId: string,
  potAmount: number,
  allInAmount: number,
  reasoning?: string,
  taunt?: string
): HighlightEvent | null {
  const state = tableHighlightStates.get(tableId);
  if (!state) return null;

  state.allInCount++;

  const dramaScore = calculateDramaScore('all_in', potAmount, {
    isMultipleAllIn: state.allInCount > 1,
  });

  return {
    type: 'all_in',
    tableId,
    handId,
    primaryAgentId: agentId,
    potAmount,
    betAmount: allInAmount,
    dramaScore,
    details: {
      context: state.allInCount > 1 ? 'multiple_all_in' : 'single_all_in',
      reasoning,
      taunt,
      handHistory: [...state.handHistory],
    },
  };
}

/**
 * 역전승 감지 (언더독이 역전)
 */
export function detectComebackWin(
  tableId: string,
  handId: string,
  winnerId: string,
  loserId: string,
  potAmount: number,
  winnerCards: Card[],
  loserCards: Card[],
  communityCards: Card[]
): HighlightEvent | null {
  const state = tableHighlightStates.get(tableId);
  if (!state) return null;

  // 역전 여부 판단 (간단한 로직)
  // 실제로는 프리플롱/플롭 이후 승률 변화를 추적해야 함
  const isTurnAround = detectTurnAround(winnerCards, loserCards, communityCards);

  if (!isTurnAround) return null;

  const dramaScore = calculateDramaScore('comeback_win', potAmount, {
    turnAround: true,
  });

  return {
    type: 'comeback_win',
    tableId,
    handId,
    primaryAgentId: winnerId,
    secondaryAgentId: loserId,
    potAmount,
    betAmount: potAmount,
    dramaScore,
    details: {
      winnerCards,
      loserCards,
      communityCards,
      turnAround: true,
      context: 'river_sweat',
    },
  };
}

/**
 * 최대 팟 경신 감지
 */
export function detectBiggestPot(
  tableId: string,
  handId: string,
  winnerId: string,
  potAmount: number,
  winnerCards: Card[],
  communityCards: Card[]
): HighlightEvent | null {
  const state = tableHighlightStates.get(tableId);
  if (!state) return null;

  if (potAmount <= state.biggestPot) {
    return null;
  }

  state.biggestPot = potAmount;

  const dramaScore = calculateDramaScore('biggest_pot', potAmount, {
    isRecord: true,
  });

  return {
    type: 'biggest_pot',
    tableId,
    handId,
    primaryAgentId: winnerId,
    potAmount,
    betAmount: potAmount,
    dramaScore,
    details: {
      winnerCards,
      communityCards,
      context: 'new_record',
    },
  };
}

/**
 * 버블 탈락 감지 (빅스택에게 올인당해 아쉽게 탈락)
 */
export function detectBubbleElimination(
  tableId: string,
  handId: string,
  eliminatedId: string,
  winnerId: string,
  potAmount: number,
  eliminatedCards?: Card[]
): HighlightEvent | null {
  const dramaScore = calculateDramaScore('bubble_elimination', potAmount, {});

  return {
    type: 'bubble_elimination',
    tableId,
    handId,
    primaryAgentId: eliminatedId,
    secondaryAgentId: winnerId,
    potAmount,
    betAmount: potAmount,
    dramaScore,
    details: {
      loserCards: eliminatedCards,
      context: 'near_elimination',
    },
  };
}

/**
 * 블러프 감지 (성공/실패)
 */
export function detectBluff(
  tableId: string,
  handId: string,
  blufferId: string,
  callerId: string,
  potAmount: number,
  blufferCards: Card[],
  communityCards: Card[],
  success: boolean
): HighlightEvent | null {
  // 블러프 여부 판단: 핸드 랭크가 낮은데 베팅이 큰 경우
  const handStrength = evaluateHandStrength(blufferCards, communityCards);
  
  // 미디엄 이상의 핸드는 블러프로 간주하지 않음
  if (handStrength > 0.4) return null;

  const type: HighlightType = success ? 'bluff_success' : 'bluff_failure';
  
  const dramaScore = calculateDramaScore(type, potAmount, {
    handStrength,
  });

  return {
    type,
    tableId,
    handId,
    primaryAgentId: blufferId,
    secondaryAgentId: callerId,
    potAmount,
    betAmount: potAmount,
    dramaScore,
    details: {
      winnerCards: blufferCards,
      communityCards,
      context: success ? 'bluff_uncalled' : 'bluff_called',
    },
  };
}

/**
 * 배드비트 감지 (좋은 패가 졌을 때)
 */
export function detectBadBeat(
  tableId: string,
  handId: string,
  loserId: string,
  winnerId: string,
  potAmount: number,
  loserCards: Card[],
  winnerCards: Card[],
  communityCards: Card[],
  loserHandRank: string,
  winnerHandRank: string
): HighlightEvent | null {
  // 배드비트 조건: 패자의 핸드가 퀸즈 풀하우스 이상
  const isBadBeat = isStrongHand(loserHandRank) && 
    compareHandRanks(loserHandRank, winnerHandRank) > 0;

  if (!isBadBeat) return null;

  const dramaScore = calculateDramaScore('bad_beat', potAmount, {
    loserHandRank,
    winnerHandRank,
  });

  return {
    type: 'bad_beat',
    tableId,
    handId,
    primaryAgentId: loserId,
    secondaryAgentId: winnerId,
    potAmount,
    betAmount: potAmount,
    dramaScore,
    details: {
      loserCards,
      winnerCards,
      communityCards,
      winnerHandRank,
      loserHandRank,
      context: 'bad_beat',
    },
  };
}

/**
 * 쿨러 감지 (양쪽 다 좋은 패)
 */
export function detectCooler(
  tableId: string,
  handId: string,
  winnerId: string,
  loserId: string,
  potAmount: number,
  winnerCards: Card[],
  loserCards: Card[],
  communityCards: Card[],
  winnerHandRank: string,
  loserHandRank: string
): HighlightEvent | null {
  // 쿨러 조건: 양쪽 다 스트레이트 이상
  const isCooler = isStrongHand(winnerHandRank) && isStrongHand(loserHandRank);

  if (!isCooler) return null;

  const dramaScore = calculateDramaScore('cooler', potAmount, {
    winnerHandRank,
    loserHandRank,
  });

  return {
    type: 'cooler',
    tableId,
    handId,
    primaryAgentId: winnerId,
    secondaryAgentId: loserId,
    potAmount,
    betAmount: potAmount,
    dramaScore,
    details: {
      winnerCards,
      loserCards,
      communityCards,
      winnerHandRank,
      loserHandRank,
      context: 'cooler',
    },
  };
}

// ========================================
// Storage
// ========================================

// 인메모리 스토리지 (Supabase 연결 안 될 때 사용)
const inMemoryHighlights: HighlightEvent[] = [];

export async function saveHighlight(event: HighlightEvent): Promise<boolean> {
  const supabase = getSupabaseClient();

  // Supabase 저장 시도
  if (supabase) {
    try {
      const { error } = await supabase.from('highlights').insert({
        type: event.type,
        table_id: event.tableId,
        hand_id: event.handId,
        primary_agent_id: event.primaryAgentId,
        secondary_agent_id: event.secondaryAgentId,
        pot_amount: event.potAmount,
        bet_amount: event.betAmount,
        drama_score: event.dramaScore,
        details: event.details,
      });

      if (error) {
        console.error('[Highlight] Supabase insert error:', error);
        // 폴백: 인메모리 저장
        inMemoryHighlights.push(event);
        return true;
      }

      console.log(`[Highlight] Saved: ${event.type} (${event.dramaScore} drama)`);
      return true;
    } catch (err) {
      console.error('[Highlight] Failed to save:', err);
      inMemoryHighlights.push(event);
      return true;
    }
  }

  // 인메모리 저장
  inMemoryHighlights.push(event);
  console.log(`[Highlight] Saved to memory: ${event.type} (${event.dramaScore} drama)`);
  return true;
}

export async function getHighlights(
  options: {
    tableId?: string;
    agentId?: string;
    type?: HighlightType;
    limit?: number;
    minDramaScore?: number;
  } = {}
): Promise<HighlightEvent[]> {
  const { tableId, agentId, type, limit = 50, minDramaScore = 0 } = options;

  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      let query = supabase
        .from('highlights')
        .select('*')
        .gte('drama_score', minDramaScore)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (tableId) query = query.eq('table_id', tableId);
      if (agentId) query = query.eq('primary_agent_id', agentId);
      if (type) query = query.eq('type', type);

      const { data, error } = await query;

      if (error) {
        console.error('[Highlight] Query error:', error);
        return filterInMemoryHighlights(options);
      }

      return data?.map(rowToHighlightEvent) || [];
    } catch (err) {
      console.error('[Highlight] Failed to fetch:', err);
      return filterInMemoryHighlights(options);
    }
  }

  return filterInMemoryHighlights(options);
}

function filterInMemoryHighlights(
  options: {
    tableId?: string;
    agentId?: string;
    type?: HighlightType;
    limit?: number;
    minDramaScore?: number;
  }
): HighlightEvent[] {
  const { tableId, agentId, type, limit = 50, minDramaScore = 0 } = options;

  return inMemoryHighlights
    .filter(h => !tableId || h.tableId === tableId)
    .filter(h => !agentId || h.primaryAgentId === agentId)
    .filter(h => !type || h.type === type)
    .filter(h => h.dramaScore >= minDramaScore)
    .sort((a, b) => b.dramaScore - a.dramaScore)
    .slice(0, limit);
}

function rowToHighlightEvent(row: any): HighlightEvent {
  return {
    type: row.type,
    tableId: row.table_id,
    handId: row.hand_id,
    primaryAgentId: row.primary_agent_id,
    secondaryAgentId: row.secondary_agent_id,
    potAmount: row.pot_amount,
    betAmount: row.bet_amount,
    dramaScore: row.drama_score,
    details: row.details || {},
  };
}

// ========================================
// Helper Functions
// ========================================

function calculateDramaScore(
  type: HighlightType,
  potAmount: number,
  context: Record<string, any>
): number {
  let baseScore = 50;

  // 타입별 기본 점수
  switch (type) {
    case 'comeback_win':
      baseScore = 90;
      break;
    case 'bad_beat':
      baseScore = 85;
      break;
    case 'all_in':
      baseScore = 70;
      break;
    case 'cooler':
      baseScore = 75;
      break;
    case 'bubble_elimination':
      baseScore = 65;
      break;
    case 'bluff_success':
      baseScore = 60;
      break;
    case 'bluff_failure':
      baseScore = 55;
      break;
    case 'biggest_pot':
      baseScore = 80;
      break;
    default:
      baseScore = 50;
  }

  // 팟 크기 복수
  let multiplier = 1.0;
  if (potAmount > 10000) multiplier = 1.5;
  else if (potAmount > 5000) multiplier = 1.3;
  else if (potAmount > 1000) multiplier = 1.1;

  // 컨텍스트 별점
  if (context.turnAround) baseScore += 10;
  if (context.isMultipleAllIn) baseScore += 5;
  if (context.isRecord) baseScore += 10;

  return Math.min(100, Math.floor(baseScore * multiplier));
}

function detectTurnAround(
  winnerCards: Card[],
  loserCards: Card[],
  communityCards: Card[]
): boolean {
  // 간단한 역전 감지: 리버까지 갔고 승자의 핸드가 플롭때보다 좋아졌는지
  // 실제로는 각 단계별 승률 계산이 필요함
  if (communityCards.length < 5) return false;

  const winnerStrength = evaluateHandStrength(winnerCards, communityCards);
  const loserStrength = evaluateHandStrength(loserCards, communityCards);

  // 승자가 역전한 경우 (같은 스트렝스면 카드 높이로)
  return winnerStrength >= loserStrength;
}

function evaluateHandStrength(holeCards: Card[], communityCards: Card[]): number {
  // 간단한 핸드 스트렝스 계산 (0-1)
  // 실제로는 포커 핸드 평가 로직 필요
  const allCards = [...holeCards, ...communityCards];
  
  // 페어 체크
  const ranks = allCards.map(c => c.rank);
  const rankCounts = new Map<string, number>();
  ranks.forEach(r => rankCounts.set(r, (rankCounts.get(r) || 0) + 1));
  
  const maxCount = Math.max(...Array.from(rankCounts.values()));
  
  if (maxCount >= 4) return 0.95; // Four of a kind
  if (maxCount === 3) return 0.75; // Three of a kind
  if (maxCount === 2) {
    const pairs = Array.from(rankCounts.values()).filter(c => c === 2).length;
    if (pairs >= 2) return 0.7; // Two pair
    return 0.5; // One pair
  }
  
  return 0.3; // High card
}

function isStrongHand(handRank: string): boolean {
  const strongHands = [
    'royal_flush', 'straight_flush', 'four_of_a_kind',
    'full_house', 'flush', 'straight'
  ];
  return strongHands.includes(handRank.toLowerCase());
}

function compareHandRanks(rank1: string, rank2: string): number {
  const hierarchy = [
    'high_card', 'pair', 'two_pair', 'three_of_a_kind',
    'straight', 'flush', 'full_house', 'four_of_a_kind',
    'straight_flush', 'royal_flush'
  ];
  
  const idx1 = hierarchy.indexOf(rank1.toLowerCase());
  const idx2 = hierarchy.indexOf(rank2.toLowerCase());
  
  return idx1 - idx2;
}

// ========================================
// Export for Server Integration
// ========================================

export {
  tableHighlightStates,
  inMemoryHighlights,
};
