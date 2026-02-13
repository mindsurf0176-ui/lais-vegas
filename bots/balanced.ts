// ========================================
// Balanced Bot - "GTO Wannabe"
// ========================================
// Tries to play a balanced strategy
// Mixes up actions to be unpredictable
// Adjusts based on stack sizes and pot odds
// ========================================

import { GameState, BotAction, BotConfig } from './types';
import { getPreflopStrength, getPostflopStrength } from './handStrength';

export const config: BotConfig = {
  name: 'BalancedBen',
  description: 'A balanced player who mixes up their strategy to stay unpredictable.',
  personality: `
    I am BalancedBen, aspiring to play optimal poker.
    I believe in mixing up my actions to remain unpredictable.
    Every decision is based on math and game theory.
    "In the long run, the math always wins."
  `,
};

export function decide(state: GameState): BotAction {
  const { phase, myCards, communityCards, pot, myChips, myBet, currentBet, players } = state;
  
  const callAmount = currentBet - myBet;
  const potOdds = callAmount / (pot + callAmount);
  const stackToPot = myChips / Math.max(pot, 1);
  const activePlayers = players.filter(p => !p.isFolded).length;
  
  // Mix factor (0-1) for action selection
  const mix = Math.random();
  
  // ========================================
  // Preflop Strategy (Balanced Ranges)
  // ========================================
  if (phase === 'preflop') {
    const strength = getPreflopStrength(myCards);
    
    // Premium (top 5%) - Always raising
    if (strength >= 82) {
      const raiseSize = currentBet === 0 
        ? Math.min(30, myChips)
        : Math.min(currentBet * 3, myChips);
      return { action: 'raise', amount: raiseSize, reasoning: `Premium hand (${strength}%), standard value raise.` };
    }
    
    // Strong (top 15%) - Raise 70%, Call 30%
    if (strength >= 65) {
      if (callAmount === 0) {
        return { action: 'raise', amount: Math.min(25, myChips), reasoning: `Strong hand, opening raise.` };
      }
      if (callAmount <= myChips * 0.12) {
        return mix > 0.3
          ? { action: 'raise', amount: Math.min(currentBet * 2.5, myChips), reasoning: `Strong hand, 3-betting for value (70% of the time).` }
          : { action: 'call', reasoning: `Strong hand, flatting to balance my range.` };
      }
      return { action: 'call', reasoning: `Priced in, calling.` };
    }
    
    // Playable (top 30%) - Raise 30%, Call 50%, Fold 20%
    if (strength >= 45) {
      if (callAmount === 0) {
        return mix > 0.5 
          ? { action: 'raise', amount: Math.min(20, myChips), reasoning: `Playable hand, raising to steal or build pot.` }
          : { action: 'check', reasoning: `Checking to mix up my play.` };
      }
      if (callAmount <= myChips * 0.08) {
        if (mix > 0.7) return { action: 'raise', amount: Math.min(currentBet * 2.5, myChips), reasoning: `Mixing in raises with my calling range.` };
        if (mix > 0.2) return { action: 'call', reasoning: `Calling with speculative hand for implied odds.` };
        return { action: 'fold', reasoning: `Folding some playable hands to stay balanced.` };
      }
      return { action: 'fold', reasoning: `Price too high for speculative hand.` };
    }
    
    // Marginal (top 50%) - Occasional defend
    if (strength >= 30) {
      if (callAmount === 0) {
        return { action: 'check', reasoning: `Marginal hand, checking.` };
      }
      if (callAmount <= myChips * 0.04 && mix > 0.6) {
        return { action: 'call' };
      }
      return { action: 'fold' };
    }
    
    // Junk - Fold (but occasional steal in position)
    if (callAmount === 0 && activePlayers <= 2 && mix > 0.8) {
      return { action: 'raise', amount: Math.min(25, myChips) };
    }
    if (callAmount === 0) {
      return { action: 'check' };
    }
    return { action: 'fold' };
  }
  
  // ========================================
  // Postflop Strategy (Mixed)
  // ========================================
  const strength = getPostflopStrength(myCards, communityCards);
  
  // Determine action frequency based on strength
  let raiseFreq: number, callFreq: number;
  let betSize: number;
  
  if (strength >= 75) {
    // Nuts/near-nuts: Bet/raise frequently
    raiseFreq = 0.8;
    callFreq = 0.95;
    betSize = pot * 0.75;
  } else if (strength >= 55) {
    // Strong: Value bet, call raises
    raiseFreq = 0.5;
    callFreq = 0.85;
    betSize = pot * 0.6;
  } else if (strength >= 40) {
    // Medium: Mix of bet/check, call with odds
    raiseFreq = 0.25;
    callFreq = potOdds < 0.35 ? 0.7 : 0.3;
    betSize = pot * 0.5;
  } else if (strength >= 25) {
    // Weak draw/pair: Check, call with great odds
    raiseFreq = 0.1;
    callFreq = potOdds < 0.25 ? 0.5 : 0.15;
    betSize = pot * 0.4;
  } else {
    // Air: Occasional bluff
    raiseFreq = 0.12;
    callFreq = 0.05;
    betSize = pot * 0.6;
  }
  
  // Adjust for stack-to-pot ratio
  if (stackToPot < 2) {
    // Short stacked - more all-ins
    if (strength >= 50 && mix > 0.4) {
      return { action: 'all_in' };
    }
  }
  
  // Execute action
  if (currentBet === 0) {
    // We can bet or check
    if (mix < raiseFreq) {
      return { action: 'raise', amount: Math.min(Math.floor(betSize), myChips) };
    }
    return { action: 'check' };
  } else {
    // Facing a bet
    if (mix < raiseFreq * 0.6) {
      // Raise
      return { action: 'raise', amount: Math.min(currentBet * 2.5, myChips) };
    }
    if (mix < callFreq) {
      // Call
      if (callAmount <= myChips) {
        return { action: 'call' };
      }
      return { action: 'all_in' };
    }
    return { action: 'fold' };
  }
}

// Chat messages (witty and friendly)
export function chat(state: GameState, event: string): string | null {
  const messages: Record<string, string[]> = {
    'win': [
      'gg wp 🤝',
      'That worked out nicely',
      'Smooth',
      'Thanks for playing!',
      'Standard line, standard result',
    ],
    'lose': [
      'gg',
      'Nice hand!',
      'Well played 👏',
      'Can\'t win them all',
    ],
    'all_in': [
      'Here we go!',
      'Let\'s see a flop... oh wait 😅',
      'YOLO? No, this is calculated.',
      'Big decision time',
    ],
    'big_raise': [
      'Let\'s make this interesting',
      'Building the pot 🏗️',
      'Raise for value',
    ],
    'raise': [
      'Bump it',
      'A little more',
    ],
    'fold': [
      'Not this time',
      'I\'ll wait for a better spot',
      'Live to fight another hand',
    ],
  };
  
  const options = messages[event];
  if (!options || Math.random() > 0.4) return null;  // 40% 확률
  
  return options[Math.floor(Math.random() * options.length)];
}
