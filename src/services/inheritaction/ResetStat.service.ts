import { InheritActionRepository } from '../../repositories/inheritaction.repository';
import { General } from '../../models/general.model';
import { Session } from '../../models/session.model';
import { KVStorage } from '../../models/kv-storage.model';
import { UserRecord } from '../../models/user_record.model';
import GameConstants from '../../utils/game-constants';

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

export class ResetStatService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || data.user_id;
    const generalId = user?.generalId || data.general_id;
    
    try {
      const { leadership, strength, intel, inheritBonusStat } = data;
      
      if (typeof leadership !== 'number' || typeof strength !== 'number' || typeof intel !== 'number') {
        return { success: false, message: '필수 파라미터가 누락되었습니다.' };
      }
      
      if (leadership < GameConstants.DEFAULT_STAT_MIN || leadership > GameConstants.DEFAULT_STAT_MAX) {
        return { success: false, message: `통솔은 ${GameConstants.DEFAULT_STAT_MIN}~${GameConstants.DEFAULT_STAT_MAX} 사이여야 합니다.` };
      }
      
      if (strength < GameConstants.DEFAULT_STAT_MIN || strength > GameConstants.DEFAULT_STAT_MAX) {
        return { success: false, message: `무력은 ${GameConstants.DEFAULT_STAT_MIN}~${GameConstants.DEFAULT_STAT_MAX} 사이여야 합니다.` };
      }
      
      if (intel < GameConstants.DEFAULT_STAT_MIN || intel > GameConstants.DEFAULT_STAT_MAX) {
        return { success: false, message: `지력은 ${GameConstants.DEFAULT_STAT_MIN}~${GameConstants.DEFAULT_STAT_MAX} 사이여야 합니다.` };
      }
      
      if (leadership + strength + intel !== GameConstants.DEFAULT_STAT_TOTAL) {
        return { success: false, message: `능력치 총합이 ${GameConstants.DEFAULT_STAT_TOTAL}이 아닙니다. 다시 입력해주세요!` };
      }
      
      let validatedBonusStat: [number, number, number] | null = null;
      
      if (inheritBonusStat) {
        if (!Array.isArray(inheritBonusStat) || inheritBonusStat.length !== 3) {
          return { success: false, message: '보너스 능력치가 잘못 지정되었습니다. 다시 입력해주세요!' };
        }
        
        for (const stat of inheritBonusStat) {
          if (stat < 0) {
            return { success: false, message: '보너스 능력치가 음수입니다. 다시 입력해주세요!' };
          }
        }
        
        const sum = inheritBonusStat.reduce((a: number, b: number) => a + b, 0);
        if (sum === 0) {
          validatedBonusStat = null;
        } else if (sum < 3 || sum > 5) {
          return { success: false, message: '보너스 능력치 합이 잘못 지정되었습니다. 다시 입력해주세요!' };
        } else {
          validatedBonusStat = inheritBonusStat as [number, number, number];
        }
      }
      
      const general = await General.findOne({ session_id: sessionId, no: generalId });
      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다.' };
      }
      
      if (userId !== general.owner) {
        return { success: false, message: '로그인 상태가 이상합니다. 다시 로그인해 주세요.' };
      }
      
      if (general.npc !== 0) {
        return { success: false, message: 'NPC는 능력치 초기화를 할 수 없습니다.' };
      }
      
      const gameEnv = await KVStorage.findOne({ session_id: sessionId, key: 'game_env' });
      if (gameEnv?.value?.isunited) {
        return { success: false, message: '이미 천하가 통일되었습니다.' };
      }
      
      const userStor = await KVStorage.findOne({ 
        session_id: sessionId, 
        key: `user_${userId}` 
      });
      
      const lastUserStatReset = userStor?.value?.last_stat_reset || [];
      const gameSeason = gameEnv?.value?.season;
      
      if (lastUserStatReset.includes(gameSeason)) {
        return { success: false, message: '이번 시즌에 이미 능력치를 초기화하셨습니다.' };
      }
      
      const inheritStor = await KVStorage.findOne({ 
        session_id: sessionId, 
        key: `inheritance_${userId}` 
      });
      
      const previousPoint = inheritStor?.value?.previous?.[0] || 0;
      let reqAmount = 0;
      
      if (validatedBonusStat !== null) {
        reqAmount += GameConstants.INHERIT_BORN_STAT_POINT;
      }
      
      if (previousPoint < reqAmount) {
        return { success: false, message: '충분한 유산 포인트를 가지고 있지 않습니다.' };
      }
      
      const userRecords = [];
      userRecords.push({
        session_id: sessionId,
        user_id: userId,
        log_type: 'inheritPoint',
        text: `통솔 ${leadership}, 무력 ${strength}, 지력 ${intel} 스탯 재설정`,
        year: gameEnv?.value?.year || 0,
        month: gameEnv?.value?.month || 0,
        date: new Date().toISOString()
      });
      
      let pleadership = 0;
      let pstrength = 0;
      let pintel = 0;
      
      if (validatedBonusStat) {
        pleadership = validatedBonusStat[0];
        pstrength = validatedBonusStat[1];
        pintel = validatedBonusStat[2];
        
        userRecords.push({
          session_id: sessionId,
          user_id: userId,
          log_type: 'inheritPoint',
          text: `${reqAmount}로 통솔 ${pleadership}, 무력 ${pstrength}, 지력 ${pintel} 보너스 능력치 적용`,
          year: gameEnv?.value?.year || 0,
          month: gameEnv?.value?.month || 0,
          date: new Date().toISOString()
        });
      } else {
        const rng = simpleRandom(`ResetStat_${userId}_${Date.now()}`);
        const bonusCount = Math.floor(rng() * 3) + 3;
        
        for (let i = 0; i < bonusCount; i++) {
          const weights = [leadership, strength, intel];
          const total = weights.reduce((a, b) => a + b, 0);
          const r = rng() * total;
          
          let cumulative = 0;
          if (r < (cumulative += weights[0])) {
            pleadership++;
          } else if (r < (cumulative += weights[1])) {
            pstrength++;
          } else {
            pintel++;
          }
        }
        
        userRecords.push({
          session_id: sessionId,
          user_id: userId,
          log_type: 'inheritPoint',
          text: `통솔 ${pleadership}, 무력 ${pstrength}, 지력 ${pintel} 보너스 능력치 적용`,
          year: gameEnv?.value?.year || 0,
          month: gameEnv?.value?.month || 0,
          date: new Date().toISOString()
        });
      }
      
      for (const record of userRecords) {
        await UserRecord.create(record);
      }
      
      lastUserStatReset.push(gameSeason);
      
      general.leadership = leadership + pleadership;
      general.strength = strength + pstrength;
      general.intel = intel + pintel;
      
      if (inheritStor) {
        inheritStor.value = inheritStor.value || {};
        inheritStor.value.previous = [previousPoint - reqAmount, null];
        await inheritStor.save();
      }
      
      if (userStor) {
        userStor.value = userStor.value || {};
        userStor.value.last_stat_reset = lastUserStatReset;
        await userStor.save();
      }
      
      general.rank = general.rank || {};
      general.rank.inherit_point_spent_dynamic = (general.rank.inherit_point_spent_dynamic || 0) + reqAmount;
      
      await general.save();
      
      return {
        success: true,
        result: true,
        message: 'ResetStat executed successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}
