export interface CommandAuthContext {
  sessionId: string;
  generalId: number;
  userId: string;
}

export interface CommandAuthError {
  success: false;
  result: false;
  message: string;
  reason: string;
}

export interface CommandAuthResult {
  ok: boolean;
  context?: CommandAuthContext;
  error?: CommandAuthError;
}

/**
 * 공통으로 sessionId / generalId / userId를 추출하고 검증하는 헬퍼
 * - generalId: user.generalId 우선, body/query 의 general_id 보조
 * - userId: user.userId || user.id
 */
export function resolveCommandAuthContext(data: any, user?: any): CommandAuthResult {
  const sessionId: string = (data && data.session_id) || 'sangokushi_default';

  // generalId: user.generalId 우선, body/query fallback
  const rawGeneralId = user?.generalId ?? data?.general_id;
  if (rawGeneralId === undefined || rawGeneralId === null || rawGeneralId === '') {
    return {
      ok: false,
      error: {
        success: false,
        result: false,
        message: '장수 ID가 필요합니다',
        reason: '장수 ID가 필요합니다'
      }
    };
  }

  const generalId = Number(rawGeneralId);
  if (!Number.isFinite(generalId) || generalId === 0) {
    return {
      ok: false,
      error: {
        success: false,
        result: false,
        message: '장수 ID가 필요합니다',
        reason: '장수 ID가 필요합니다'
      }
    };
  }

  // userId: user.userId || user.id
  const rawUserId = user?.userId ?? user?.id;
  if (!rawUserId) {
    return {
      ok: false,
      error: {
        success: false,
        result: false,
        message: '사용자 인증이 필요합니다',
        reason: '사용자 인증이 필요합니다'
      }
    };
  }

  return {
    ok: true,
    context: {
      sessionId,
      generalId,
      userId: String(rawUserId)
    }
  };
}
