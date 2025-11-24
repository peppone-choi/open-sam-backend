// @ts-nocheck - Argument count mismatches need review
import { generalRepository } from '../../repositories/general.repository';
import { kvStorageRepository } from '../../repositories/kvstorage.repository';
import { buildChiefPolicyPayload } from './helpers/policy.helper';
import { verifyGeneralOwnership } from '../../common/auth-utils';

/**
 * SetNotice Service
 * 국가 공지 설정
 * PHP: /sam/hwe/sammo/API/Nation/SetNotice.php
 */
export class SetNoticeService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const userId = user?.userId || user?.id;
    const msg = data.msg || '';
    
    try {
      if (!generalId) {
        return { success: false, message: '장수 ID가 필요합니다' };
      }

      if (!userId) {
        return { success: false, message: '사용자 인증이 필요합니다' };
      }

      const ownershipCheck = await verifyGeneralOwnership(sessionId, Number(generalId), String(userId));
      if (!ownershipCheck.valid) {
        return { success: false, message: ownershipCheck.error || '해당 장수에 대한 권한이 없습니다.' };
      }
 
      if (msg.length > 16384) {
        return { success: false, message: '공지는 최대 16384자까지 가능합니다' };
      }
 
      const general = await generalRepository.findBySessionAndNo(sessionId, generalId);


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

      const existingStorage = await kvStorageRepository.findOneByFilter({
        session_id: sessionId,
        storage_id: `nation_${nationId}`
      });

      let storageDoc = existingStorage;
      if (storageDoc) {
        await kvStorageRepository.updateOneByFilter(
          {
            session_id: sessionId,
            storage_id: `nation_${nationId}`
          },
          {
            'data.nationNotice': noticeData
          }
        );
      } else {
        storageDoc = await kvStorageRepository.create({
          session_id: sessionId,
          storage_id: `nation_${nationId}`,
          data: {
            nationNotice: noticeData
          }
        });
      }

      if (storageDoc) {
        if (!storageDoc.data) {
          storageDoc.data = {};
        }
        storageDoc.data.nationNotice = noticeData;
      }

      const payload = await buildChiefPolicyPayload(sessionId, nationId, { kvDoc: storageDoc });
      if (payload?.notices?.nation) {
        payload.notices.nation = noticeData;
      }

      return {
        success: true,
        result: true,
        message: '국가 공지가 설정되었습니다',
        policy: payload?.policy,
        warSettingCnt: payload?.warSettingCnt,
        notices: payload?.notices,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}
