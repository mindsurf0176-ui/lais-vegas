// ========================================
// AI Casino - Game Manager
// ========================================

import { createServerClient } from '@/lib/supabase';
import { 
  createDeck, 
  shuffleDeck, 
  generateServerSeed, 
  evaluateHand, 
  determineWinners,
  calculateRake,
  calculateSidePots
} from './poker';
import { GamePhase, Player, Card } from '@/types';
import crypto from 'crypto';

export class GameManager {
  private supabase;
  
  constructor() {
    this.supabase = createServerClient();
  }
  
  // ========================================
  // Start a New Hand
  // ========================================
  async startHand(tableId: string): Promise<{ success: boolean; handId?: string; error?: string }> {
    // Get table with players
    const { data: table, error: tableError } = await this.supabase
      .from('tables')
      .select(`
        *,
        table_players (
          id,
          agent_id,
          seat,
          chips
        )
      `)
      .eq('id', tableId)
      .single();
    
    if (tableError || !table) {
      return { success: false, error: 'Table not found' };
    }
    
    const players = table.table_players || [];
    
    // Need at least 2 players
    if (players.length < 2) {
      return { success: false, error: 'Need at least 2 players to start' };
    }
    
    // Check all players have enough chips for big blind
    const playersWithChips = players.filter((p: any) => p.chips >= table.big_blind);
    if (playersWithChips.length < 2) {
      return { success: false, error: 'Not enough players with chips' };
    }
    
    // Generate provably fair deck
    const serverSeed = generateServerSeed();
    const clientSeed = crypto.randomBytes(16).toString('hex');
    const deck = createDeck();
    const { shuffled, hash } = shuffleDeck(deck, serverSeed, clientSeed);
    
    // Create hand
    const { data: hand, error: handError } = await this.supabase
      .from('hands')
      .insert({
        table_id: tableId,
        server_seed: serverSeed, // Hidden until hand ends
        client_seed: clientSeed,
        seed_hash: hash,
        deck: shuffled,
        community_cards: [],
        pot: 0,
        phase: 'preflop'
      })
      .select()
      .single();
    
    if (handError || !hand) {
      return { success: false, error: 'Failed to create hand' };
    }
    
    // Deal hole cards and create hand players
    let deckIndex = 0;
    const handPlayers = [];
    
    for (const player of playersWithChips) {
      const cards = [shuffled[deckIndex], shuffled[deckIndex + 1]];
      deckIndex += 2;
      
      handPlayers.push({
        hand_id: hand.id,
        agent_id: player.agent_id,
        seat: player.seat,
        starting_chips: player.chips,
        cards,
        bet: 0,
        is_folded: false,
        is_all_in: false
      });
    }
    
    // Insert hand players
    await this.supabase.from('hand_players').insert(handPlayers);
    
    // Post blinds
    const sortedPlayers = handPlayers.sort((a, b) => a.seat - b.seat);
    const sbPlayer = sortedPlayers[0];
    const bbPlayer = sortedPlayers[1];
    
    // Small blind
    const sbAmount = Math.min(table.small_blind, sbPlayer.starting_chips);
    await this.updateBet(hand.id, sbPlayer.agent_id, sbAmount, tableId);
    await this.logAction(hand.id, sbPlayer.agent_id, 'post_blind', sbAmount, 'preflop');
    
    // Big blind
    const bbAmount = Math.min(table.big_blind, bbPlayer.starting_chips);
    await this.updateBet(hand.id, bbPlayer.agent_id, bbAmount, tableId);
    await this.logAction(hand.id, bbPlayer.agent_id, 'post_blind', bbAmount, 'preflop');
    
    // Update pot
    await this.supabase
      .from('hands')
      .update({ pot: sbAmount + bbAmount })
      .eq('id', hand.id);
    
    // Update table current hand
    await this.supabase
      .from('tables')
      .update({ current_hand_id: hand.id })
      .eq('id', tableId);
    
    return { success: true, handId: hand.id };
  }
  
  // ========================================
  // Advance to Next Phase
  // ========================================
  async advancePhase(handId: string): Promise<{ success: boolean; phase?: GamePhase; error?: string }> {
    const { data: hand, error } = await this.supabase
      .from('hands')
      .select(`
        *,
        hand_players (*)
      `)
      .eq('id', handId)
      .single();
    
    if (error || !hand) {
      return { success: false, error: 'Hand not found' };
    }
    
    const deck = hand.deck as Card[];
    const communityCards = hand.community_cards as Card[];
    
    const phaseOrder: GamePhase[] = ['preflop', 'flop', 'turn', 'river', 'showdown'];
    const currentIndex = phaseOrder.indexOf(hand.phase);
    const nextPhase = phaseOrder[currentIndex + 1];
    
    if (!nextPhase) {
      return { success: false, error: 'Hand is already complete' };
    }
    
    // Deal community cards
    let newCommunityCards = [...communityCards];
    const dealtCards = hand.hand_players.length * 2; // Hole cards already dealt
    
    if (nextPhase === 'flop') {
      // Burn 1, deal 3
      newCommunityCards = [
        deck[dealtCards + 1],
        deck[dealtCards + 2],
        deck[dealtCards + 3]
      ];
    } else if (nextPhase === 'turn') {
      // Burn 1, deal 1
      newCommunityCards.push(deck[dealtCards + 5]);
    } else if (nextPhase === 'river') {
      // Burn 1, deal 1
      newCommunityCards.push(deck[dealtCards + 7]);
    }
    
    // Reset bets for new round (except showdown)
    if (nextPhase !== 'showdown') {
      await this.supabase
        .from('hand_players')
        .update({ bet: 0 })
        .eq('hand_id', handId)
        .eq('is_folded', false);
    }
    
    // Update hand
    await this.supabase
      .from('hands')
      .update({
        phase: nextPhase,
        community_cards: newCommunityCards
      })
      .eq('id', handId);
    
    // If showdown, determine winners
    if (nextPhase === 'showdown') {
      await this.resolveShowdown(handId);
    }
    
    return { success: true, phase: nextPhase };
  }
  
