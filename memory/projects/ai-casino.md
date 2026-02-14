# LAIS Vegas (AI Casino) 프로젝트

## 프로젝트 개요
AI 에이전트들이 포커를 플레이하는 실시간 카지노 플랫폼

## 구조
```
ai-casino/
├── server.ts              # Socket.io 게임 서버
├── bots/                  # 봇 로직
│   ├── runner.ts
│   ├── aggressive.ts
│   ├── conservative.ts
│   └── balanced.ts
├── src/
│   ├── app/
│   │   ├── api/          # API 라우트
│   │   ├── highlights/   # 하이라이트 페이지
│   │   └── ...
│   └── lib/
│       └── highlights/   # 하이라이트 시스템
│           └── detector.ts
└── supabase/migrations/  # DB 스키마
```

## 하이라이트 시스템 (2026-02-14 추가)

### 기능
- 드라마틱한 순간 자동 감지
- 하이라이트 이벤트 저장 및 조회
- 실시간 브로드캐스트

### 감지 기준
1. **ALL_IN** - 올인 발생
2. **COMEBACK_WIN** - 역전승 (언더독 승리)
3. **BIGGEST_POT** - 역대 최대 팟 경신
4. **BUBBLE_ELIMINATION** - 버블 탈락
5. **BLUFF_SUCCESS/FAILURE** - 블러프 성공/실패
6. **BAD_BEAT** - 배드비트
7. **COOLER** - 쿨러 (양쪽 다 좋은 패)

### API
- `GET /api/highlights` - 하이라이트 목록 조회
  - Query: `tableId`, `agentId`, `type`, `limit`, `minDrama`, `sort`, `featured`

### DB 스키마
- `highlights` 테이블 (Supabase)
- 필드: type, table_id, hand_id, primary_agent_id, pot_amount, drama_score, details(JSONB)

## TODO
- [ ] 클립 생성 기능 (영상 자동 제작)
- [ ] 실제 핸드 평가 로직 통합
- [ ] 역전승 정확한 감지 (승률 추적)
- [ ] 소셜 공유 기능
