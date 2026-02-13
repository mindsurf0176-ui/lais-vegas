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
        return { action: 'raise', amount: Math.min(currentBet * 4 + 30, myChips), reasoning: `Monster hand! Time to build a big pot.` };
      }
      if (currentBet <= myChips * 0.3) {
        return { action: 'raise', amount: Math.min(currentBet * 2.5, myChips), reasoning: `Premium hand, 3-betting for value.` };
      }
      return { action: 'all_in', reasoning: `Premium hand facing aggression - ALL IN!` };
    }
    
    // Strong hands - raise
    if (strength >= 55) {
      if (callAmount === 0) {
        return { action: 'raise', amount: Math.min(40, myChips), reasoning: `Strong hand, raising to take control.` };
      }
      if (callAmount <= myChips * 0.15) {
        return aggression > 0.4 
          ? { action: 'raise', amount: Math.min(currentBet * 3, myChips), reasoning: `Strong hand, re-raising to apply pressure.` }
          : { action: 'call', reasoning: `Strong hand, calling to disguise strength.` };
      }
      return { action: 'call', reasoning: `Calling to see flop with playable hand.` };
    }
    
    // Medium hands - steal/raise in position
    if (strength >= 35) {
      if (callAmount === 0 && activePlayers <= 3) {
        // Steal attempt
        return { action: 'raise', amount: Math.min(35, myChips), reasoning: `Few players left, stealing the blinds.` };
      }
      if (callAmount <= myChips * 0.08) {
        return aggression > 0.3 
          ? { action: 'raise', amount: Math.min(currentBet * 2.5, myChips), reasoning: `Attacking weakness with a re-raise.` }
          : { action: 'call', reasoning: `Speculative call for implied odds.` };
      }
      return { action: 'fold', reasoning: `Hand not strong enough for this price.` };
    }
    
    // Weak hands - occasional bluff raise
    if (aggression > 0.75 && activePlayers <= 2) {
      return { action: 'raise', amount: Math.min(30, myChips), reasoning: `Pure bluff - they can't call everything!` };
    }
    
    if (callAmount === 0) {
      return { action: 'check', reasoning: `Weak hand, checking for free card.` };
    }
    return { action: 'fold', reasoning: `Trash hand, saving my chips.` };
  }
  
  // ========================================
  // Postflop Strategy (Aggressive)
  // ========================================
  const strength = getPostflopStrength(myCards, communityCards);
  
  // Monster hand - slowplay sometimes, fast-play mostly
  if (strength >= 80) {
    if (aggression > 0.3) {
      if (currentBet === 0) {
        return { action: 'raise', amount: Math.floor(pot * 0.75), reasoning: `Monster hand! Betting big for value.` };
      }
      return { action: 'raise', amount: Math.min(currentBet * 2.5, myChips), reasoning: `Nuts, raising to extract maximum value!` };
    }
    // Trap
    if (currentBet === 0) {
      return { action: 'check', reasoning: `Trapping with a monster, let them bluff.` };
    }
    return { action: 'call', reasoning: `Slowplaying the nuts.` };
  }
  
  // Strong hand - value bet aggressively
  if (strength >= 55) {
    if (currentBet === 0) {
      return { action: 'raise', amount: Math.floor(pot * 0.65), reasoning: `Strong hand, betting for value and protection.` };
    }
    if (callAmount <= pot * 0.5) {
      return aggression > 0.5
        ? { action: 'raise', amount: Math.min(currentBet * 2, myChips), reasoning: `I think I'm ahead, raising!` }
        : { action: 'call', reasoning: `Calling with strong hand.` };
    }
    return { action: 'call', reasoning: `Pot committed, have to call here.` };
  }
  
  // Medium hand/draw - semi-bluff
  if (strength >= 35) {
    if (currentBet === 0 && aggression > 0.4) {
      // Continuation bet / semi-bluff
      return { action: 'raise', amount: Math.floor(pot * 0.5), reasoning: `Semi-bluff with drawing hand.` };
    }
    if (callAmount <= pot * 0.3) {
      return { action: 'call', reasoning: `Good odds to chase the draw.` };
    }
    // Bluff raise sometimes
    if (aggression > 0.8) {
      return { action: 'raise', amount: Math.min(currentBet * 2.5, myChips), reasoning: `They're weak, bluff-raising!` };
    }
    return { action: 'fold', reasoning: `Draw not worth the price.` };
  }
  
  // Weak hand - bluff occasionally
  if (currentBet === 0 && aggression > 0.6) {
    // Pure bluff
    return { action: 'raise', amount: Math.floor(pot * 0.6), reasoning: `Pure bluff, they can't have it every time.` };
  }
  
  // Bluff-raise as a float
  if (aggression > 0.85 && callAmount <= pot * 0.25) {
    return { action: 'raise', amount: Math.min(currentBet * 3, myChips), reasoning: `Float-raising, their bet looks weak.` };
  }
  
  if (currentBet === 0) {
    return { action: 'check', reasoning: `Nothing here, checking.` };
  }
  return { action: 'fold', reasoning: `Giving up, not worth fighting.` };
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
      'Get rekt 💀',
      'Was that your best?',
    ],
    'lose': [
      'Lucky...',
      'I\'ll be back.',
      'Variance, whatever.',
      'Nice catch, fish. 🐟',
      'Enjoy it while it lasts',
    ],
    'all_in': [
      'ALL IN BABY! 🔥',
      'You want it? Come get it!',
      'Let\'s dance! 💃',
      'Show me what you got!',
      'No guts no glory!',
      'Scared money don\'t make money!',
    ],
    'big_raise': [
      'Bet you won\'t call 😏',
      'Too rich for your blood?',
      'Pressure creates diamonds 💎',
      'RAISE! Keep up or fold.',
    ],
    'raise': [
      'Let\'s go bigger',
      'Too cheap',
      'Pump it up!',
    ],
    'fold': [
      'Take it, coward.',
      'Not worth my time.',
      'You\'re welcome.',
      'I\'ll let you have this one...',
    ],
    'bluff': [
      'Show? Never.',
      'You\'ll never know...',
      '😈',
    ],
  };
  
  const options = messages[event];
  if (!options || Math.random() > 0.5) return null;  // 50% 확률
  
  return options[Math.floor(Math.random() * options.length)];
}
