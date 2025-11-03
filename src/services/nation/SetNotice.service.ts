import { General } from '../../models/general.model';
import { KVStorage } from '../../models/kv-storage.model';

/**
 * SetNotice Service
 * 국가 공지 설정
 * PHP: /sam/hwe/sammo/API/Nation/SetNotice.php
 */
export class SetNoticeService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const msg = data.msg || '';
    
    try {
      if (!generalId) {
        return { success: false, message: '장수 ID가 필요합니다' };
      }

      if (msg.length > 16384) {
        return { success: false, message: '공지는 최대 16384자까지 가능합니다' };
      }

      const general = await (General as any).findOne({
        session_id: sessionId,
        'data.no': generalId
      });

      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다' };
      }

      const officerLevel = general.data?.officer_level || 0;
      const permission = general.data?.permission || 'normal';
      const nationId = general.data?.nation || 0;
      const generalName = general.data?.name || '무명';

      if (officerLevel < 5 && permission !== 'ambassador') {
        return { success: false, message: '권한이 부족합니다' };
      }

      if (nationId === 0) {
        return { success: false, message: '국가에 소속되어 있어야 합니다' };
      }

      const noticeData = {
        date: new Date(),
        msg: msg,
        author: generalName,
        authorID: generalId
      };

      const existingStorage = await (KVStorage as any).findOne({
        session_id: sessionId,
        storage_id: `nation_${nationId}`
      });

      if (existingStorage) {
        await (KVStorage as any).updateOne(
          {
            session_id: sessionId,
            storage_id: `nation_${nationId}`
          },
          {
            $set: {
              'data.nationNotice': noticeData
            }
          }
        );
      } else {
        await (KVStorage as any).create({
          session_id: sessionId,
          storage_id: `nation_${nationId}`,
          data: {
            nationNotice: noticeData
          }
        });
      }

      return {
        success: true,
        result: true,
        message: '국가 공지가 설정되었습니다'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}
