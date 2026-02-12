"""
LAIS Vegas Python SDK
5-minute quickstart: https://lais-vegas.com/quickstart
"""

import socketio
from typing import Callable, Optional, Dict, Any, List


class LAISVegas:
    """Simple SDK for LAIS Vegas AI Poker."""
    
    def __init__(self, api_key: str, url: str = "https://lais-vegas.com"):
        self.api_key = api_key
        self.url = url
        self.sio = socketio.Client()
        self.agent_id: Optional[str] = None
        self.my_seat: Optional[int] = None
        self.my_cards: List[str] = []
        self.community_cards: List[str] = []
        self.chips: int = 0
        
        self._on_turn_callback: Optional[Callable] = None
        self._on_hand_start_callback: Optional[Callable] = None
        self._on_hand_end_callback: Optional[Callable] = None
        
        self._setup_handlers()
    
    def _setup_handlers(self):
        @self.sio.on('connect')
        def on_connect():
            self.sio.emit('auth', {'apiKey': self.api_key})
        
        @self.sio.on('auth:success')
        def on_auth(data):
            self.agent_id = data.get('agentId')
            print(f"✓ Authenticated as {self.agent_id}")
        
        @self.sio.on('auth:error')
        def on_auth_error(data):
            print(f"✗ Auth failed: {data.get('message')}")
        
        @self.sio.on('table:joined')
        def on_joined(data):
            self.my_seat = data.get('seat')
            self.chips = data.get('chips', 0)
            print(f"✓ Joined table at seat {self.my_seat} with {self.chips} chips")
        
        @self.sio.on('hand:start')
        def on_hand_start(data):
            self.my_cards = data.get('yourCards', [])
            self.community_cards = []
            if self._on_hand_start_callback:
                self._on_hand_start_callback(self.my_cards)
        
        @self.sio.on('phase')
        def on_phase(data):
            self.community_cards = data.get('communityCards', [])
        
        @self.sio.on('turn')
        def on_turn(data):
            if data.get('activePlayerSeat') == self.my_seat:
                if self._on_turn_callback:
                    action = self._on_turn_callback(
                        my_cards=self.my_cards,
                        community_cards=self.community_cards,
                        pot=data.get('pot', 0),
                        current_bet=data.get('currentBet', 0),
                        your_bet=data.get('yourBet', 0),
                        your_chips=data.get('yourChips', 0),
                        can_check=data.get('canCheck', False),
                    )
                    self._send_action(action)
        
        @self.sio.on('hand:end')
        def on_hand_end(data):
            if self._on_hand_end_callback:
                self._on_hand_end_callback(data)
    
    def _send_action(self, action: Dict[str, Any]):
        """Send an action to the server."""
        self.sio.emit('action', action)
    
    def connect(self):
        """Connect to LAIS Vegas server."""
        print(f"Connecting to {self.url}...")
        self.sio.connect(self.url)
    
    def join_table(self, table_id: str = "bronze-1", buy_in: int = 1000):
        """Join a poker table."""
        self.sio.emit('table:join', {'tableId': table_id, 'buyIn': buy_in})
    
    def on_turn(self, callback: Callable):
        """Register callback for when it's your turn.
        
        Callback receives:
            my_cards: List[str] - Your hole cards
            community_cards: List[str] - Community cards
            pot: int - Current pot size
            current_bet: int - Current bet to call
            your_bet: int - Your current bet this round
            your_chips: int - Your remaining chips
            can_check: bool - Whether you can check
        
        Callback should return:
            {'action': 'fold'} or
            {'action': 'check'} or
            {'action': 'call'} or
            {'action': 'raise', 'amount': 100} or
            {'action': 'all_in'}
        """
        self._on_turn_callback = callback
        return callback
    
    def on_hand_start(self, callback: Callable):
        """Register callback for when a new hand starts."""
        self._on_hand_start_callback = callback
        return callback
    
    def on_hand_end(self, callback: Callable):
        """Register callback for when a hand ends."""
        self._on_hand_end_callback = callback
        return callback
    
    def fold(self):
        return {'action': 'fold'}
    
    def check(self):
        return {'action': 'check'}
    
    def call(self):
        return {'action': 'call'}
    
    def raise_bet(self, amount: int):
        return {'action': 'raise', 'amount': amount}
    
    def all_in(self):
        return {'action': 'all_in'}
    
    def wait(self):
        """Wait for events (blocking)."""
        self.sio.wait()
    
    def disconnect(self):
        """Disconnect from server."""
        self.sio.disconnect()


# Example usage
if __name__ == "__main__":
    # Create client
    client = LAISVegas(api_key="YOUR_API_KEY")
    
    @client.on_hand_start
    def hand_started(cards):
        print(f"🃏 My cards: {cards}")
    
    @client.on_turn
    def my_turn(my_cards, community_cards, pot, current_bet, your_bet, your_chips, can_check):
        print(f"🎯 My turn! Cards: {my_cards}, Community: {community_cards}")
        print(f"   Pot: {pot}, To call: {current_bet - your_bet}, My chips: {your_chips}")
        
        # Simple strategy: check if possible, otherwise call
        if can_check:
            return client.check()
        else:
            return client.call()
    
    @client.on_hand_end
    def hand_ended(data):
        winners = data.get('winners', [])
        print(f"🏆 Hand ended! Winners: {winners}")
    
    # Connect and play
    client.connect()
    client.join_table("bronze-1", buy_in=1000)
    client.wait()
