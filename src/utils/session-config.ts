// @ts-nocheck - Type issues need investigation
import { Session } from '../models/session.model';

/**
 * 세션별 설정 조회
 */

const sessionCache = new Map<string, any>();

export async function getSessionConfig(sessionId: string) {
  // 캐시 확인
  if (sessionCache.has(sessionId)) {
    return sessionCache.get(sessionId);
  }
  
  // DB에서 조회
  const session = await Session.findOne({ session_id: sessionId });
  if (!session) throw new Error('세션을 찾을 수 없습니다');
  
  sessionCache.set(sessionId, session);
  return session;
}

/**
 * 커맨드가 활성화되어 있는지 확인
 */
export async function isCommandEnabled(sessionId: string, commandId: string): Promise<boolean> {
  const session = await getSessionConfig(sessionId);
  return session.commands?.[commandId]?.enabled ?? true; // 기본값: 사용 가능
}

/**
 * 커맨드 실행 시간 조회 (세션별 커스텀)
 */
export async function getCommandDuration(sessionId: string, commandId: string, defaultDuration: number): Promise<number> {
  const session = await getSessionConfig(sessionId);
  return session.commands?.[commandId]?.duration ?? defaultDuration;
}

/**
 * 커맨드 비용 조회 (세션별 커스텀)
 */
export async function getCommandCost(sessionId: string, commandId: string, defaultCost: number): Promise<number> {
  const session = await getSessionConfig(sessionId);
  return session.commands?.[commandId]?.cost ?? defaultCost;
}

/**
 * 게임 상수 조회 (세션별 오버라이드)
 */
export async function getGameConstant(sessionId: string, key: string, defaultValue: number): Promise<number> {
  const session = await getSessionConfig(sessionId);
  return session.game_constants?.[key] ?? defaultValue;
}

/**
 * 캐시 초기화
 */
export function clearSessionCache(sessionId?: string) {
  if (sessionId) {
    sessionCache.delete(sessionId);
  } else {
    sessionCache.clear();
  }
}
