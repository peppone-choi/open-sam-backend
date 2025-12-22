/**
 * SetPermission Service
 * 장수 특별 권한 설정 (외교권자/감찰관)
 * PHP의 j_general_set_permission.php 대응
 */

import { General } from '../../models';

export class SetPermissionService {
  /**
   * 장수 권한 설정
   * @param data - 요청 데이터
   * @param user - 인증된 사용자
   */
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || user?.id;
    const isAmbassador = data.isAmbassador === true || data.isAmbassador === 'true';
    const genlist: number[] = data.genlist || [];

    try {
      if (!userId) {
        return {
          result: false,
          reason: '로그인이 필요합니다'
        };
      }

      // 요청자 정보 조회
      const me = await General.findOne({
        session_id: sessionId,
        owner: String(userId)
      }).select('no data').lean() as any;

      if (!me) {
        return {
          result: false,
          reason: '장수를 찾을 수 없습니다'
        };
      }

      const myData = me.data || {};
      const officerLevel = myData.officer_level || 0;
      const nationId = myData.nation || 0;

      // 군주만 권한 설정 가능
      if (officerLevel !== 12) {
        return {
          result: false,
          reason: '군주가 아닙니다'
        };
      }

      if (nationId === 0) {
        return {
          result: false,
          reason: '국가에 소속되어 있지 않습니다'
        };
      }

      // 권한 유형 결정
      let targetType: string;
      let targetLevel: number;
      
      if (isAmbassador) {
        targetType = 'ambassador';
        targetLevel = 4;
        
        // 외교권자는 최대 2명
        if (genlist && genlist.length > 2) {
          return {
            result: false,
            reason: '외교권자는 최대 둘까지만 설정 가능합니다.'
          };
        }
      } else {
        targetType = 'auditor';
        targetLevel = 3;
      }

      // 기존 해당 권한 제거
      await General.updateMany(
        {
          session_id: sessionId,
          'data.nation': nationId,
          'data.permission': targetType
        },
        {
          $set: { 'data.permission': 'normal' }
        }
      );

      // 새로운 권한 대상이 없으면 종료
      if (!genlist || genlist.length === 0) {
        return {
          result: true,
          reason: 'success'
        };
      }

      // 후보자 조회 및 검증
      const candidates = await General.find({
        session_id: sessionId,
        'data.nation': nationId,
        'data.officer_level': { $ne: 12 },  // 군주 제외
        'data.permission': 'normal',
        $or: [
          { no: { $in: genlist } },
          { 'data.no': { $in: genlist } }
        ]
      }).select('no data').lean();

      const realCandidates: number[] = [];

      for (const candidate of candidates) {
        const candData = (candidate as any).data || {};
        const candNo = candData.no || (candidate as any).no;
        
        // 권한 레벨 체크 (헌신년도 기반)
        const maxPermission = checkSecretMaxPermission(candData);
        
        if (maxPermission >= targetLevel) {
          realCandidates.push(candNo);
        }
      }

      // 대상이 없으면 종료
      if (realCandidates.length === 0) {
        return {
          result: true,
          reason: 'success'
        };
      }

      // 권한 설정
      await General.updateMany(
        {
          session_id: sessionId,
          $or: [
            { no: { $in: realCandidates } },
            { 'data.no': { $in: realCandidates } }
          ]
        },
        {
          $set: { 'data.permission': targetType }
        }
      );

      return {
        result: true,
        reason: 'success',
        updated: realCandidates
      };
    } catch (error: any) {
      console.error('Error in SetPermission:', error);
      return {
        result: false,
        reason: error.message || '권한 설정 중 오류가 발생했습니다'
      };
    }
  }
}

/**
 * 장수의 최대 비밀 권한 레벨 계산
 * @param generalData - 장수 데이터
 * @returns 최대 권한 레벨 (0-4)
 */
function checkSecretMaxPermission(generalData: any): number {
  // 기본 권한
  let permission = 0;
  
  // 관직에 따른 권한
  const officerLevel = generalData.officer_level || 0;
  if (officerLevel >= 5) {
    permission = Math.max(permission, 2);  // 수뇌부
  }
  if (officerLevel >= 10) {
    permission = Math.max(permission, 3);  // 고위 수뇌부
  }
  if (officerLevel === 12) {
    permission = Math.max(permission, 4);  // 군주
  }
  
  // 헌신년도에 따른 권한
  const dedLevel = generalData.dedlevel || 0;
  if (dedLevel >= 12) {
    permission = Math.max(permission, 3);  // 1년 이상 봉사
  }
  if (dedLevel >= 36) {
    permission = Math.max(permission, 4);  // 3년 이상 봉사
  }
  
  // 페널티 체크
  const penalty = generalData.penalty || {};
  if (typeof penalty === 'string') {
    try {
      const parsed = JSON.parse(penalty);
      if (parsed.block_permission) {
        permission = 0;
      }
    } catch {
      // 파싱 실패 시 무시
    }
  } else if (penalty.block_permission) {
    permission = 0;
  }
  
  return permission;
}




