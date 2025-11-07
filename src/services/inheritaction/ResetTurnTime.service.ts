import { InheritActionRepository } from '../../repositories/inheritaction.repository';
import { generalRepository } from '../../repositories/general.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { KVStorage } from '../../models/kv-storage.model';
import { UserRecord } from '../../models/user_record.model';
import GameConstants from '../../utils/game-constants';
import { kvStorageRepository } from '../../repositories/kvstorage.repository';

function simpleRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  
  return () => {
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h = (h ^ (h >>> 16)) >>> 0;
    return h / 0x100000000;
  };
}

export class ResetTurnTimeService {
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
      
      const currentLevel = general.aux?.inheritResetTurnTime ?? -1;
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
      
      const turnTerm = gameEnv?.value?.turnterm || 60; // 분 단위
      
      const rng = simpleRandom(`ResetTurnTime_${userId}_${general.aux?.nextTurnTimeBase || general.turn_time}`);
      const afterTurn = rng() * turnTerm * 60;
      
      const hours = Math.floor(afterTurn / 60);
      const minutes = Math.floor(afterTurn % 60);
      
      await UserRecord.create({
        session_id: sessionId,
        user_id: userId,
        log_type: 'inheritPoint',
        text: `${reqPoint} 포인트로 턴 시간을 바꾸어 다다음 턴부터 ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} 적용`,
        year: gameEnv?.value?.year || 0,
        month: gameEnv?.value?.month || 0,
        date: new Date().toISOString()
      });
      
      general.aux = general.aux || {};
      general.aux.inheritResetTurnTime = nextLevel;
      general.aux.nextTurnTimeBase = afterTurn;
      
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
        message: 'ResetTurnTime executed successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}
