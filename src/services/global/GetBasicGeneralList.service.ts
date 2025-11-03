import { General } from '../../models/general.model';
import { Nation } from '../../models/nation.model';

/**
 * GetBasicGeneralList Service
 * 기본 장수 리스트 조회 (PHP: j_get_basic_general_list.php)
 * 국가별로 그룹화된 간단한 장수 정보 반환
 */
export class GetBasicGeneralListService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    
    try {
      // 모든 장수 조회 (no, name, npc, nation만)
      const generals = await (General as any).find({ session_id: sessionId })
        .select('no name owner data')
        .lean();

      // 국가 정보 조회
      const nations = await (Nation as any).find({ session_id: sessionId })
        .select('nation name color')
        .lean();

      const nationMap: Record<number, any> = {};
      for (const nation of nations) {
        nationMap[nation.nation] = {
          nation: nation.nation,
          name: nation.name || '무명',
          color: nation.color || '#000000'
        };
      }

      // 장수 데이터 변환
      const rawList: Record<number, any> = {};
      for (const general of generals) {
        const genData = general.data || {};
        rawList[general.no] = {
          no: general.no,
          name: general.name || '무명',
          npc: general.owner === 'NPC' ? 1 : 0,
          nation: genData.nation || 0
        };
      }

      // 사용자 장수 정보
      const userGeneralId = generalId || null;
      const userNationId = userGeneralId ? (rawList[userGeneralId]?.nation || 0) : 0;

      // 국가별로 그룹화
      const resultList: Record<number, any[]> = {};
      for (const general of Object.values(rawList)) {
        const nationId = general.nation || 0;
        if (!resultList[nationId]) {
          resultList[nationId] = [];
        }
        resultList[nationId].push([
          general.no,
          general.name,
          general.npc
        ]);
      }

      return {
        result: true,
        reason: 'success',
        nationID: userNationId,
        generalID: userGeneralId || 0,
        column: ['no', 'name', 'npc'],
        list: resultList,
        nation: nationMap
      };
    } catch (error: any) {
      console.error('GetBasicGeneralList error:', error);
      return {
        result: false,
        reason: error.message || '장수 목록 조회 실패'
      };
    }
  }
}

