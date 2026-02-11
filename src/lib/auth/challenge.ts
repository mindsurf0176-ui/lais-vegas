// ========================================
// AI Casino - Challenge System (PoW + AI Puzzle)
// ========================================

import crypto from 'crypto';
import { Challenge, AIPuzzle } from '@/types';

// ========================================
// Proof of Work
// ========================================

export function generatePoWChallenge(): Challenge {
  const challenge_id = crypto.randomUUID();
  const seed = crypto.randomBytes(16).toString('hex');
  const expires_at = Date.now() + 30000; // 30 seconds
  
  return {
    challenge_id,
    seed,
    target_prefix: '0000', // 4 leading zeros
    expires_at,
    type: 'pow'
  };
}

export function verifyPoW(seed: string, nonce: string, targetPrefix: string): boolean {
  const hash = crypto.createHash('sha256').update(`${seed}${nonce}`).digest('hex');
  return hash.startsWith(targetPrefix);
}

// ========================================
// AI Puzzle - Only AI can solve quickly
// ========================================

const PUZZLE_TEMPLATES = [
  {
    generate: () => {
      const nums = Array.from({ length: 10 }, () => Math.floor(Math.random() * 100));
      const answer = nums.reduce((a, b) => a + b, 0);
      return {
        question: `Calculate the sum: ${nums.join(' + ')}`,
        answer: answer.toString(),
        time_limit_seconds: 3
      };
    }
  },
  {
    generate: () => {
      const code = `
def mystery(n):
    if n <= 1:
        return n
    return mystery(n-1) + mystery(n-2)

result = mystery(${Math.floor(Math.random() * 15) + 10})
print(result)
      `.trim();
      const n = parseInt(code.match(/mystery\((\d+)\)/)?.[1] || '10');
      const fib = (n: number): number => n <= 1 ? n : fib(n-1) + fib(n-2);
      return {
        question: `What is the output of this Python code?\n\`\`\`python\n${code}\n\`\`\``,
        answer: fib(n).toString(),
        time_limit_seconds: 5
      };
    }
  },
  {
    generate: () => {
      const words = ['apple', 'banana', 'cherry', 'date', 'elderberry', 'fig', 'grape'];
      const shuffled = words.sort(() => Math.random() - 0.5);
      const indices = [
        Math.floor(Math.random() * shuffled.length),
        Math.floor(Math.random() * shuffled.length),
        Math.floor(Math.random() * shuffled.length)
      ];
      const charIndices = indices.map(i => Math.floor(Math.random() * shuffled[i].length));
      const answer = indices.map((wordIdx, i) => shuffled[wordIdx][charIndices[i]]).join('');
      
      return {
        question: `From these words: [${shuffled.join(', ')}], extract characters at positions [${charIndices.map((c, i) => `word ${indices[i]+1}, char ${c+1}`).join('; ')}] and concatenate them.`,
        answer,
        time_limit_seconds: 5
      };
    }
  },
  {
    generate: () => {
      const base = crypto.randomBytes(8).toString('hex');
      const hash = crypto.createHash('sha256').update(base).digest('hex');
      return {
        question: `What is the SHA256 hash of "${base}"? (first 8 characters only)`,
        answer: hash.substring(0, 8),
        time_limit_seconds: 3
      };
    }
  },
  {
    generate: () => {
      const text = Buffer.from(crypto.randomBytes(8).toString('hex')).toString('base64');
      const decoded = Buffer.from(text, 'base64').toString();
      return {
        question: `Decode this base64 string: "${text}"`,
        answer: decoded,
        time_limit_seconds: 3
      };
    }
  }
];

export function generateAIPuzzle(): Challenge {
  const challenge_id = crypto.randomUUID();
  const template = PUZZLE_TEMPLATES[Math.floor(Math.random() * PUZZLE_TEMPLATES.length)];
  const puzzle = template.generate();
  
  // Store answer hash (don't expose actual answer)
  const answerHash = crypto.createHash('sha256').update(puzzle.answer).digest('hex');
  
  return {
    challenge_id,
    seed: answerHash, // Store answer hash as seed
    target_prefix: '', // Not used for puzzles
    expires_at: Date.now() + puzzle.time_limit_seconds * 1000,
    type: 'puzzle',
    puzzle: {
      question: puzzle.question,
      time_limit_seconds: puzzle.time_limit_seconds
    }
  };
}

export function verifyAIPuzzle(answerHash: string, answer: string): boolean {
  const hash = crypto.createHash('sha256').update(answer).digest('hex');
  return hash === answerHash;
}

// ========================================
// Challenge Manager
// ========================================

// In production, use Redis or database
const challengeStore = new Map<string, { challenge: Challenge; answer?: string }>();

export function createChallenge(type: 'pow' | 'puzzle' = 'pow'): { challenge: Challenge; token: string } {
  const challenge = type === 'pow' ? generatePoWChallenge() : generateAIPuzzle();
  const token = crypto.randomBytes(32).toString('hex');
  
  challengeStore.set(token, { challenge });
  
  // Clean up after expiration
  setTimeout(() => {
    challengeStore.delete(token);
  }, 60000);
  
  return { challenge, token };
}

export function verifyChallenge(token: string, proof: string): { valid: boolean; error?: string } {
  const stored = challengeStore.get(token);
  
  if (!stored) {
    return { valid: false, error: 'Challenge not found or expired' };
  }
  
  if (Date.now() > stored.challenge.expires_at) {
    challengeStore.delete(token);
    return { valid: false, error: 'Challenge expired' };
  }
  
  if (stored.challenge.type === 'pow') {
    const valid = verifyPoW(stored.challenge.seed, proof, stored.challenge.target_prefix);
    if (valid) {
      challengeStore.delete(token);
    }
    return { valid, error: valid ? undefined : 'Invalid proof of work' };
  } else {
    const valid = verifyAIPuzzle(stored.challenge.seed, proof);
    if (valid) {
      challengeStore.delete(token);
    }
    return { valid, error: valid ? undefined : 'Incorrect answer' };
  }
}
