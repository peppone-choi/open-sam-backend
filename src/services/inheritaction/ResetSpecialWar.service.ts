import { InheritActionRepository } from '../../repositories/inheritaction.repository';
import { generalRepository } from '../../repositories/general.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { KVStorage } from '../../models/kv-storage.model';
import { UserRecord } from '../../models/user_record.model';
import GameConstants from '../../utils/game-constants';
import { kvStorageRepository } from '../../repositories/kvstorage.repository';

export class ResetSpecialWarService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || data.user_id;
    const generalId = user?.generalId || data.general_id;
    
    try {
      const general = await generalRepository.findBySessionAndNo(sessionId, generalId );
      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다.' };
      }
      
      if (userId !== general.owner) {
        return { success: false, message: '로그인 상태가 이상합니다. 다시 로그인해 주세요.' };
      }
      
      const currentSpecialWar = general.special2;
      if (!currentSpecialWar || currentSpecialWar === 'None') {
        return { success: false, message: '이미 전투 특기가 공란입니다.' };
      }
      
      const currentLevel = general.aux?.inheritResetSpecialWar ?? -1;
      const nextLevel = currentLevel + 1;
      const reqPoint = GameConstants.calcResetAttrPoint(nextLevel);
      
      const gameEnv = await kvStorageRepository.findOneByFilter({ session_id: sessionId, key: 'game_env' });
      if (gameEnv?.value?.isunited) {
        return { success: false, message: '이미 천하가 통일되었습니다.' };
      }
      
      const inheritStor = await kvStorageRepository.findOneByFilter({ 
        session_id: sessionId, 
        key: `inheritance_${userId}` 
      });
      
      const previousPoint = inheritStor?.value?.previous?.[0] || 0;
      
      if (previousPoint < reqPoint) {
        return { success: false, message: '충분한 유산 포인트를 가지고 있지 않습니다.' };
      }
      
      await UserRecord.create({
        session_id: sessionId,
        user_id: userId,
        log_type: 'inheritPoint',
        text: `${reqPoint} 포인트로 전투 특기 초기화`,
        year: gameEnv?.value?.year || 0,
        month: gameEnv?.value?.month || 0,
        date: new Date().toISOString()
      });
      
      const oldTypeKey = 'prev_types_special2';
      general.aux = general.aux || {};
      const oldSpecialList = general.aux[oldTypeKey] || [];
      oldSpecialList.push(currentSpecialWar);
      general.aux[oldTypeKey] = oldSpecialList;
      
      general.aux.inheritResetSpecialWar = nextLevel;
      general.special2 = 'None';
      
      if (inheritStor) {
        inheritStor.value = inheritStor.value || {};
        inheritStor.value.previous = [previousPoint - reqPoint, null];
        await inheritStor.save();
      }
      
      general.rank = general.rank || {};
      general.rank.inherit_point_spent_dynamic = (general.rank.inherit_point_spent_dynamic || 0) + reqPoint;
      
      await general.save();
      
      return {
        success: true,
        result: true,
        message: 'ResetSpecialWar executed successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}
