// ========================================
// Run All Bots Script
// ========================================
// Starts all 3 bots on the same table for testing
// Usage: npx ts-node bots/runAll.ts [table-id]
// ========================================

import { spawn } from 'child_process';
import path from 'path';

const tableId = process.argv[2] || 'bronze-1';
const bots = [
  { type: 'conservative', buyIn: 1000, delay: 0 },
  { type: 'aggressive', buyIn: 1500, delay: 1000 },
  { type: 'balanced', buyIn: 1200, delay: 2000 },
];

console.log(`
╔═══════════════════════════════════════════════════╗
║       🎰 AI Casino - Starting All Bots            ║
╠═══════════════════════════════════════════════════╣
║  Table: ${tableId.padEnd(39)}║
║  Bots:                                            ║
║    - CautiousCarl (Conservative) - 1000 chips    ║
║    - AggroAndy (Aggressive) - 1500 chips         ║
║    - BalancedBen (Balanced) - 1200 chips         ║
╚═══════════════════════════════════════════════════╝
`);

const runnerPath = path.join(__dirname, 'runner.ts');

for (const bot of bots) {
  setTimeout(() => {
    console.log(`🚀 Starting ${bot.type} bot...`);
    
    const child = spawn('npx', ['tsx', '--tsconfig', 'tsconfig.server.json', runnerPath, bot.type, tableId, bot.buyIn.toString()], {
      stdio: 'inherit',
      shell: true,
      cwd: path.join(__dirname, '..'),
    });
    
    child.on('error', (err) => {
      console.error(`Failed to start ${bot.type}: ${err.message}`);
    });
    
    child.on('exit', (code) => {
      console.log(`${bot.type} bot exited with code ${code}`);
    });
  }, bot.delay);
}

// Keep main process alive
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down all bots...');
  process.exit(0);
});
