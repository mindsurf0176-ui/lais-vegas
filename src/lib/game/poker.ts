// ========================================
// AI Casino - Texas Hold'em Poker Logic
// ========================================

import { Card, Suit, Rank, HandRank, HandResult, Player, SidePot } from '@/types';
import crypto from 'crypto';

// ========================================
// Deck Management (Provably Fair)
// ========================================

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

// Provably Fair Shuffle using server seed + client seed
export function shuffleDeck(deck: Card[], serverSeed: string, clientSeed: string): { shuffled: Card[], hash: string } {
  const combinedSeed = `${serverSeed}:${clientSeed}`;
  const hash = crypto.createHash('sha256').update(combinedSeed).digest('hex');
  
  // Fisher-Yates shuffle with deterministic random from hash
  const shuffled = [...deck];
  let hashIndex = 0;
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    // Use hash bytes to generate random indices
    const byte1 = parseInt(hash.slice(hashIndex, hashIndex + 2), 16);
    const byte2 = parseInt(hash.slice(hashIndex + 2, hashIndex + 4), 16);
    const randomValue = (byte1 * 256 + byte2) / 65536;
    const j = Math.floor(randomValue * (i + 1));
    
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    hashIndex = (hashIndex + 4) % 60; // Cycle through hash
  }
  
  return { shuffled, hash };
}

