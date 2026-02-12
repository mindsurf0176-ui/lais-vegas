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
        return { 
          action: 'raise', 
          amount: Math.min(currentBet * 3 + 20, myChips),
          reasoning: `Premium hand (${strength}%), building pot with raise.`
        };
      }
      // Facing a raise - just call
      return { action: 'call', reasoning: `Premium hand but facing aggression, calling to see flop.` };
    }
    
    // Strong hands (top 15%)
    if (strength >= 65) {
      // JJ, TT, AQ, AJs - call or small raise
      if (currentBet === 0) {
        return { action: 'raise', amount: 30, reasoning: `Strong hand (${strength}%), opening with standard raise.` };
      }
      if (callAmount <= myChips * 0.1) {
        return { action: 'call', reasoning: `Strong hand, pot odds favorable at ${(potOdds * 100).toFixed(0)}%.` };
      }
      return { action: 'fold', reasoning: `Strong hand but price too high relative to stack.` };
    }
    
    // Medium hands (top 25%)
    if (strength >= 50) {
      // 99-77, KQs, ATs - limp in or cheap call
      if (callAmount === 0) {
        return { action: 'check', reasoning: `Medium hand, checking to see flop cheaply.` };
      }
      if (callAmount <= myChips * 0.05) {
        return { action: 'call', reasoning: `Medium hand, calling small bet for implied odds.` };
      }
      return { action: 'fold', reasoning: `Medium hand not worth the price, folding.` };
    }
    
    // Everything else - fold or check if free
    if (callAmount === 0) {
      return { action: 'check', reasoning: `Weak hand, checking for free card.` };
    }
    return { action: 'fold', reasoning: `Weak hand, not worth investing chips.` };
  }
  
  // ========================================
  // Postflop Strategy (Passive)
  // ========================================
  const strength = getPostflopStrength(myCards, communityCards);
  
  // Very strong hand (two pair+)
  if (strength >= 70) {
    // Value bet
    if (currentBet === 0) {
      return { 
        action: 'raise', 
        amount: Math.floor(pot * 0.5),
        reasoning: `Strong made hand (${strength}%), value betting half pot.`
      };
    }
    // Call raises
    return { action: 'call', reasoning: `Strong hand, calling to extract value.` };
  }
  
  // Strong hand (top pair with good kicker)
  if (strength >= 50) {
    if (currentBet === 0) {
      // Check to trap
      return { action: 'check', reasoning: `Top pair, checking to trap aggressive opponents.` };
    }
    // Call small bets
    if (potOdds <= 0.3) {
      return { action: 'call', reasoning: `Top pair with good pot odds (${(potOdds * 100).toFixed(0)}%), calling.` };
    }
    return { action: 'fold', reasoning: `Top pair but pot odds unfavorable, folding to aggression.` };
  }
  
  // Medium hand (pair, draw)
  if (strength >= 35) {
    if (currentBet === 0) {
      return { action: 'check', reasoning: `Medium hand, checking to control pot size.` };
    }
    // Only call with good pot odds
    if (potOdds <= 0.2) {
      return { action: 'call', reasoning: `Drawing hand with good implied odds, calling.` };
    }
    return { action: 'fold', reasoning: `Medium hand, pot odds don't justify the call.` };
  }
  
  // Weak hand
  if (currentBet === 0) {
    return { action: 'check', reasoning: `Weak hand, checking to see free cards.` };
  }
  return { action: 'fold', reasoning: `Weak hand, giving up to aggression.` };
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
