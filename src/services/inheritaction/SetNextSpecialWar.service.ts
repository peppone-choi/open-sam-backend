// @ts-nocheck - Type issues need investigation
import { saveGeneral } from '../../common/cache/model-cache.helper';
import { InheritActionRepository } from '../../repositories/inheritaction.repository';
import { generalRepository } from '../../repositories/general.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { KVStorage } from '../../models/kv-storage.model';
import { UserRecord } from '../../models/user_record.model';
import GameConstants from '../../utils/game-constants';
import { kvStorageRepository } from '../../repositories/kvstorage.repository';

const AVAILABLE_SPECIAL_WAR = [
  'che_일격',
  'che_연격',
  'che_난전',
  'che_돌격',
  'che_사격',
  'che_복병',
  'che_저격',
  'che_보호',
  'che_격노',
  'che_격전',
  'che_질풍',
  'che_진지',
  'che_화공',
  'che_낙석',
  'che_소탕',
  'che_축성',
];

export class SetNextSpecialWarService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || data.user_id;
    const generalId = user?.generalId || data.general_id;
    
    try {
      const { type } = data;
      
      if (!type) {
        return { success: false, message: '필수 파라미터가 누락되었습니다.' };
      }
      
      if (!AVAILABLE_SPECIAL_WAR.includes(type)) {
        return { success: false, message: '잘못된 전투 특기 타입입니다.' };
      }
      
      const general = await generalRepository.findBySessionAndNo(sessionId, generalId );
      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다.' };
      }
      
      if (userId !== general.owner) {
        return { success: false, message: '로그인 상태가 이상합니다. 다시 로그인해 주세요.' };
      }
      
      const inheritSpecificSpecialWar = general.aux?.inheritSpecificSpecialWar;
      const currentSpecialWar = general.special2;
      
      if (currentSpecialWar === type) {
        return { success: false, message: '이미 그 특기를 보유하고 있습니다.' };
      }
      
      if (inheritSpecificSpecialWar === type) {
        return { success: false, message: '이미 그 특기를 예약하였습니다.' };
      }
      
      if (inheritSpecificSpecialWar !== null && inheritSpecificSpecialWar !== undefined) {
        return { success: false, message: '이미 예약한 특기가 있습니다.' };
      }
      
      const reqAmount = GameConstants.INHERIT_SPECIFIC_SPECIAL_POINT;
      
      const gameEnv = await kvStorageRepository.findOneByFilter({ session_id: sessionId, key: 'game_env' });
      if (gameEnv?.value?.isunited) {
        return { success: false, message: '이미 천하가 통일되었습니다.' };
      }
      
      const inheritStor = await kvStorageRepository.findOneByFilter({ 
        session_id: sessionId, 
        key: `inheritance_${userId}` 
      });
      
      const previousPoint = inheritStor?.value?.previous?.[0] || 0;
      
      if (previousPoint < reqAmount) {
        return { success: false, message: '충분한 유산 포인트를 가지고 있지 않습니다.' };
      }
      
      const specialWarName = type.replace('che_', '');
      
      await UserRecord.create({
        session_id: sessionId,
        user_id: userId,
        log_type: 'inheritPoint',
        text: `${reqAmount} 포인트로 다음 전투 특기로 ${specialWarName} 지정`,
        year: gameEnv?.value?.year || 0,
        month: gameEnv?.value?.month || 0,
        date: new Date().toISOString()
      });
      
      general.aux = general.aux || {};
      general.aux.inheritSpecificSpecialWar = type;
      
      if (inheritStor) {
        inheritStor.value = inheritStor.value || {};
        inheritStor.value.previous = [previousPoint - reqAmount, null];
        await inheritStor.save();
      }
      
      general.rank = general.rank || {};
      general.rank.inherit_point_spent_dynamic = (general.rank.inherit_point_spent_dynamic || 0) + reqAmount;
      
      const generalNo = general.no || general.data?.no || generalId;
      await saveGeneral(sessionId, generalNo, general);
      
      return {
        success: true,
        result: true,
        message: '다음 전투 특기를 지정했습니다.'

      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}
