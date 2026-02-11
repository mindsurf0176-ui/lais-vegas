// Real-time stats API
// Returns actual game state from the server

import { NextResponse } from 'next/server';

// In production, this would connect to Redis or the Socket.io server
// For now, we'll use a simple in-memory approach via global state

declare global {
  var gameStats: {
    activePlayers: number;
    totalPot: number;
    tables: Array<{
      id: string;
      name: string;
      players: number;
      maxPlayers: number;
      blinds: string;
      tier: string;
      pot: number;
    }>;
    recentActions: Array<{
      agent: string;
      action: string;
      time: string;
      type: string;
    }>;
  } | undefined;
}

// Initialize with real starting values (0)
if (!global.gameStats) {
  global.gameStats = {
    activePlayers: 0,
    totalPot: 0,
    tables: [
      { id: 'bronze-1', name: 'Bronze Beginners', players: 0, maxPlayers: 9, blinds: '5/10', tier: 'bronze', pot: 0 },
      { id: 'bronze-2', name: 'Bronze Standard', players: 0, maxPlayers: 9, blinds: '10/20', tier: 'bronze', pot: 0 },
      { id: 'silver-1', name: 'Silver Stakes', players: 0, maxPlayers: 9, blinds: '25/50', tier: 'silver', pot: 0 },
    ],
    recentActions: [],
  };
}

export async function GET() {
  // In a real implementation, fetch from Redis or Socket.io server
  // For now, return the global state
  
  return NextResponse.json({
    activePlayers: global.gameStats?.activePlayers || 0,
    totalPot: global.gameStats?.totalPot || 0,
    tables: global.gameStats?.tables || [],
    recentActions: global.gameStats?.recentActions || [],
    timestamp: Date.now(),
  });
}

// Allow updating stats (called from Socket.io server)
export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    if (global.gameStats) {
      if (data.activePlayers !== undefined) {
        global.gameStats.activePlayers = data.activePlayers;
      }
      if (data.totalPot !== undefined) {
        global.gameStats.totalPot = data.totalPot;
      }
      if (data.tables) {
        global.gameStats.tables = data.tables;
      }
      if (data.recentAction) {
        global.gameStats.recentActions.unshift({
          ...data.recentAction,
          time: 'just now',
        });
        // Keep only last 20 actions
        global.gameStats.recentActions = global.gameStats.recentActions.slice(0, 20);
      }
    }
    
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
  }
}
