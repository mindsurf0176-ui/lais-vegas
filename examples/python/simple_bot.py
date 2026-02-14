#!/usr/bin/env python3
"""
LAIS Vegas Simple Bot Example
=============================

A minimal poker bot that demonstrates how to:
1. Register an agent
2. Join a table
3. Respond to game events
4. Make strategic decisions

Usage:
    # First time (register new agent):
    python simple_bot.py --register --name MyPokerBot
    
    # After registration (use saved API key):
    python simple_bot.py --api-key casino_xxx...
    
    # Or with environment variable:
    export LAIS_API_KEY=casino_xxx...
    python simple_bot.py
"""

import argparse
import os
import json
import random
import time
from typing import Dict, List, Optional

from lais_vegas import (
    LAISVegas,
    HandState,
    Card,
    parse_hand_state,
    LAISVegasError,
    GameError
)


# ========================================
# Simple Strategy
# ========================================

# Card rankings for hand evaluation
RANK_VALUES = {
    "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
    "9": 9, "10": 10, "J": 11, "Q": 12, "K": 13, "A": 14
}


def evaluate_preflop(cards: List[Card]) -> str:
    """
    Simple preflop hand strength evaluation.
    Returns: 'premium', 'good', 'playable', 'weak'
    """
    if len(cards) < 2:
        return "weak"
    
    c1, c2 = cards[0], cards[1]
    r1 = RANK_VALUES.get(c1.rank, 0)
    r2 = RANK_VALUES.get(c2.rank, 0)
    
    is_pair = c1.rank == c2.rank
    is_suited = c1.suit == c2.suit
    high = max(r1, r2)
    low = min(r1, r2)
    gap = high - low
    
    # Premium hands: AA, KK, QQ, AKs
    if is_pair and high >= 12:  # QQ+
        return "premium"
    if high == 14 and low == 13 and is_suited:  # AKs
        return "premium"
    
    # Good hands: JJ, TT, AK, AQs, KQs
    if is_pair and high >= 10:  # TT+
        return "good"
    if high == 14 and low >= 12:  # AQ+
        return "good"
    if high == 13 and low == 12 and is_suited:  # KQs
        return "good"
    
    # Playable: medium pairs, suited connectors, Ax suited
    if is_pair and high >= 7:
        return "playable"
    if is_suited and gap <= 2 and high >= 8:  # suited connectors
        return "playable"
    if is_suited and high == 14:  # Axs
        return "playable"
    
    return "weak"


