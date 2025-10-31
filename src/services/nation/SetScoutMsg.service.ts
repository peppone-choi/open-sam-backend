import { General } from '../../models/general.model';
import { KVStorage } from '../../models/kv-storage.model';

/**
 * SetScoutMsg Service
 * 임관 메시지 설정
 * PHP: /sam/hwe/sammo/API/Nation/SetScoutMsg.php
 */
export class SetScoutMsgService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const msg = data.msg || '';
    
    try {
      if (!generalId) {
        return { success: false, message: '장수 ID가 필요합니다' };
      }

      if (msg.length > 1000) {
        return { success: false, message: '임관 메시지는 최대 1000자까지 가능합니다' };
      }

      const general = await General.findOne({
        session_id: sessionId,
        'data.no': generalId
      });

      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다' };
      }

      const officerLevel = general.data?.officer_level || 0;
      const permission = general.data?.permission || 'normal';
      const nationId = general.data?.nation || 0;

      if (officerLevel < 5 && permission !== 'ambassador') {
        return { success: false, message: '권한이 부족합니다' };
      }

      if (nationId === 0) {
        return { success: false, message: '국가에 소속되어 있어야 합니다' };
      }

      const existingStorage = await KVStorage.findOne({
        session_id: sessionId,
        storage_id: `nation_${nationId}`
      });

      if (existingStorage) {
        await KVStorage.updateOne(
          {
            session_id: sessionId,
            storage_id: `nation_${nationId}`
          },
          {
            $set: {
              'data.scout_msg': msg
            }
          }
        );
      } else {
        await KVStorage.create({
          session_id: sessionId,
          storage_id: `nation_${nationId}`,
          data: {
            scout_msg: msg
          }
        });
      }

      return {
        success: true,
        result: true,
        message: '임관 메시지가 설정되었습니다'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}
