// @ts-nocheck - Type issues need investigation
import { InheritActionRepository } from '../../repositories/inheritaction.repository';
import { generalRepository } from '../../repositories/general.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { KVStorage } from '../../models/kv-storage.model';
import { UserRecord } from '../../models/user_record.model';
import GameConstants from '../../utils/game-constants';
import { kvStorageRepository } from '../../repositories/kvstorage.repository';

const BUFF_KEY_TEXT: Record<string, string> = {
  warAvoidRatio: '회피 확률 증가',
  warCriticalRatio: '필살 확률 증가',
  warMagicTrialProb: '계략 시도 확률 증가',
  domesticSuccessProb: '내정 성공 확률 증가',
  domesticFailProb: '내정 실패 확률 감소',
  warAvoidRatioOppose: '상대 회피 확률 감소',
  warCriticalRatioOppose: '상대 필살 확률 감소',
  warMagicTrialProbOppose: '상대 계략 시도 확률 감소',
};

const MAX_STEP = 5;

export class BuyHiddenBuffService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || data.user_id;
    const generalId = user?.generalId || data.general_id;
    
    try {
      const { type, level } = data;
      
      if (!type || typeof level !== 'number') {
        return { success: false, message: '필수 파라미터가 누락되었습니다.' };
      }
      
      if (level < 1 || level > MAX_STEP) {
        return { success: false, message: `레벨은 1~${MAX_STEP} 사이여야 합니다.` };
      }
      
      if (!BUFF_KEY_TEXT[type]) {
        return { success: false, message: '잘못된 버프 타입입니다.' };
      }
      
      const general = await generalRepository.findBySessionAndNo(sessionId, generalId );
      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다.' };
      }
      
      if (userId !== general.owner) {
        return { success: false, message: '로그인 상태가 이상합니다. 다시 로그인해 주세요.' };
      }
      
      const inheritBuffList = general.aux?.inheritBuff || {};
      const prevLevel = inheritBuffList[type] || 0;
      
      if (prevLevel === level) {
        return { success: false, message: '이미 구입했습니다.' };
      }
      
      if (prevLevel > level) {
        return { success: false, message: '이미 더 높은 등급을 구입했습니다.' };
      }
      
      const reqAmount = GameConstants.INHERIT_BUFF_POINTS[level] - GameConstants.INHERIT_BUFF_POINTS[prevLevel];
      
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
      
      const buffTypeText = BUFF_KEY_TEXT[type];
      const moreText = prevLevel > 0 ? '추가' : '';
      
      await UserRecord.create({
        session_id: sessionId,
        user_id: userId,
        log_type: 'inheritPoint',
        text: `${reqAmount} 포인트로 ${buffTypeText} ${level} 단계 ${moreText}구입`,
        year: gameEnv?.value?.year || 0,
        month: gameEnv?.value?.month || 0,
        date: new Date().toISOString()
      });
      
      inheritBuffList[type] = level;
      general.aux = general.aux || {};
      general.aux.inheritBuff = inheritBuffList;
      
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
        message: 'BuyHiddenBuff executed successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}
