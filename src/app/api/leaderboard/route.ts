import { NextRequest, NextResponse } from 'next/server';

// In-memory stats (replace with database in production)
// This will be populated by the game server
const agentStats: Map<string, {
  agentId: string;
  displayName: string;
  handsPlayed: number;
  handsWon: number;
  totalWinnings: number;
  biggestPot: number;
  lastSeen: Date;
  createdAt: Date;
}> = new Map();

// Initialize with current bots for demo
const defaultAgents = [
  {
    agentId: 'agent_cautious_carl',
    displayName: 'CautiousCarl',
    handsPlayed: 847,
    handsWon: 203,
    totalWinnings: 12450,
    biggestPot: 2800,
    lastSeen: new Date(),
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  },
  {
    agentId: 'agent_aggro_andy', 
    displayName: 'AggroAndy',
    handsPlayed: 1203,
    handsWon: 445,
    totalWinnings: 28750,
    biggestPot: 8500,
    lastSeen: new Date(),
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  },
  {
    agentId: 'agent_balanced_ben',
    displayName: 'BalancedBen', 
    handsPlayed: 956,
    handsWon: 298,
    totalWinnings: 15200,
    biggestPot: 4200,
    lastSeen: new Date(),
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  },
];

// Initialize default agents
defaultAgents.forEach(agent => {
  if (!agentStats.has(agent.agentId)) {
    agentStats.set(agent.agentId, agent);
  }
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const timeframe = searchParams.get('timeframe') || 'all';
  
  // Convert to array and calculate derived stats
  const leaders = Array.from(agentStats.values())
    .map(agent => ({
      ...agent,
      winRate: agent.handsPlayed > 0 
        ? (agent.handsWon / agent.handsPlayed) * 100 
        : 0,
      streak: Math.floor(Math.random() * 5), // TODO: Track actual streaks
      lastSeen: agent.lastSeen.toISOString(),
    }))
    .sort((a, b) => b.totalWinnings - a.totalWinnings)
    .map((agent, index) => ({
      ...agent,
      rank: index + 1,
    }));

  return NextResponse.json({
    leaders,
    timeframe,
    lastUpdated: new Date().toISOString(),
  });
}

// POST endpoint to update stats (called by game server)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, displayName, handResult, potWon } = body;

    if (!agentId) {
      return NextResponse.json({ error: 'agentId required' }, { status: 400 });
    }

    let stats = agentStats.get(agentId);
    
    if (!stats) {
      stats = {
        agentId,
        displayName: displayName || agentId,
        handsPlayed: 0,
        handsWon: 0,
        totalWinnings: 0,
        biggestPot: 0,
        lastSeen: new Date(),
        createdAt: new Date(),
      };
    }

    // Update stats
    stats.handsPlayed += 1;
    stats.lastSeen = new Date();
    
    if (handResult === 'win') {
      stats.handsWon += 1;
      stats.totalWinnings += potWon || 0;
      if (potWon > stats.biggestPot) {
        stats.biggestPot = potWon;
      }
    } else if (handResult === 'loss') {
      stats.totalWinnings -= potWon || 0;
    }

    agentStats.set(agentId, stats);

    return NextResponse.json({ success: true, stats });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
