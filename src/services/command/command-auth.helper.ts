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
 * - generalId: user.generalId 우선 (유효한 값일 경우), 아니면 body/query의 general_id 사용
 * - userId: user.userId || user.id
 */
export function resolveCommandAuthContext(data: any, user?: any): CommandAuthResult {
  const sessionId: string = (data && data.session_id) || 'sangokushi_default';

  // generalId: user.generalId가 유효하면 사용, 아니면 body/query fallback
  // || 연산자 사용: 0, null, undefined, '' 모두 falsy이므로 data.general_id로 fallback
  const rawGeneralId = (user?.generalId && user.generalId > 0) ? user.generalId : data?.general_id;
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
  if (!Number.isFinite(generalId) || generalId <= 0) {
    return {
      ok: false,
      error: {
        success: false,
        result: false,
        message: '유효한 장수 ID가 필요합니다',
        reason: '유효한 장수 ID가 필요합니다'
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