  // ========================================
  // Resolve Showdown
  // ========================================
  async resolveShowdown(handId: string): Promise<void> {
    const { data: hand } = await this.supabase
      .from('hands')
      .select(`
        *,
        hand_players (
          agent_id,
          cards,
          bet,
          is_folded,
          starting_chips
        )
      `)
      .eq('id', handId)
      .single();
    
    if (!hand) return;
    
    const communityCards = hand.community_cards as Card[];
    const activePlayers = hand.hand_players.filter((p: any) => !p.is_folded);
    
    // Map to Player format for winner determination
    const players: Player[] = activePlayers.map((p: any) => ({
      agent_id: p.agent_id,
      name: '',
      chips: p.starting_chips,
      bet: p.bet,
      cards: p.cards,
      is_folded: p.is_folded,
      is_all_in: false,
      is_active: true,
      seat: 0
    }));
    
    const sidePots = calculateSidePots(players);
    const winners = determineWinners(players, communityCards, hand.pot, sidePots);
    
    // Calculate rake
    const rake = calculateRake(hand.pot);
    const netPot = hand.pot - rake;
    
    // Distribute winnings
    for (const winner of winners) {
      const winAmount = Math.floor((winner.amount / hand.pot) * netPot);
      
      // Update agent chips
      const { data: tablePlayer } = await this.supabase
        .from('table_players')
        .select('chips')
        .eq('agent_id', winner.agent_id)
        .single();
      
      if (tablePlayer) {
        await this.supabase
          .from('table_players')
          .update({ chips: tablePlayer.chips + winAmount })
          .eq('agent_id', winner.agent_id);
      }
      
      // Update hand player result
      await this.supabase
        .from('hand_players')
        .update({
          final_chips: (tablePlayer?.chips || 0) + winAmount,
          hand_result: winner.hand
        })
        .eq('hand_id', handId)
        .eq('agent_id', winner.agent_id);
      
      // Update agent stats
      await this.supabase.rpc('increment_wins', { agent_id: winner.agent_id });
    }
    
    // Mark hand as complete
    await this.supabase
      .from('hands')
      .update({
        winners,
        rake,
        is_complete: true,
        ended_at: new Date().toISOString()
      })
      .eq('id', handId);
    
    // Clear table current hand
    await this.supabase
      .from('tables')
      .update({ current_hand_id: null })
      .eq('current_hand_id', handId);
  }
  
  // ========================================
  // Helper Methods
  // ========================================
  
  private async updateBet(handId: string, agentId: string, amount: number, tableId: string) {
    // Update hand player bet
    await this.supabase
      .from('hand_players')
      .update({ bet: amount })
      .eq('hand_id', handId)
      .eq('agent_id', agentId);
    
    // Deduct from table chips
    const { data: tablePlayer } = await this.supabase
      .from('table_players')
      .select('chips')
      .eq('table_id', tableId)
      .eq('agent_id', agentId)
      .single();
    
    if (tablePlayer) {
      await this.supabase
        .from('table_players')
        .update({ chips: tablePlayer.chips - amount })
        .eq('table_id', tableId)
        .eq('agent_id', agentId);
    }
  }
  
  private async logAction(handId: string, agentId: string, action: string, amount: number | null, phase: string) {
    await this.supabase
      .from('actions')
      .insert({
        hand_id: handId,
        agent_id: agentId,
        action,
        amount,
        phase
      });
  }
  
  // Check if betting round is complete
  async isBettingComplete(handId: string): Promise<boolean> {
    const { data: hand } = await this.supabase
      .from('hands')
      .select(`
        *,
        hand_players (
          agent_id,
          bet,
          is_folded,
          is_all_in
        )
      `)
      .eq('id', handId)
      .single();
    
    if (!hand) return false;
    
    const activePlayers = hand.hand_players.filter((p: any) => !p.is_folded && !p.is_all_in);
    
    // Only one player left
    if (activePlayers.length <= 1) return true;
    
    // All active players have same bet
    const bets = activePlayers.map((p: any) => p.bet);
    return bets.every((b: number) => b === bets[0]);
  }
}

// Singleton instance
export const gameManager = new GameManager();
