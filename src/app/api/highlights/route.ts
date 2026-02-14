import { NextRequest, NextResponse } from 'next/server';
import { getHighlights, HighlightType } from '@/lib/highlights/detector';

/**
 * GET /api/highlights
 * 하이라이트 이벤트 목록 조회
 * 
 * Query Parameters:
 * - tableId: 특정 테이블의 하이라이트만 조회
 * - agentId: 특정 에이전트의 하이라이트만 조회
 * - type: 특정 타입의 하이라이트만 조회 (all_in, comeback_win, etc.)
 * - limit: 최대 반환 개수 (기본 50, 최대 100)
 * - minDrama: 최소 드라마 점수 (0-100)
 * - sort: 정렬 방식 (drama, recent, pot)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // 파라미터 파싱
    const tableId = searchParams.get('tableId') || undefined;
    const agentId = searchParams.get('agentId') || undefined;
    const type = searchParams.get('type') as HighlightType | undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const minDrama = parseInt(searchParams.get('minDrama') || '0', 10);
    const sort = searchParams.get('sort') || 'recent';
    const featured = searchParams.get('featured') === 'true';

    // 하이라이트 조회
    let highlights = await getHighlights({
      tableId,
      agentId,
      type,
      limit,
      minDramaScore: minDrama,
    });

    // 정렬
    switch (sort) {
      case 'drama':
        highlights.sort((a, b) => b.dramaScore - a.dramaScore);
        break;
      case 'pot':
        highlights.sort((a, b) => b.potAmount - a.potAmount);
        break;
      case 'recent':
      default:
        // 이미 최신순으로 정렬됨
        break;
    }

    // 피처드 필터링
    if (featured) {
      highlights = highlights.filter(h => h.dramaScore >= 80);
    }

    // 응답 가공
    const formattedHighlights = highlights.map(h => ({
      id: `${h.tableId}_${h.handId}_${h.type}`,
      type: h.type,
      tableId: h.tableId,
      handId: h.handId,
      primaryAgent: {
        id: h.primaryAgentId,
        name: formatAgentName(h.primaryAgentId),
      },
      secondaryAgent: h.secondaryAgentId ? {
        id: h.secondaryAgentId,
        name: formatAgentName(h.secondaryAgentId),
      } : undefined,
      potAmount: h.potAmount,
      betAmount: h.betAmount,
      dramaScore: h.dramaScore,
      timestamp: new Date().toISOString(), // TODO: 실제 타임스탬프 저장
      details: {
        context: h.details.context,
        turnAround: h.details.turnAround,
        reasoning: h.details.reasoning,
        taunt: h.details.taunt,
      },
      // 타입별 아이콘/레이블
      label: getHighlightLabel(h.type),
      icon: getHighlightIcon(h.type),
      color: getHighlightColor(h.type),
    }));

    // 통계 정보
    const stats = {
      total: formattedHighlights.length,
      byType: countByType(highlights),
      avgDrama: highlights.length > 0 
        ? Math.round(highlights.reduce((a, b) => a + b.dramaScore, 0) / highlights.length)
        : 0,
      biggestPot: highlights.length > 0
        ? Math.max(...highlights.map(h => h.potAmount))
        : 0,
    };

    return NextResponse.json({
      highlights: formattedHighlights,
      stats,
      meta: {
        filters: {
          tableId,
          agentId,
          type,
          minDrama,
          sort,
          featured,
        },
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('[API Highlights] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch highlights' },
      { status: 500 }
    );
  }
}

// ========================================
// Helper Functions
// ========================================

function formatAgentName(agentId: string): string {
  // agent_xxx 형식을 보기 좋게 변환
  if (agentId.startsWith('agent_')) {
    const suffix = agentId.slice(6);
    return `Player_${suffix.slice(-4).toUpperCase()}`;
  }
  return agentId;
}

function getHighlightLabel(type: HighlightType): string {
  const labels: Record<HighlightType, string> = {
    all_in: '올인!',
    comeback_win: '역전승!',
    biggest_pot: '역대 최대 팟!',
    bubble_elimination: '버블 탈락...',
    bluff_success: '블러프 성공!',
    bluff_failure: '블러프 실패!',
    bad_beat: '배드비트!',
    cooler: '쿨러!',
    elimination: '탈락',
  };
  return labels[type];
}

function getHighlightIcon(type: HighlightType): string {
  const icons: Record<HighlightType, string> = {
    all_in: '🔥',
    comeback_win: '⚡',
    biggest_pot: '💰',
    bubble_elimination: '💀',
    bluff_success: '🎭',
    bluff_failure: '🤡',
    bad_beat: '😱',
    cooler: '❄️',
    elimination: '👋',
  };
  return icons[type];
}

function getHighlightColor(type: HighlightType): string {
  const colors: Record<HighlightType, string> = {
    all_in: 'orange',
    comeback_win: 'yellow',
    biggest_pot: 'gold',
    bubble_elimination: 'red',
    bluff_success: 'purple',
    bluff_failure: 'gray',
    bad_beat: 'pink',
    cooler: 'cyan',
    elimination: 'slate',
  };
  return colors[type];
}

function countByType(highlights: any[]): Record<string, number> {
  const counts: Record<string, number> = {};
  highlights.forEach(h => {
    counts[h.type] = (counts[h.type] || 0) + 1;
  });
  return counts;
}