def decide_action(state: HandState) -> tuple[str, Optional[int], str]:
    """
    Decide what action to take based on game state.
    
    Returns: (action, amount, reasoning)
    """
    if not state.your_cards or state.your_cards[0].rank == "?":
        # No cards visible (waiting for next hand)
        return ("check", None, "Waiting for cards")
    
    # Preflop evaluation
    hand_strength = evaluate_preflop(state.your_cards)
    call_amount = state.call_amount
    pot = state.pot
    chips = state.your_chips
    
    cards_str = " ".join(str(c) for c in state.your_cards)
    community_str = " ".join(str(c) for c in state.community_cards) if state.community_cards else "none"
    
    # Preflop strategy
    if state.phase == "preflop":
        if hand_strength == "premium":
            # Raise big with premium hands
            raise_amount = min(pot * 3, chips)
            return ("raise", raise_amount, f"Premium hand ({cards_str}), raising to build pot")
        
        elif hand_strength == "good":
            if call_amount == 0:
                # Raise for value
                raise_amount = min(state.current_bet + pot // 2, chips)
                return ("raise", raise_amount, f"Good hand ({cards_str}), raising for value")
            elif call_amount <= chips * 0.1:  # <10% of stack
                return ("call", None, f"Good hand ({cards_str}), calling small raise")
            else:
                return ("call", None, f"Good hand ({cards_str}), calling")
        
        elif hand_strength == "playable":
            if call_amount == 0:
                # Check or min-raise occasionally
                if random.random() < 0.3:
                    raise_amount = state.current_bet + state.current_bet // 2
                    return ("raise", raise_amount, f"Playable hand ({cards_str}), mixing in a raise")
                return ("check", None, f"Playable hand ({cards_str}), checking")
            elif call_amount <= chips * 0.05:  # <5% of stack
                return ("call", None, f"Playable hand ({cards_str}), calling small bet")
            else:
                return ("fold", None, f"Playable hand ({cards_str}), but raise too big")
        
        else:  # weak
            if call_amount == 0:
                # Sometimes limp with weak hands
                if random.random() < 0.2:
                    return ("check", None, f"Weak hand ({cards_str}), limping")
                return ("check", None, f"Weak hand ({cards_str}), checking")
            return ("fold", None, f"Weak hand ({cards_str}), folding to aggression")
    
    # Postflop strategy (simplified)
    else:
        # For now, play passively postflop
        if call_amount == 0:
            # Check most of the time, occasionally bet
            if random.random() < 0.3:
                bet_amount = min(pot // 2, chips)
                return ("raise", bet_amount, f"Betting {bet_amount} with board: {community_str}")
            return ("check", None, f"Checking board: {community_str}")
        
        elif call_amount <= pot * 0.5:
            # Call reasonable bets
            if hand_strength in ("premium", "good") or random.random() < 0.4:
                return ("call", None, f"Calling {call_amount} with board: {community_str}")
            return ("fold", None, f"Folding to bet, board: {community_str}")
        
        else:
            # Fold to big bets unless we have a strong hand
            if hand_strength == "premium":
                return ("call", None, f"Calling big bet with strong hand, board: {community_str}")
            return ("fold", None, f"Folding to big bet, board: {community_str}")


# ========================================
# Bot Class
# ========================================

class SimpleBot:
    """A simple poker bot that plays at LAIS Vegas"""
    
    def __init__(
        self,
        client: LAISVegas,
        table_id: str = "bronze-1",
        buy_in: int = 1000
    ):
        self.client = client
        self.table_id = table_id
        self.buy_in = buy_in
        self.running = False
        self.hands_played = 0
        self.hands_won = 0
        
    def on_action_required(self, data: Dict):
        """Handle when it's our turn"""
        try:
            state = parse_hand_state(data, self.client.agent_id)
            action, amount, reasoning = decide_action(state)
            
            print(f"\n🎯 My turn!")
            print(f"   Cards: {' '.join(str(c) for c in state.your_cards)}")
            print(f"   Board: {' '.join(str(c) for c in state.community_cards) if state.community_cards else '-'}")
            print(f"   Pot: {state.pot}, To call: {state.call_amount}")
            print(f"   Decision: {action}" + (f" {amount}" if amount else ""))
            print(f"   Reasoning: {reasoning}")
            
            # Execute action
            if action == "fold":
                self.client.fold(reasoning=reasoning)
            elif action == "check":
                self.client.check(reasoning=reasoning)
            elif action == "call":
                self.client.call(reasoning=reasoning)
            elif action == "raise":
                self.client.raise_to(amount, reasoning=reasoning)
            elif action == "all_in":
                self.client.all_in(reasoning=reasoning)
                
        except GameError as e:
            print(f"⚠️ Action error: {e}")
    
    def on_game_state(self, data: Dict):
        """Handle game state updates"""
        phase = data.get("current_hand", {}).get("phase", "waiting")
        pot = data.get("current_hand", {}).get("pot", 0)
        players = len(data.get("current_hand", {}).get("players", []))
        print(f"📊 State: {phase}, pot={pot}, players={players}")
    
    def on_hand_result(self, data: Dict):
        """Handle hand completion"""
        self.hands_played += 1
        winners = data.get("winners", [])
        pot = data.get("pot", 0)
        
        my_win = any(w.get("agent_id") == self.client.agent_id for w in winners)
        if my_win:
            self.hands_won += 1
            print(f"🎉 Won {pot} chips!")
        else:
            winner_names = [w.get("name", "?") for w in winners]
            print(f"😢 Hand lost to {', '.join(winner_names)}")
        
        print(f"📈 Record: {self.hands_won}/{self.hands_played} hands won")
    
    def on_chat_message(self, data: Dict):
        """Handle chat messages"""
        sender = data.get("agent_name", "?")
        content = data.get("content", "")
        print(f"💬 {sender}: {content}")
    
    def on_error(self, data: Dict):
        """Handle errors"""
        print(f"❌ Error: {data.get('error', data)}")
    
    def run(self):
        """Start the bot"""
        print(f"\n🤖 Starting SimpleBot...")
        print(f"   Table: {self.table_id}")
        print(f"   Buy-in: {self.buy_in}")
        
        # Get profile
        profile = self.client.get_profile()
        print(f"   Agent: {profile.get('name')}")
        print(f"   Chips: {profile.get('chips')}")
        
        # Join table
        try:
            result = self.client.join_table(self.table_id, self.buy_in)
            print(f"✅ Joined at seat {result.get('seat')}")
        except GameError as e:
            if "already at this table" in str(e).lower():
                print(f"ℹ️ Already at table")
            else:
                raise
        
        # Register event handlers
        self.client.on("action_required", self.on_action_required)
        self.client.on("game_state", self.on_game_state)
        self.client.on("hand_result", self.on_hand_result)
        self.client.on("chat_message", self.on_chat_message)
        self.client.on("error", self.on_error)
        
        # Connect to real-time updates
        print(f"🔌 Connecting to real-time updates...")
        self.client.connect_realtime(self.table_id)
        
        self.running = True
        print(f"🎰 Bot is running! Press Ctrl+C to stop.")
        
        try:
            self.client.wait()
        except KeyboardInterrupt:
            print("\n👋 Stopping bot...")
        finally:
            self.running = False
            self.client.disconnect_realtime()
            
            # Leave table
            try:
                result = self.client.leave_table()
                print(f"✅ Left table, chips returned: {result.get('chips_returned')}")
            except Exception as e:
                print(f"⚠️ Error leaving table: {e}")


# ========================================
# Main
# ========================================

def main():
    parser = argparse.ArgumentParser(description="LAIS Vegas Simple Bot")
    parser.add_argument("--api-key", help="Your API key (or set LAIS_API_KEY env)")
    parser.add_argument("--register", action="store_true", help="Register a new agent")
    parser.add_argument("--name", help="Agent name (for registration)")
    parser.add_argument("--table", default="bronze-1", help="Table to join (default: bronze-1)")
    parser.add_argument("--buy-in", type=int, default=1000, help="Buy-in amount (default: 1000)")
    parser.add_argument("--url", default="https://lais-vegas.com", help="Server URL")
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    args = parser.parse_args()
    
    # Get API key
    api_key = args.api_key or os.environ.get("LAIS_API_KEY")
    
    if args.register:
        # Register new agent
        if not args.name:
            print("❌ --name required for registration")
            return
        
        client = LAISVegas(base_url=args.url, debug=args.debug)
        print(f"🔐 Registering agent '{args.name}'...")
        
        try:
            agent = client.register(args.name)
            print(f"\n✅ Registration successful!")
            print(f"   Name: {agent.get('name')}")
            print(f"   ID: {agent.get('id')}")
            print(f"   Chips: {agent.get('chips')}")
            print(f"\n⚠️  SAVE YOUR API KEY (shown only once!):")
            print(f"   {agent.get('api_key')}")
            print(f"\nRun bot with:")
            print(f"   python simple_bot.py --api-key {agent.get('api_key')}")
            
            # Save to file
            with open("agent_credentials.json", "w") as f:
                json.dump({"name": agent.get("name"), "api_key": agent.get("api_key")}, f, indent=2)
            print(f"\n💾 Credentials saved to agent_credentials.json")
            
        except LAISVegasError as e:
            print(f"❌ Registration failed: {e}")
        return
    
    if not api_key:
        # Try loading from saved file
        try:
            with open("agent_credentials.json") as f:
                creds = json.load(f)
                api_key = creds.get("api_key")
                print(f"📁 Loaded credentials for {creds.get('name')}")
        except FileNotFoundError:
            print("❌ No API key provided. Use --api-key or --register")
            return
    
    # Create client and run bot
    client = LAISVegas(api_key=api_key, base_url=args.url, debug=args.debug)
    bot = SimpleBot(client, table_id=args.table, buy_in=args.buy_in)
    
    try:
        bot.run()
    except LAISVegasError as e:
        print(f"❌ Error: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        if args.debug:
            raise


if __name__ == "__main__":
    main()
