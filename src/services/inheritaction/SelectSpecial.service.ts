import { InheritActionRepository } from '../../repositories/inheritaction.repository';
import { General } from '../../models/general.model';
import { Session } from '../../models/session.model';
import { KVStorage } from '../../models/kv-storage.model';
import { UserRecord } from '../../models/user_record.model';
import GameConstants from '../../utils/game-constants';

export class SelectSpecialService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || data.user_id;
    const generalId = user?.generalId || data.general_id;
    
    try {
      const { specialType } = data;
      
      if (!specialType) {
        return { success: false, message: '필수 파라미터가 누락되었습니다.' };
      }
      
      const general = await General.findOne({ session_id: sessionId, no: generalId });
      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다.' };
      }
      
      if (userId !== general.owner) {
        return { success: false, message: '로그인 상태가 이상합니다. 다시 로그인해 주세요.' };
      }
      
      const gameEnv = await KVStorage.findOne({ session_id: sessionId, key: 'game_env' });
      if (gameEnv?.value?.isunited) {
        return { success: false, message: '이미 천하가 통일되었습니다.' };
      }
      
      const inheritStor = await KVStorage.findOne({ 
        session_id: sessionId, 
        key: `inheritance_${userId}` 
      });
      
      const previousPoint = inheritStor?.value?.previous?.[0] || 0;
      const reqAmount = GameConstants.INHERIT_SPECIFIC_SPECIAL_POINT;
      
      if (previousPoint < reqAmount) {
        return { success: false, message: '충분한 유산 포인트를 가지고 있지 않습니다.' };
      }
      
      await UserRecord.create({
        session_id: sessionId,
        user_id: userId,
        log_type: 'inheritPoint',
        text: `${reqAmount} 포인트로 ${specialType} 특기 선택`,
        year: gameEnv?.value?.year || 0,
        month: gameEnv?.value?.month || 0,
        date: new Date().toISOString()
      });
      
      general.aux = general.aux || {};
      general.aux.selectedSpecial = specialType;
      
      if (inheritStor) {
        inheritStor.value = inheritStor.value || {};
        inheritStor.value.previous = [previousPoint - reqAmount, null];
        await inheritStor.save();
      }
      
      general.rank = general.rank || {};
      general.rank.inherit_point_spent_dynamic = (general.rank.inherit_point_spent_dynamic || 0) + reqAmount;
      
      await general.save();
      
      return {
        success: true,
        result: true,
        message: 'SelectSpecial executed successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}
