// @ts-nocheck - Argument count mismatches need review
import { generalRepository } from '../../repositories/general.repository';
import { kvStorageRepository } from '../../repositories/kvstorage.repository';
import { buildChiefPolicyPayload } from './helpers/policy.helper';

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

      const general = await generalRepository.findBySessionAndNo(sessionId, generalId);

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

      let storageDoc = await kvStorageRepository.findOneByFilter({
        session_id: sessionId,
        storage_id: `nation_${nationId}`
      });

      if (storageDoc) {
        await kvStorageRepository.updateOneByFilter(
          {
            session_id: sessionId,
            storage_id: `nation_${nationId}`
          },
          {
            'data.scout_msg': msg
          }
        );
      } else {
        storageDoc = await kvStorageRepository.create({
          session_id: sessionId,
          storage_id: `nation_${nationId}`,
          data: {
            scout_msg: msg
          }
        });
      }

      if (storageDoc) {
        if (!storageDoc.data) {
          storageDoc.data = {};
        }
        storageDoc.data.scout_msg = msg;
      }

      const payload = await buildChiefPolicyPayload(sessionId, nationId, { kvDoc: storageDoc });
      if (payload?.notices) {
        payload.notices.scout = msg;
      }

      return {
        success: true,
        result: true,
        message: '임관 메시지가 설정되었습니다',
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
