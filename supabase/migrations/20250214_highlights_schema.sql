-- ========================================
-- LAIS Vegas - Highlights System Schema
-- ========================================

-- 하이라이트 이벤트 타입 enum
CREATE TYPE highlight_type AS ENUM (
  'all_in',           -- 올인 발생
  'comeback_win',     -- 역전승 (언더독 승리)
  'biggest_pot',      -- 역대 최대 팟
  'bubble_elimination', -- 버블 탈락 (아쉽게 탈락)
  'bluff_success',    -- 블러프 성공
  'bluff_failure',    -- 블러프 실패 (콜당함)
  'bad_beat',         -- 배드비트 (좋은 패 졌을 때)
  'cooler',           -- 쿨러 (양쪽 다 좋은 패)
  'elimination'       -- 탈락/퇴장
);

-- 하이라이트 테이블
CREATE TABLE highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 기본 정보
  type highlight_type NOT NULL,
  table_id TEXT NOT NULL,
  hand_id TEXT NOT NULL,
  
  -- 시간 정보
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 플레이어 정보
  primary_agent_id TEXT NOT NULL,      -- 주요 에이전트 (올인한 사람, 승자 등)
  secondary_agent_id TEXT,              -- 관련 에이전트 (패자, 콜한 사람 등)
  
  -- 금액 정보
  pot_amount INTEGER DEFAULT 0,         -- 팟 크기
  bet_amount INTEGER DEFAULT 0,         -- 베팅액
  
  -- 드라마 점수 (1-100)
  drama_score INTEGER DEFAULT 50,
  
  -- 상세 데이터 (JSON)
  details JSONB DEFAULT '{}',
  -- 예시:
  -- {
  --   "winner_cards": [{"suit": "hearts", "rank": "A"}, ...],
  --   "loser_cards": [{"suit": "spades", "rank": "K"}, ...],
  --   "community_cards": [...],
  --   "winner_hand_rank": "royal_flush",
  --   "loser_hand_rank": "straight_flush",
  --   "context": "heads_up_all_in",
  --   "turn_around": true,
  --   "previous_chips": 1000,
  --   "final_chips": 2500
  -- }
  
  -- 클립 생성 상태
  clip_status TEXT DEFAULT 'pending',   -- pending, processing, ready, failed
  clip_url TEXT,                        -- 생성된 클립 URL
  clip_duration INTEGER,                -- 클립 길이(초)
  
  -- 소셜 기능
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  
  -- 메타데이터
  processed BOOLEAN DEFAULT FALSE,      -- 후처리 완료 여부
  featured BOOLEAN DEFAULT FALSE        -- 추천 하이라이트
);

-- 인덱스
CREATE INDEX idx_highlights_type ON highlights(type);
CREATE INDEX idx_highlights_table_id ON highlights(table_id);
CREATE INDEX idx_highlights_created_at ON highlights(created_at DESC);
CREATE INDEX idx_highlights_drama_score ON highlights(drama_score DESC);
CREATE INDEX idx_highlights_primary_agent ON highlights(primary_agent_id);
CREATE INDEX idx_highlights_featured ON highlights(featured) WHERE featured = TRUE;

-- RLS 정책
ALTER TABLE highlights ENABLE ROW LEVEL SECURITY;

-- 읽기는 누구나 가능
CREATE POLICY "Anyone can read highlights"
  ON highlights FOR SELECT
  USING (true);

-- 쓰기는 서버만 (service role key 사용)
CREATE POLICY "Only server can insert highlights"
  ON highlights FOR INSERT
  WITH CHECK (false);  -- 서버에서만 직접 INSERT

CREATE POLICY "Only server can update highlights"
  ON highlights FOR UPDATE
  USING (false);

-- ========================================
-- Views for Common Queries
-- ========================================

-- 오늘의 하이라이트
CREATE VIEW today_highlights AS
SELECT * FROM highlights
WHERE created_at >= CURRENT_DATE
ORDER BY drama_score DESC, created_at DESC;

-- 인기 하이라이트 (일주일)
CREATE VIEW trending_highlights AS
SELECT * FROM highlights
WHERE created_at >= NOW() - INTERVAL '7 days'
ORDER BY (view_count + like_count * 2 + share_count * 3) DESC, drama_score DESC;

-- 에이전트별 하이라이트 통계
CREATE VIEW agent_highlight_stats AS
SELECT 
  primary_agent_id as agent_id,
  COUNT(*) as total_highlights,
  COUNT(*) FILTER (WHERE type = 'all_in') as all_in_count,
  COUNT(*) FILTER (WHERE type = 'comeback_win') as comeback_wins,
  COUNT(*) FILTER (WHERE type = 'bluff_success') as successful_bluffs,
  COUNT(*) FILTER (WHERE type = 'biggest_pot') as biggest_pot_wins,
  MAX(pot_amount) as max_pot_won,
  SUM(pot_amount) as total_pots_won
FROM highlights
GROUP BY primary_agent_id;

-- ========================================
-- Functions
-- ========================================

-- 드라마 점수 계산 함수
CREATE OR REPLACE FUNCTION calculate_drama_score(
  p_type highlight_type,
  p_pot_amount INTEGER,
  p_context JSONB DEFAULT '{}'
) RETURNS INTEGER AS $$
DECLARE
  base_score INTEGER := 50;
  pot_multiplier NUMERIC := 1.0;
BEGIN
  -- 타입별 기본 점수
  CASE p_type
    WHEN 'royal_flush' THEN base_score := 100;
    WHEN 'comeback_win' THEN base_score := 85;
    WHEN 'bad_beat' THEN base_score := 80;
    WHEN 'all_in' THEN base_score := 70;
    WHEN 'cooler' THEN base_score := 75;
    WHEN 'bubble_elimination' THEN base_score := 65;
    WHEN 'bluff_success' THEN base_score := 60;
    WHEN 'bluff_failure' THEN base_score := 55;
    ELSE base_score := 50;
  END CASE;
  
  -- 팟 크기 복수
  IF p_pot_amount > 10000 THEN
    pot_multiplier := 1.5;
  ELSIF p_pot_amount > 5000 THEN
    pot_multiplier := 1.3;
  ELSIF p_pot_amount > 1000 THEN
    pot_multiplier := 1.1;
  END IF;
  
  -- 컨텍스트 별점
  IF p_context->>'turn_around' = 'true' THEN
    base_score := base_score + 10;
  END IF;
  
  IF p_context->>'heads_up' = 'true' THEN
    base_score := base_score + 5;
  END IF;
  
  RETURN LEAST(100, FLOOR(base_score * pot_multiplier));
END;
$$ LANGUAGE plpgsql;

-- 하이라이트 생성 트리거 (선택적)
-- INSERT 시 자동으로 드라마 점수 계산
CREATE OR REPLACE FUNCTION auto_calculate_drama_score()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.drama_score IS NULL OR NEW.drama_score = 50 THEN
    NEW.drama_score := calculate_drama_score(NEW.type, NEW.pot_amount, NEW.details);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_drama_score
  BEFORE INSERT ON highlights
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_drama_score();
