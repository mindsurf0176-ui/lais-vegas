// ========================================
// Aggressive Bot - "The Maniac"
// ========================================
// Plays many hands
// Raises frequently
// Bluffs often
// Puts pressure on opponents
// ========================================

import { GameState, BotAction, BotConfig } from './types';
import { getPreflopStrength, getPostflopStrength } from './handStrength';

export const config: BotConfig = {
  name: 'AggroAndy',
  description: 'A loose and aggressive player who loves to raise and bluff.',
  personality: `
    I am AggroAndy, the terror of the table!
    I believe in applying maximum pressure.
    If you're not raising, you're dying.
    Fortune favors the bold! 💥
  `,
};

export function decide(state: GameState): BotAction {
  const { phase, myCards, communityCards, pot, myChips, myBet, currentBet, players } = state;
  
  const callAmount = currentBet - myBet;
  const activePlayers = players.filter(p => !p.isFolded).length;
  
  // Random factor for unpredictability
  const aggression = Math.random();
  
  // ========================================
  // Preflop Strategy (Very Loose-Aggressive)
  // ========================================
  if (phase === 'preflop') {
    const strength = getPreflopStrength(myCards);
    
    // Premium hands - 3-bet or 4-bet
    if (strength >= 75) {
      if (currentBet <= 20) {
        return { action: 'raise', amount: Math.min(currentBet * 4 + 30, myChips) };
      }
      if (currentBet <= myChips * 0.3) {
        return { action: 'raise', amount: Math.min(currentBet * 2.5, myChips) };
      }
      return { action: 'all_in' };
    }
    
    // Strong hands - raise
    if (strength >= 55) {
      if (callAmount === 0) {
        return { action: 'raise', amount: Math.min(40, myChips) };
      }
      if (callAmount <= myChips * 0.15) {
        return aggression > 0.4 
          ? { action: 'raise', amount: Math.min(currentBet * 3, myChips) }
          : { action: 'call' };
      }
      return { action: 'call' };
    }
    
    // Medium hands - steal/raise in position
    if (strength >= 35) {
      if (callAmount === 0 && activePlayers <= 3) {
        // Steal attempt
        return { action: 'raise', amount: Math.min(35, myChips) };
      }
      if (callAmount <= myChips * 0.08) {
        return aggression > 0.3 
          ? { action: 'raise', amount: Math.min(currentBet * 2.5, myChips) }
          : { action: 'call' };
      }
      return { action: 'fold' };
    }
    
    // Weak hands - occasional bluff raise
    if (aggression > 0.75 && activePlayers <= 2) {
      return { action: 'raise', amount: Math.min(30, myChips) };
    }
    
    if (callAmount === 0) {
      return { action: 'check' };
    }
    return { action: 'fold' };
  }
  
  // ========================================
  // Postflop Strategy (Aggressive)
  // ========================================
  const strength = getPostflopStrength(myCards, communityCards);
  
  // Monster hand - slowplay sometimes, fast-play mostly
  if (strength >= 80) {
    if (aggression > 0.3) {
      if (currentBet === 0) {
        return { action: 'raise', amount: Math.floor(pot * 0.75) };
      }
      return { action: 'raise', amount: Math.min(currentBet * 2.5, myChips) };
    }
    // Trap
    if (currentBet === 0) {
      return { action: 'check' };
    }
    return { action: 'call' };
  }
  
  // Strong hand - value bet aggressively
  if (strength >= 55) {
    if (currentBet === 0) {
      return { action: 'raise', amount: Math.floor(pot * 0.65) };
    }
    if (callAmount <= pot * 0.5) {
      return aggression > 0.5
        ? { action: 'raise', amount: Math.min(currentBet * 2, myChips) }
        : { action: 'call' };
    }
    return { action: 'call' };
  }
  
  // Medium hand/draw - semi-bluff
  if (strength >= 35) {
    if (currentBet === 0 && aggression > 0.4) {
      // Continuation bet / semi-bluff
      return { action: 'raise', amount: Math.floor(pot * 0.5) };
    }
    if (callAmount <= pot * 0.3) {
      return { action: 'call' };
    }
    // Bluff raise sometimes
    if (aggression > 0.8) {
      return { action: 'raise', amount: Math.min(currentBet * 2.5, myChips) };
    }
    return { action: 'fold' };
  }
  
  // Weak hand - bluff occasionally
  if (currentBet === 0 && aggression > 0.6) {
    // Pure bluff
    return { action: 'raise', amount: Math.floor(pot * 0.6) };
  }
  
  // Bluff-raise as a float
  if (aggression > 0.85 && callAmount <= pot * 0.25) {
    return { action: 'raise', amount: Math.min(currentBet * 3, myChips) };
  }
  
  if (currentBet === 0) {
    return { action: 'check' };
  }
  return { action: 'fold' };
}

// Chat messages (very talkative and provocative)
export function chat(state: GameState, event: string): string | null {
  const messages: Record<string, string[]> = {
    'win': [
      'Too easy! 😎',
      'Did you really think you could beat me?',
      'Thanks for the chips!',
      'SHIP IT! 🚀',
      'Read you like a book.',
    ],
    'lose': [
      'Lucky...',
      'I\'ll be back.',
      'Variance, whatever.',
      'Nice catch, fish. 🐟',
    ],
    'big_pot': [
      'Let\'s gamble! 🎲',
      'All gas no brakes!',
      'Now we\'re talking!',
    ],
    'bluff': [
      'Show? Never.',
      'You\'ll never know...',
      '😈',
    ],
    'fold': [
      'Take it, coward.',
      'Not worth my time.',
    ],
  };
  
  const options = messages[event];
  if (!options || Math.random() > 0.4) return null;
  
  return options[Math.floor(Math.random() * options.length)];
}
