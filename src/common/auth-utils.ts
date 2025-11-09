/**
 * 인증 및 권한 검증 유틸리티
 *
 * 보안 검증을 표준화하기 위한 공통 함수들
 */

import { generalRepository } from '../repositories/general.repository';
import { logger } from './logger';

/**
 * 장수 소유권 검증
 *
 * @param sessionId 세션 ID
 * @param generalId 장수 ID
 * @param userId 사용자 ID
 * @returns 검증 결과 { valid: boolean, general?: General, error?: string }
 */
export async function verifyGeneralOwnership(
  sessionId: string,
  generalId: number,
  userId: string
): Promise<{ valid: boolean; general?: any; error?: string }> {
  try {
    // 장수 조회
    const general = await generalRepository.findBySessionAndNo(sessionId, generalId);

    if (!general) {
      logger.warn('[Auth] 장수를 찾을 수 없음', { sessionId, generalId, userId });
      return {
        valid: false,
        error: '장수를 찾을 수 없습니다.'
      };
    }

    // 소유권 검증
    const generalOwner = String(general.owner || '');
    const requestUserId = String(userId || '');

    if (generalOwner !== requestUserId) {
      logger.warn('[Auth] 장수 소유권 불일치', {
        sessionId,
        generalId,
        generalOwner,
        requestUserId
      });
      return {
        valid: false,
        error: '해당 장수에 대한 권한이 없습니다.'
      };
    }

    // 검증 성공
    return {
      valid: true,
      general
    };
  } catch (error: any) {
    logger.error('[Auth] 장수 소유권 검증 중 에러', {
      sessionId,
      generalId,
      userId,
      error: error.message
    });
    return {
      valid: false,
      error: '권한 검증 중 오류가 발생했습니다.'
    };
  }
}

/**
 * NPC 장수 여부 확인
 *
 * @param general 장수 객체
 * @returns NPC 여부
 */
export function isNPC(general: any): boolean {
  const npcType = general?.npc || 0;
  return npcType >= 2;
}

/**
 * 장수가 사용 가능한 상태인지 확인
 *
 * @param general 장수 객체
 * @returns 사용 가능 여부 { available: boolean, reason?: string }
 */
export function checkGeneralAvailability(general: any): {
  available: boolean;
  reason?: string;
} {
  // NPC 체크 (필요 시 주석 해제)
  // if (isNPC(general)) {
  //   return { available: false, reason: 'NPC 장수는 사용할 수 없습니다.' };
  // }

  // 전투 중 체크
  if (general.battle_id) {
    return { available: false, reason: '전투 중인 장수는 사용할 수 없습니다.' };
  }

  // 부상 체크
  const injury = general.injury || 0;
  if (injury >= 100) {
    return { available: false, reason: '부상당한 장수는 사용할 수 없습니다.' };
  }

  // 사망 체크
  if (general.death_date) {
    return { available: false, reason: '사망한 장수는 사용할 수 없습니다.' };
  }

  return { available: true };
}

/**
 * 장수 소유권 검증 (간편 버전)
 * 검증 실패 시 바로 에러 응답 객체 반환
 *
 * @param sessionId 세션 ID
 * @param generalId 장수 ID
 * @param userId 사용자 ID
 * @returns 장수 객체 또는 null (실패 시)
 */
export async function requireGeneralOwnership(
  sessionId: string,
  generalId: number,
  userId: string
): Promise<any | null> {
  const result = await verifyGeneralOwnership(sessionId, generalId, userId);

  if (!result.valid) {
    return null;
  }

  return result.general;
}
