import { Session } from '../../models/session.model';
import { Nation } from '../../models/nation.model';
import { General } from '../../models/general.model';
import { City } from '../../models/city.model';

/**
 * GetJoinInfo Service
 * 장수 생성에 필요한 정보 반환
 * PHP: j_join.php의 join 데이터 부분
 */
export class GetJoinInfoService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || user?.id;

    try {
      // 1. 세션 정보 조회
      const session = await (Session as any).findOne({ session_id: sessionId }).lean();
      if (!session) {
        return {
          result: false,
          reason: '세션을 찾을 수 없습니다'
        };
      }

      const sessionData = session.config || session.data || {};
      const gameEnv = sessionData.game_env || {};

      // 2. 장수 생성 가능 여부 확인
      const blockCreate = gameEnv.block_general_create || 0;
      
      // 3. 국가 목록 조회 (참가 가능한 국가들)
      const nations = await (Nation as any).find({
        session_id: sessionId
      })
        .sort({ 'data.nation': 1 })
        .lean();

      const nationList = nations.map((nation: any) => {
        const nationData = nation.data || {};
        return {
          nation: nationData.nation || 0,
          name: nationData.name || '무명',
          color: nationData.color || '#000000',
          scout: nationData.scout || 50,
          scoutmsg: nationData.scoutmsg || ''
        };
      });

      // 4. 상속 포인트 계산
      let inheritPoints = 0;
      if (userId) {
        // 이전 장수 조회 (같은 사용자의 이전 장수)
        const previousGeneral = await (General as any).findOne({
          session_id: sessionId,
          owner: String(userId),
          'data.npc': { $lt: 2 }
        })
          .sort({ 'data.die_turn': -1 })
          .lean();

        if (previousGeneral && previousGeneral.data) {
          const genData = previousGeneral.data;
          // 경험치와 공헌도에 따른 상속 포인트 계산
          const experience = genData.experience || 0;
          const dedication = genData.dedication || 0;
          inheritPoints = Math.floor((experience + dedication * 2) / 100);
        }
      }

      // 5. 기본 스탯 제한 정보
      const defaultStatMin = gameEnv.defaultStatMin || 40;
      const defaultStatMax = gameEnv.defaultStatMax || 100;
      const defaultStatTotal = gameEnv.defaultStatTotal || 240;

      // 6. 초기 위치 가능한 도시 목록 (야인 시작 가능 도시)
      const availableCities = await (City as any).find({
        session_id: sessionId,
        'data.nation': 0 // 야인 도시
      })
        .limit(20)
        .lean();

      const cityList = availableCities.map((city: any) => {
        const cityData = city.data || {};
        return {
          id: cityData.id || 0,
          name: cityData.name || '도시',
          x: cityData.x || 0,
          y: cityData.y || 0
        };
      });

      return {
        result: true,
        nations: nationList,
        inheritPoints: inheritPoints,
        statLimits: {
          min: defaultStatMin,
          max: defaultStatMax,
          total: defaultStatTotal
        },
        cities: cityList,
        blockCreate: blockCreate,
        joinMode: sessionData.join_mode || 0
      };
    } catch (error: any) {
      console.error('GetJoinInfo error:', error);
      return {
        result: false,
        reason: error.message || '정보 조회 실패'
      };
    }
  }
}

