// ========================================
// Conservative Bot - "The Rock"
// ========================================
// Only plays premium hands
// Rarely bluffs
// Prefers to check/call rather than raise
// ========================================

import { GameState, BotAction, BotConfig } from './types';
import { getPreflopStrength, getPostflopStrength } from './handStrength';

export const config: BotConfig = {
  name: 'CautiousCarl',
  description: 'A tight and cautious player who only plays premium hands.',
  personality: `
    I am CautiousCarl, a patient and disciplined poker player.
    I believe in waiting for the right opportunities.
    I rarely bluff and prefer to show down strong hands.
    "Patience is a virtue in poker."
  `,
};

export function decide(state: GameState): BotAction {
  const { phase, myCards, communityCards, pot, myChips, myBet, currentBet } = state;
  
  const callAmount = currentBet - myBet;
  const potOdds = callAmount / (pot + callAmount);
  
  // ========================================
  // Preflop Strategy (Very Tight)
  // ========================================
  if (phase === 'preflop') {
    const strength = getPreflopStrength(myCards);
    
    // Premium hands only (top 10%)
    if (strength >= 80) {
      // AA, KK, QQ, AK - 3-bet/raise
      if (currentBet === 0 || currentBet <= 20) {
        return { action: 'raise', amount: Math.min(currentBet * 3 + 20, myChips) };
      }
      // Facing a raise - just call
      return { action: 'call' };
    }
    
    // Strong hands (top 15%)
    if (strength >= 65) {
      // JJ, TT, AQ, AJs - call or small raise
      if (currentBet === 0) {
        return { action: 'raise', amount: 30 };
      }
      if (callAmount <= myChips * 0.1) {
        return { action: 'call' };
      }
      return { action: 'fold' };
    }
    
    // Medium hands (top 25%)
    if (strength >= 50) {
      // 99-77, KQs, ATs - limp in or cheap call
      if (callAmount === 0) {
        return { action: 'check' };
      }
      if (callAmount <= myChips * 0.05) {
        return { action: 'call' };
      }
      return { action: 'fold' };
    }
    
    // Everything else - fold or check if free
    if (callAmount === 0) {
      return { action: 'check' };
    }
    return { action: 'fold' };
  }
  
  // ========================================
  // Postflop Strategy (Passive)
  // ========================================
  const strength = getPostflopStrength(myCards, communityCards);
  
  // Very strong hand (two pair+)
  if (strength >= 70) {
    // Value bet
    if (currentBet === 0) {
      return { action: 'raise', amount: Math.floor(pot * 0.5) };
    }
    // Call raises
    return { action: 'call' };
  }
  
  // Strong hand (top pair with good kicker)
  if (strength >= 50) {
    if (currentBet === 0) {
      // Check to trap
      return { action: 'check' };
    }
    // Call small bets
    if (potOdds <= 0.3) {
      return { action: 'call' };
    }
    return { action: 'fold' };
  }
  
  // Medium hand (pair, draw)
  if (strength >= 35) {
    if (currentBet === 0) {
      return { action: 'check' };
    }
    // Only call with good pot odds
    if (potOdds <= 0.2) {
      return { action: 'call' };
    }
    return { action: 'fold' };
  }
  
  // Weak hand
  if (currentBet === 0) {
    return { action: 'check' };
  }
  return { action: 'fold' };
}

// Chat messages (rarely talks)
export function chat(state: GameState, event: string): string | null {
  if (Math.random() > 0.1) return null; // 90% silent
  
  switch (event) {
    case 'win':
      return 'Patience pays off.';
    case 'lose':
      return null; // Silent loser
    case 'big_pot':
      return 'Interesting...';
    default:
      return null;
  }
}
