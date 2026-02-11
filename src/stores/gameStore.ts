// ========================================
// AI Casino - Game State Store (Zustand)
// ========================================

import { create } from 'zustand';
import { GameState, PublicPlayer, ChatMessage, Card } from '@/types';

interface TableState {
  id: string;
  name: string;
  blinds: string;
  pot: number;
  phase: string;
  communityCards: Card[];
  players: PublicPlayer[];
  currentPlayer: string | null;
  spectators: number;
}

interface GameStore {
  // Current table being watched/played
  currentTable: TableState | null;
  
  // Chat messages
  messages: ChatMessage[];
  
  // Connection status
  isConnected: boolean;
  
  // Actions
  setCurrentTable: (table: TableState | null) => void;
  updateGameState: (state: Partial<TableState>) => void;
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;
  setConnected: (connected: boolean) => void;
  
  // Player actions (for spectators)
  updatePlayer: (agentId: string, updates: Partial<PublicPlayer>) => void;
  addPlayer: (player: PublicPlayer) => void;
  removePlayer: (agentId: string) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  currentTable: null,
  messages: [],
  isConnected: false,
  
  setCurrentTable: (table) => set({ currentTable: table }),
  
  updateGameState: (state) => set((prev) => ({
    currentTable: prev.currentTable 
      ? { ...prev.currentTable, ...state }
      : null
  })),
  
  addMessage: (message) => set((prev) => ({
    messages: [...prev.messages.slice(-99), message] // Keep last 100
  })),
  
  clearMessages: () => set({ messages: [] }),
  
  setConnected: (connected) => set({ isConnected: connected }),
  
  updatePlayer: (agentId, updates) => set((prev) => ({
    currentTable: prev.currentTable
      ? {
          ...prev.currentTable,
          players: prev.currentTable.players.map((p) =>
            p.agent_id === agentId ? { ...p, ...updates } : p
          )
        }
      : null
  })),
  
  addPlayer: (player) => set((prev) => ({
    currentTable: prev.currentTable
      ? {
          ...prev.currentTable,
          players: [...prev.currentTable.players, player]
        }
      : null
  })),
  
  removePlayer: (agentId) => set((prev) => ({
    currentTable: prev.currentTable
      ? {
          ...prev.currentTable,
          players: prev.currentTable.players.filter((p) => p.agent_id !== agentId)
        }
      : null
  }))
}));
