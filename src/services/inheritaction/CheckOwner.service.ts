import { InheritActionRepository } from '../../repositories/inheritaction.repository';
import { General } from '../../models/general.model';
import { Session } from '../../models/session.model';
import { KVStorage } from '../../models/kv-storage.model';
import { UserRecord } from '../../models/user_record.model';
import { User } from '../../models/user.model';
import { Message } from '../../models/message.model';
import { Nation } from '../../models/nation.model';
import GameConstants from '../../utils/game-constants';

export class CheckOwnerService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || data.user_id;
    const generalId = user?.generalId || data.general_id;
    
    try {
      const { destGeneralID } = data;
      
      if (!destGeneralID || typeof destGeneralID !== 'number') {
        return { success: false, message: '필수 파라미터가 누락되었습니다.' };
      }
      
      if (destGeneralID < 1) {
        return { success: false, message: '잘못된 장수 ID입니다.' };
      }
      
      if (generalId === destGeneralID) {
        return { success: false, message: '자신의 정보는 확인할 수 없습니다.' };
      }
      
      const general = await General.findOne({ session_id: sessionId, no: generalId });
      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다.' };
      }
      
      if (userId !== general.owner) {
        return { success: false, message: '로그인 상태가 이상합니다. 다시 로그인해 주세요.' };
      }
      
      const destGeneral = await General.findOne({ session_id: sessionId, no: destGeneralID });
      if (!destGeneral) {
        return { success: false, message: '대상 장수가 존재하지 않습니다.' };
      }
      
      if (!destGeneral.owner) {
        return { success: false, message: '대상 장수는 NPC입니다.' };
      }
      
      const gameEnv = await KVStorage.findOne({ session_id: sessionId, key: 'game_env' });
      if (gameEnv?.value?.isunited) {
        return { success: false, message: '이미 천하가 통일되었습니다.' };
      }
      
      const reqPoint = GameConstants.INHERIT_CHECK_OWNER_POINT;
      
      const inheritStor = await KVStorage.findOne({ 
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
        text: `${reqPoint} 포인트로 장수 소유자 확인`,
        year: gameEnv?.value?.year || 0,
        month: gameEnv?.value?.month || 0,
        date: new Date().toISOString()
      });
      
      const destOwner = await User.findOne({ no: destGeneral.owner });
      const destOwnerName = destGeneral.owner_name || destOwner?.name || '알수없음';
      
      const srcNation = await Nation.findOne({ session_id: sessionId, nation: general.nation });
      
      await Message.create({
        session_id: sessionId,
        src_general_id: 0,
        src_general_name: 'System',
        src_nation: 0,
        src_nation_name: 'System',
        src_nation_color: '#000000',
        dest_general_id: generalId,
        dest_general_name: general.name,
        dest_nation: general.nation,
        dest_nation_name: srcNation?.name || '',
        dest_nation_color: srcNation?.color || '#000000',
        message: `${destGeneral.name}의 소유자는 ${destOwnerName} 입니다.`,
        message_type: 'private',
        created_at: new Date(),
        expire_date: new Date('9999-12-31')
      });
      
      if (inheritStor) {
        inheritStor.value = inheritStor.value || {};
        inheritStor.value.previous = [previousPoint - reqPoint, null];
        await inheritStor.save();
      }
      
      general.rank = general.rank || {};
      general.rank.inherit_point_spent_dynamic = (general.rank.inherit_point_spent_dynamic || 0) + reqPoint;
      
      await general.save();
      
      const destNation = await Nation.findOne({ session_id: sessionId, nation: destGeneral.nation });
      
      await Message.create({
        session_id: sessionId,
        src_general_id: 0,
        src_general_name: 'System',
        src_nation: 0,
        src_nation_name: 'System',
        src_nation_color: '#000000',
        dest_general_id: destGeneralID,
        dest_general_name: destGeneral.name,
        dest_nation: destGeneral.nation,
        dest_nation_name: destNation?.name || '',
        dest_nation_color: destNation?.color || '#000000',
        message: '소유자명이 누군가에 의해 확인되었습니다.',
        message_type: 'private',
        created_at: new Date(),
        expire_date: new Date('9999-12-31')
      });
      
      return {
        success: true,
        result: true,
        message: 'CheckOwner executed successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}