// Generate server seed (kept secret until hand ends)
export function generateServerSeed(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ========================================
// Hand Evaluation
// ========================================

const RANK_VALUES: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

const HAND_RANK_VALUES: Record<HandRank, number> = {
  'high_card': 1,
  'pair': 2,
  'two_pair': 3,
  'three_of_a_kind': 4,
  'straight': 5,
  'flush': 6,
  'full_house': 7,
  'four_of_a_kind': 8,
  'straight_flush': 9,
  'royal_flush': 10
};

export function evaluateHand(holeCards: Card[], communityCards: Card[]): HandResult {
  const allCards = [...holeCards, ...communityCards];
  const combinations = getCombinations(allCards, 5);
  
  let bestHand: HandResult | null = null;
  
  for (const combo of combinations) {
    const result = evaluateFiveCards(combo);
    if (!bestHand || result.value > bestHand.value) {
      bestHand = result;
    }
  }
  
  return bestHand!;
}

function getCombinations<T>(arr: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (arr.length === 0) return [];
  
  const [first, ...rest] = arr;
  const withFirst = getCombinations(rest, size - 1).map(combo => [first, ...combo]);
  const withoutFirst = getCombinations(rest, size);
  
  return [...withFirst, ...withoutFirst];
}

function evaluateFiveCards(cards: Card[]): HandResult {
  const sorted = [...cards].sort((a, b) => RANK_VALUES[b.rank] - RANK_VALUES[a.rank]);
  
  const isFlush = cards.every(c => c.suit === cards[0].suit);
  const isStraight = checkStraight(sorted);
  
  const rankCounts = new Map<Rank, number>();
  for (const card of cards) {
    rankCounts.set(card.rank, (rankCounts.get(card.rank) || 0) + 1);
  }
  
  const counts = Array.from(rankCounts.values()).sort((a, b) => b - a);
  
  // Royal Flush
  if (isFlush && isStraight && sorted[0].rank === 'A' && sorted[1].rank === 'K') {
    return { rank: 'royal_flush', cards: sorted, value: calculateValue('royal_flush', sorted), description: 'Royal Flush' };
  }
  
  // Straight Flush
  if (isFlush && isStraight) {
    return { rank: 'straight_flush', cards: sorted, value: calculateValue('straight_flush', sorted), description: `Straight Flush, ${sorted[0].rank} high` };
  }
  
  // Four of a Kind
  if (counts[0] === 4) {
    return { rank: 'four_of_a_kind', cards: sorted, value: calculateValue('four_of_a_kind', sorted), description: 'Four of a Kind' };
  }
  
  // Full House
  if (counts[0] === 3 && counts[1] === 2) {
    return { rank: 'full_house', cards: sorted, value: calculateValue('full_house', sorted), description: 'Full House' };
  }
  
  // Flush
  if (isFlush) {
    return { rank: 'flush', cards: sorted, value: calculateValue('flush', sorted), description: `Flush, ${sorted[0].rank} high` };
  }
  
  // Straight
  if (isStraight) {
    return { rank: 'straight', cards: sorted, value: calculateValue('straight', sorted), description: `Straight, ${sorted[0].rank} high` };
  }
  
  // Three of a Kind
  if (counts[0] === 3) {
    return { rank: 'three_of_a_kind', cards: sorted, value: calculateValue('three_of_a_kind', sorted), description: 'Three of a Kind' };
  }
  
  // Two Pair
  if (counts[0] === 2 && counts[1] === 2) {
    return { rank: 'two_pair', cards: sorted, value: calculateValue('two_pair', sorted), description: 'Two Pair' };
  }
  
  // Pair
  if (counts[0] === 2) {
    return { rank: 'pair', cards: sorted, value: calculateValue('pair', sorted), description: 'Pair' };
  }
  
  // High Card
  return { rank: 'high_card', cards: sorted, value: calculateValue('high_card', sorted), description: `High Card, ${sorted[0].rank}` };
}

function checkStraight(sorted: Card[]): boolean {
  const values = sorted.map(c => RANK_VALUES[c.rank]);
  
  // Check normal straight
  for (let i = 0; i < values.length - 1; i++) {
    if (values[i] - values[i + 1] !== 1) {
      // Check wheel (A-2-3-4-5)
      if (values[0] === 14 && values[1] === 5 && values[2] === 4 && values[3] === 3 && values[4] === 2) {
        return true;
      }
      return false;
    }
  }
  return true;
}

function calculateValue(rank: HandRank, cards: Card[]): number {
  const baseValue = HAND_RANK_VALUES[rank] * 10000000;
  const cardValues = cards.map(c => RANK_VALUES[c.rank]);
  const cardValue = cardValues.reduce((acc, v, i) => acc + v * Math.pow(15, 4 - i), 0);
  return baseValue + cardValue;
}

// ========================================
// Pot Management
// ========================================

export function calculateSidePots(players: Player[]): SidePot[] {
  const activePlayers = players.filter(p => !p.is_folded && p.bet > 0);
  if (activePlayers.length === 0) return [];
  
  const bets = [...new Set(activePlayers.map(p => p.bet))].sort((a, b) => a - b);
  const sidePots: SidePot[] = [];
  let previousBet = 0;
  
  for (const bet of bets) {
    const eligiblePlayers = activePlayers
      .filter(p => p.bet >= bet)
      .map(p => p.agent_id);
    
    const amount = (bet - previousBet) * eligiblePlayers.length;
    if (amount > 0) {
      sidePots.push({ amount, eligible_players: eligiblePlayers });
    }
    previousBet = bet;
  }
  
  return sidePots;
}

// ========================================
// Winner Determination
// ========================================

export interface WinnerResult {
  agent_id: string;
  amount: number;
  hand: HandResult;
}

export function determineWinners(
  players: Player[],
  communityCards: Card[],
  pot: number,
  sidePots: SidePot[]
): WinnerResult[] {
  const activePlayers = players.filter(p => !p.is_folded);
  
  if (activePlayers.length === 1) {
    return [{
      agent_id: activePlayers[0].agent_id,
      amount: pot,
      hand: evaluateHand(activePlayers[0].cards, communityCards)
    }];
  }
  
  // Evaluate all hands
  const hands = activePlayers.map(p => ({
    player: p,
    hand: evaluateHand(p.cards, communityCards)
  }));
  
  // Sort by hand value
  hands.sort((a, b) => b.hand.value - a.hand.value);
  
  const winners: WinnerResult[] = [];
  
  // Main pot (all eligible players)
  const mainPotWinners = hands.filter(h => h.hand.value === hands[0].hand.value);
  const mainPotShare = Math.floor(pot / mainPotWinners.length);
  
  for (const winner of mainPotWinners) {
    winners.push({
      agent_id: winner.player.agent_id,
      amount: mainPotShare,
      hand: winner.hand
    });
  }
  
  // Handle side pots similarly (simplified)
  // TODO: Full side pot logic
  
  return winners;
}

// ========================================
// Game Actions
// ========================================

export function getMinRaise(currentBet: number, bigBlind: number): number {
  return currentBet + bigBlind;
}

export function getValidActions(
  player: Player,
  currentBet: number,
  bigBlind: number
): { action: string; minAmount?: number; maxAmount?: number }[] {
  const actions: { action: string; minAmount?: number; maxAmount?: number }[] = [];
  
  // Fold is always available
  actions.push({ action: 'fold' });
  
  // Check if no bet to call
  if (currentBet === player.bet) {
    actions.push({ action: 'check' });
  } else {
    // Call
    const callAmount = currentBet - player.bet;
    if (callAmount <= player.chips) {
      actions.push({ action: 'call', minAmount: callAmount, maxAmount: callAmount });
    }
  }
  
  // Raise
  const minRaise = getMinRaise(currentBet, bigBlind);
  if (player.chips > minRaise - player.bet) {
    actions.push({
      action: 'raise',
      minAmount: minRaise,
      maxAmount: player.chips + player.bet
    });
  }
  
  // All-in
  if (player.chips > 0) {
    actions.push({ action: 'all_in', minAmount: player.chips, maxAmount: player.chips });
  }
  
  return actions;
}

// ========================================
// Rake Calculation
// ========================================

export function calculateRake(pot: number, rakePercent: number = 5, maxRake: number = 100): number {
  const rake = Math.floor(pot * (rakePercent / 100));
  return Math.min(rake, maxRake);
}
