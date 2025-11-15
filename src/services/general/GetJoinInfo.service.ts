import { sessionRepository } from '../../repositories/session.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { generalRepository } from '../../repositories/general.repository';
import { cityRepository } from '../../repositories/city.repository';

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
      const session = await sessionRepository.findBySessionId(sessionId );
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
      
      // 3. 국가 목록 조회 (참가 가능한 국가들) - 재야(0) 제외
      const nations = await nationRepository.findByFilter({
        session_id: sessionId
      })
        .sort({ 'data.nation': 1 })
        ;

      // KVStorage에서 scout_msg 가져오기
      const { kvStorageRepository } = await import('../../repositories/kvstorage.repository');
      const scoutMsgDocs = await kvStorageRepository.findByPattern('nation_env:*:scout_msg');
      
      const scoutMsgMap: Record<number, string> = {};
      scoutMsgDocs.forEach((doc: any) => {
        // storage_id를 사용 (예: 'nation_env:1:scout_msg')
        const storageId = doc.storage_id || doc._id;
        const match = storageId.match(/nation_env:(\d+):scout_msg/);
        if (match) {
          scoutMsgMap[parseInt(match[1])] = doc.value || doc.data?.value || '';
        }
      });

      const nationList = nations
        .map((nation: any) => {
          const nationId = nation.nation ?? 0;
          // nation이 0이면 제외 (재야/무명)
          if (nationId === 0) return null;
          return {
            nation: nationId,
            name: nation.name || '무명',
            color: nation.color || '#000000',
            scout: nation.scout || 50,
            scoutmsg: scoutMsgMap[nationId] || ''
          };
        })
        .filter((nation: any) => nation !== null);

      // 4. 상속 포인트 계산
      let inheritPoints = 0;
      if (userId) {
        // 이전 장수 조회 (같은 사용자의 이전 장수)
        const previousGeneral = await generalRepository.findBySessionAndOwner(
          sessionId,
          String(userId),
          { 'data.npc': { $lt: 2 } }
        );

        if (previousGeneral && previousGeneral.data) {
          const genData = previousGeneral.data;
          // 경험치와 공헌도에 따른 상속 포인트 계산
          const experience = genData.experience || 0;
          const dedication = genData.dedication || 0;
          inheritPoints = Math.floor((experience + dedication * 2) / 100);
        }
      }

      // 5. 기본 스탯 제한 정보
      const defaultStatMin = gameEnv.defaultStatMin || 15;
      const defaultStatMax = gameEnv.defaultStatMax || 90;
      const defaultStatTotal = gameEnv.defaultStatTotal || 275;

      // 6. 초기 위치 가능한 도시 목록 (모든 도시)
      const availableCities = await cityRepository.findByFilter({
        session_id: sessionId
      })
        ;

      const cityList = availableCities.map((city: any) => {
        return {
          id: city.city || city.id || 0, // city 필드가 실제 도시 ID
          name: city.name || '도시',
          x: city.x || 0,
          y: city.y || 0,
          nation: city.nation || 0 // 소속 국가 ID 추가
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
        joinMode: sessionData.join_mode || 'free', // 'free', 'onlyRandom'
        allowJoinNation: !(blockCreate & 4), // & 4: 소속 국가 선택 차단 (새 플래그)
        npcMode: gameEnv.npcmode || 0
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

