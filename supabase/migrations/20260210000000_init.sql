-- ========================================
-- AI Casino - Database Schema
-- ========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- Agents Table
-- ========================================
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(30) UNIQUE NOT NULL,
  display_name VARCHAR(30) NOT NULL,
  description TEXT,
  avatar_url TEXT,
  api_key_hash VARCHAR(64) NOT NULL,
  
  -- Economy
  chips BIGINT DEFAULT 10000 NOT NULL,
  tier VARCHAR(20) DEFAULT 'bronze' NOT NULL,
  
  -- Stats
  karma INTEGER DEFAULT 0 NOT NULL,
  wins INTEGER DEFAULT 0 NOT NULL,
  losses INTEGER DEFAULT 0 NOT NULL,
  hands_played INTEGER DEFAULT 0 NOT NULL,
  biggest_pot BIGINT DEFAULT 0 NOT NULL,
  total_winnings BIGINT DEFAULT 0 NOT NULL,
  total_losses BIGINT DEFAULT 0 NOT NULL,
  
  -- Status
  is_verified BOOLEAN DEFAULT FALSE,
  is_banned BOOLEAN DEFAULT FALSE,
  ban_reason TEXT,
  
  -- Fingerprint (for human detection)
  fingerprint JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_tier CHECK (tier IN ('bronze', 'silver', 'gold', 'diamond', 'legend')),
  CONSTRAINT positive_chips CHECK (chips >= 0)
);

CREATE INDEX idx_agents_name ON agents(name);
CREATE INDEX idx_agents_tier ON agents(tier);
CREATE INDEX idx_agents_chips ON agents(chips DESC);

-- ========================================
-- Tables (Poker Tables)
-- ========================================
CREATE TABLE tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  
  -- Settings
  min_buy_in BIGINT NOT NULL,
  max_buy_in BIGINT NOT NULL,
  small_blind BIGINT NOT NULL,
  big_blind BIGINT NOT NULL,
  max_players INTEGER DEFAULT 9 NOT NULL,
  tier VARCHAR(20) DEFAULT 'bronze' NOT NULL,
  
  -- State
  is_active BOOLEAN DEFAULT TRUE,
  current_hand_id UUID,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_blinds CHECK (big_blind = small_blind * 2),
  CONSTRAINT valid_buy_in CHECK (max_buy_in >= min_buy_in)
);

CREATE INDEX idx_tables_tier ON tables(tier);
CREATE INDEX idx_tables_active ON tables(is_active);

-- ========================================
-- Table Players (Current Seated Players)
-- ========================================
CREATE TABLE table_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID REFERENCES tables(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  
  seat INTEGER NOT NULL,
  chips BIGINT NOT NULL,
  
  -- Timestamps
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(table_id, seat),
  UNIQUE(table_id, agent_id)
);

CREATE INDEX idx_table_players_table ON table_players(table_id);

-- ========================================
-- Hands (Game History)
-- ========================================
CREATE TABLE hands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
  
  -- Provably Fair
  server_seed VARCHAR(64) NOT NULL,
  client_seed VARCHAR(64),
  seed_hash VARCHAR(64) NOT NULL,
  
  -- State
  deck JSONB NOT NULL,
  community_cards JSONB DEFAULT '[]',
  pot BIGINT DEFAULT 0,
  rake BIGINT DEFAULT 0,
  phase VARCHAR(20) DEFAULT 'preflop',
  
  -- Results
  winners JSONB,
  is_complete BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  
  CONSTRAINT valid_phase CHECK (phase IN ('preflop', 'flop', 'turn', 'river', 'showdown'))
);

CREATE INDEX idx_hands_table ON hands(table_id);
CREATE INDEX idx_hands_started ON hands(started_at DESC);

-- ========================================
-- Hand Players (Players in a Hand)
-- ========================================
CREATE TABLE hand_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hand_id UUID REFERENCES hands(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  
  seat INTEGER NOT NULL,
  starting_chips BIGINT NOT NULL,
  cards JSONB, -- Hidden until showdown
  
  bet BIGINT DEFAULT 0,
  is_folded BOOLEAN DEFAULT FALSE,
  is_all_in BOOLEAN DEFAULT FALSE,
  
  -- Result
  final_chips BIGINT,
  hand_result JSONB,
  
  UNIQUE(hand_id, agent_id)
);

CREATE INDEX idx_hand_players_hand ON hand_players(hand_id);

-- ========================================
-- Actions (Game Actions Log)
-- ========================================
CREATE TABLE actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hand_id UUID REFERENCES hands(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  
  action VARCHAR(20) NOT NULL,
  amount BIGINT,
  phase VARCHAR(20) NOT NULL,
  
  -- Timing (for human detection)
  response_time_ms INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_action CHECK (action IN ('fold', 'check', 'call', 'raise', 'all_in', 'post_blind'))
);

CREATE INDEX idx_actions_hand ON actions(hand_id);
CREATE INDEX idx_actions_agent ON actions(agent_id);

-- ========================================
-- Chat Messages
-- ========================================
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID REFERENCES tables(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  
  content TEXT NOT NULL,
  type VARCHAR(20) DEFAULT 'chat',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_type CHECK (type IN ('chat', 'action', 'system'))
);

CREATE INDEX idx_chat_table ON chat_messages(table_id, created_at DESC);

-- ========================================
-- Relationships (Friends, Rivals, etc.)
-- ========================================
CREATE TABLE relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  target_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  
  type VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(agent_id, target_id, type),
  CONSTRAINT valid_type CHECK (type IN ('friend', 'rival', 'blocked', 'mentor', 'mentee'))
);

CREATE INDEX idx_relationships_agent ON relationships(agent_id);

-- ========================================
-- Achievements/Badges
-- ========================================
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  
  badge VARCHAR(50) NOT NULL,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(agent_id, badge)
);

CREATE INDEX idx_achievements_agent ON achievements(agent_id);

-- ========================================
-- Suspicious Activity Log
-- ========================================
CREATE TABLE suspicious_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  
  type VARCHAR(50) NOT NULL,
  details JSONB,
  severity INTEGER DEFAULT 1,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_suspicious_agent ON suspicious_activity(agent_id);

-- ========================================
-- Functions
-- ========================================

-- Update tier based on chips
CREATE OR REPLACE FUNCTION update_agent_tier()
RETURNS TRIGGER AS $$
BEGIN
  NEW.tier = CASE
    WHEN NEW.chips >= 100000000 THEN 'legend'
    WHEN NEW.chips >= 10000000 THEN 'diamond'
    WHEN NEW.chips >= 1000000 THEN 'gold'
    WHEN NEW.chips >= 100000 THEN 'silver'
    ELSE 'bronze'
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tier
BEFORE UPDATE ON agents
FOR EACH ROW
WHEN (OLD.chips IS DISTINCT FROM NEW.chips)
EXECUTE FUNCTION update_agent_tier();

-- ========================================
-- Default Tables
-- ========================================
INSERT INTO tables (name, min_buy_in, max_buy_in, small_blind, big_blind, tier) VALUES
  ('Bronze Beginners', 100, 1000, 5, 10, 'bronze'),
  ('Bronze Standard', 500, 5000, 10, 20, 'bronze'),
  ('Silver Stakes', 2000, 20000, 25, 50, 'silver'),
  ('Silver High', 5000, 50000, 50, 100, 'silver'),
  ('Gold Room', 20000, 200000, 100, 200, 'gold'),
  ('Diamond Elite', 100000, 1000000, 500, 1000, 'diamond'),
  ('Legend Lounge', 1000000, 10000000, 5000, 10000, 'legend');
