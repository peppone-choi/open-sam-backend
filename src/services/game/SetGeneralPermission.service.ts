/**
 * Set General Permission Service
 * 장수 권한 설정 (j_general_set_permission.php)
 */

import { generalRepository } from '../../repositories/general.repository';
import { logger } from '../../common/logger';

export class SetGeneralPermissionService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || user?.id;
    
    if (!userId) {
      return {
        result: false,
        reason: '인증이 필요합니다'
      };
    }

    try {
      // 자신의 장수 조회 (군주인지 확인)
      const me = await generalRepository.findBySessionAndOwner(sessionId, String(userId));

      if (!me) {
        return {
          result: false,
          reason: '장수를 찾을 수 없습니다'
        };
      }

      const meData = me.data || {};
      
      // 군주 권한 확인 (officer_level = 12)
      if (meData.officer_level !== 12) {
        return {
          result: false,
          reason: '군주가 아닙니다'
        };
      }

      const nationId = meData.nation || 0;
      const isAmbassador = data.isAmbassador === true;
      const genList = data.genlist || [];

      // 권한 타입 설정
      const targetType = isAmbassador ? 'ambassador' : 'auditor';
      const targetLevel = isAmbassador ? 4 : 3;

      // 외교권자는 최대 2명까지만
      if (isAmbassador && genList.length > 2) {
        return {
          result: false,
          reason: '외교권자는 최대 둘까지만 설정 가능합니다.'
        };
      }

      // 기존 권한 제거
      await generalRepository.updateManyByFilter(
        {
          session_id: sessionId,
          'data.nation': nationId,
          'data.permission': targetType
        },
        {
          $set: { 'data.permission': 'normal' }
        }
      );

      // 권한 부여할 장수 목록이 없으면 종료
      if (!genList || genList.length === 0) {
        return {
          result: true,
          reason: 'success'
        };
      }

      // 권한 부여 가능한 장수 조회
      const candidates = await generalRepository.findByFilter({
        session_id: sessionId,
        'data.nation': nationId,
        'data.officer_level': { $ne: 12 }, // 군주 제외
        'data.permission': 'normal',
        'data.no': { $in: genList }
      });

      const realCandidates: number[] = [];
      for (const candidate of candidates) {
        const candData = candidate.data || {};
        // 최대 권한 확인 (간단화 - 실제로는 더 복잡한 로직 필요)
        const maxPermission = this.checkSecretMaxPermission(candData);
        if (maxPermission >= targetLevel) {
          realCandidates.push(candData.no || candidate.no);
        }
      }

      // 권한 부여
      if (realCandidates.length > 0) {
        await generalRepository.updateManyByFilter(
          {
            session_id: sessionId,
            'data.no': { $in: realCandidates }
          },
          {
            $set: { 'data.permission': targetType }
          }
        );
      }

      logger.info('장수 권한 설정 완료', { userId, sessionId, targetType, count: realCandidates.length });

      return {
        result: true,
        reason: 'success'
      };
    } catch (error: any) {
      logger.error('장수 권한 설정 실패', { error: error.message });
      return {
        result: false,
        reason: error.message
      };
    }
  }

  private static checkSecretMaxPermission(genData: any): number {
    // 간단화된 버전 - 실제로는 penalty 등 복잡한 로직 필요
    const officerLevel = genData.officer_level || 0;
    
    // 관직 레벨에 따른 최대 권한
    if (officerLevel >= 12) return 5; // 군주
    if (officerLevel >= 8) return 4; // 대신
    if (officerLevel >= 5) return 3; // 중신
    if (officerLevel >= 2) return 2; // 일반
    return 1; // 무관
  }
}


