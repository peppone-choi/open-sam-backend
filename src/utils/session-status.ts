/**
 * 세션 상태 유틸리티
 * 
 * 새로운 status 필드와 레거시 isunited 필드를 동기화합니다.
 */

export type SessionStatus = 'preparing' | 'running' | 'paused' | 'finished' | 'united';

/**
 * status -> isunited 변환
 */
export function statusToIsunited(status: SessionStatus): number {
  const mapping: Record<SessionStatus, number> = {
    'preparing': 0,  // 준비중 (테스트 플레이 가능, 턴/년월 진행 ❌)
    'running': 0,    // 진행중 (정상 운영, 턴/년월 진행 ✅)
    'paused': 2,     // 폐쇄 (접속 불가, 턴 진행 ❌)
    'finished': 3,   // 종료 (천하통일 등)
    'united': 3      // 천하통일
  };
  return mapping[status] ?? 0;
}

/**
 * isunited -> status 변환
 */
export function isunitedToStatus(isunited: number): SessionStatus {
  switch (isunited) {
    case 0:
      return 'running';   // 진행중
    case 2:
      return 'preparing'; // 준비중/폐쇄 (레거시에서는 구분 안됨)
    case 3:
      return 'united';    // 천하통일
    default:
      return 'running';
  }
}

/**
 * 세션 객체의 status와 isunited를 동기화
 */
export function syncSessionStatus(session: any, newStatus: SessionStatus): void {
  session.status = newStatus;
  
  const isunitedValue = statusToIsunited(newStatus);
  
  // 레거시 필드 업데이트
  if (!session.data) session.data = {};
  if (!session.data.game_env) session.data.game_env = {};
  
  session.data.game_env.isunited = isunitedValue;
  session.data.isunited = isunitedValue;
  
  // Mixed 타입 필드 변경 알림
  session.markModified('data.game_env');
  session.markModified('data');
}

/**
 * 세션이 턴을 실행할 수 있는 상태인지 확인
 */
export function canProcessTurn(session: any): boolean {
  // 1. status 필드 우선 확인
  if (session.status) {
    return session.status === 'running';
  }
  
  // 2. 레거시 isunited 필드로 폴백
  const isunited = session.data?.game_env?.isunited ?? session.data?.isunited ?? 0;
  return isunited === 0; // 0: 운영중만 턴 실행
}

/**
 * 세션 상태 텍스트 반환 (한글)
 */
export function getStatusText(status: SessionStatus): string {
  const textMap: Record<SessionStatus, string> = {
    'preparing': '준비중',
    'running': '운영중',
    'paused': '일시정지',
    'finished': '종료',
    'united': '천하통일'
  };
  return textMap[status] ?? '알 수 없음';
}

/**
 * 세션의 현재 상태 가져오기 (status 우선, isunited 폴백)
 */
export function getCurrentStatus(session: any): SessionStatus {
  // 1. status 필드가 있으면 사용
  if (session.status) {
    return session.status;
  }
  
  // 2. 레거시 isunited로 폴백
  const isunited = session.data?.game_env?.isunited ?? session.data?.isunited ?? 0;
  return isunitedToStatus(isunited);
}
