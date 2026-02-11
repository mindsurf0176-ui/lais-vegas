// ========================================
// Hand Strength Evaluator for Bots
// ========================================

import { Card } from './types';

const RANK_VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

// ========================================
// Preflop Hand Strength (0-100)
// ========================================

export function getPreflopStrength(cards: Card[]): number {
  if (cards.length !== 2) return 0;
  
  const [c1, c2] = cards;
  const r1 = RANK_VALUES[c1.rank];
  const r2 = RANK_VALUES[c2.rank];
  const high = Math.max(r1, r2);
  const low = Math.min(r1, r2);
  const suited = c1.suit === c2.suit;
  const paired = r1 === r2;
  
  // Premium pairs (AA, KK, QQ, JJ)
  if (paired && high >= 11) {
    return 85 + (high - 11) * 5; // 85-100
  }
  
  // Medium pairs (TT-77)
  if (paired && high >= 7) {
    return 65 + (high - 7) * 5; // 65-80
  }
  
  // Low pairs (66-22)
  if (paired) {
    return 45 + (high - 2) * 4; // 45-61
  }
  
  // AK suited/unsuited
  if (high === 14 && low === 13) {
    return suited ? 82 : 78;
  }
  
  // AQ, AJ suited/unsuited
  if (high === 14 && low >= 11) {
    return suited ? 70 + (low - 11) * 5 : 65 + (low - 11) * 4;
  }
  
  // Ax suited
  if (high === 14 && suited) {
    return 55 + (low - 2) * 2;
  }
  
  // KQ suited/unsuited
  if (high === 13 && low === 12) {
    return suited ? 68 : 62;
  }
  
  // Suited connectors
  if (suited && high - low === 1) {
    return 40 + high * 2;
  }
  
  // Suited one-gappers
  if (suited && high - low === 2 && high >= 7) {
    return 35 + high * 1.5;
  }
  
  // Face cards
  if (high >= 11 && low >= 10) {
    return suited ? 55 : 45;
  }
  
  // High cards
  if (high >= 12) {
    return suited ? 35 : 28;
  }
  
  // Everything else
  return suited ? 25 : 18;
}

// ========================================
// Postflop Hand Strength (simplified)
// ========================================

export function getPostflopStrength(holeCards: Card[], communityCards: Card[]): number {
  const allCards = [...holeCards, ...communityCards];
  
  const handRank = evaluateHandRank(allCards);
  const baseStrength = handRank.strength;
  
  // Adjust for draws
  const drawStrength = evaluateDraws(holeCards, communityCards);
  
  return Math.min(100, baseStrength + drawStrength * 0.3);
}

interface HandRankResult {
  rank: string;
  strength: number;
}

function evaluateHandRank(cards: Card[]): HandRankResult {
  const suits = cards.map(c => c.suit);
  const ranks = cards.map(c => RANK_VALUES[c.rank]).sort((a, b) => b - a);
  
  // Count ranks
  const rankCounts = new Map<number, number>();
  for (const r of ranks) {
    rankCounts.set(r, (rankCounts.get(r) || 0) + 1);
  }
  const counts = Array.from(rankCounts.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  
  // Check flush
  const suitCounts = new Map<string, number>();
  for (const s of suits) {
    suitCounts.set(s, (suitCounts.get(s) || 0) + 1);
  }
  const hasFlush = Array.from(suitCounts.values()).some(c => c >= 5);
  
  // Check straight
  const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);
  const hasStraight = checkStraight(uniqueRanks);
  
  // Four of a kind
  if (counts[0][1] >= 4) {
    return { rank: 'four_of_a_kind', strength: 95 };
  }
  
  // Full house
  if (counts[0][1] >= 3 && counts.length > 1 && counts[1][1] >= 2) {
    return { rank: 'full_house', strength: 88 };
  }
  
  // Flush
  if (hasFlush) {
    return { rank: 'flush', strength: 82 };
  }
  
  // Straight
  if (hasStraight) {
    return { rank: 'straight', strength: 78 };
  }
  
  // Three of a kind
  if (counts[0][1] >= 3) {
    return { rank: 'three_of_a_kind', strength: 65 };
  }
  
  // Two pair
  if (counts[0][1] >= 2 && counts.length > 1 && counts[1][1] >= 2) {
    return { rank: 'two_pair', strength: 55 };
  }
  
  // Pair
  if (counts[0][1] >= 2) {
    const pairRank = counts[0][0];
    // Top pair, middle pair, or bottom pair?
    const boardRanks = cards.slice(2).map(c => RANK_VALUES[c.rank]).sort((a, b) => b - a);
    if (pairRank >= boardRanks[0]) {
      return { rank: 'top_pair', strength: 45 + (pairRank / 14) * 10 };
    } else if (pairRank >= (boardRanks[1] || 0)) {
      return { rank: 'middle_pair', strength: 35 + (pairRank / 14) * 8 };
    }
    return { rank: 'bottom_pair', strength: 28 };
  }
  
  // High card
  return { rank: 'high_card', strength: 15 + (ranks[0] / 14) * 15 };
}

function checkStraight(sortedRanks: number[]): boolean {
  if (sortedRanks.length < 5) return false;
  
  let consecutive = 1;
  for (let i = 0; i < sortedRanks.length - 1; i++) {
    if (sortedRanks[i] - sortedRanks[i + 1] === 1) {
      consecutive++;
      if (consecutive >= 5) return true;
    } else if (sortedRanks[i] !== sortedRanks[i + 1]) {
      consecutive = 1;
    }
  }
  
  // Check wheel (A-2-3-4-5)
  if (sortedRanks.includes(14) && sortedRanks.includes(2) && 
      sortedRanks.includes(3) && sortedRanks.includes(4) && sortedRanks.includes(5)) {
    return true;
  }
  
  return false;
}

function evaluateDraws(holeCards: Card[], communityCards: Card[]): number {
  const allCards = [...holeCards, ...communityCards];
  let drawStrength = 0;
  
  // Flush draw (4 to a flush)
  const suitCounts = new Map<string, number>();
  for (const c of allCards) {
    suitCounts.set(c.suit, (suitCounts.get(c.suit) || 0) + 1);
  }
  if (Array.from(suitCounts.values()).some(c => c === 4)) {
    drawStrength += 25; // ~35% to hit
  }
  
  // Straight draw (open-ended)
  const ranks = [...new Set(allCards.map(c => RANK_VALUES[c.rank]))].sort((a, b) => a - b);
  for (let i = 0; i < ranks.length - 3; i++) {
    if (ranks[i + 3] - ranks[i] === 3) {
      drawStrength += 20; // ~31% to hit (OESD)
      break;
    }
  }
  
  return drawStrength;
}

// ========================================
// Position Evaluator
// ========================================

export function getPosition(seat: number, dealerSeat: number, numPlayers: number): 'early' | 'middle' | 'late' | 'blinds' {
  // Simplified position based on seat relative to active players
  const relativePosition = (seat - dealerSeat + numPlayers) % numPlayers;
  
  if (relativePosition <= 1) return 'blinds';
  if (relativePosition <= numPlayers * 0.33) return 'early';
  if (relativePosition <= numPlayers * 0.66) return 'middle';
  return 'late';
}
