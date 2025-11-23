// @ts-nocheck - Argument count mismatches need review
import { generalRepository } from '../../repositories/general.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { KVStorage } from '../../models/kv-storage.model';
import { kvStorageRepository } from '../../repositories/kvstorage.repository';
import { buildChiefPolicyPayload } from './helpers/policy.helper';

/**
 * SetBlockWar Service
 * 선전포고 차단 설정
 * PHP: /sam/hwe/sammo/API/Nation/SetBlockWar.php
 */
export class SetBlockWarService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const value = data.value === true || data.value === 'true' || data.value === 1;
    
    try {
      if (!generalId) {
        return { success: false, message: '장수 ID가 필요합니다' };
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

      const nationStorage = await kvStorageRepository.findOneByFilter({
        session_id: sessionId,
        storage_id: `nation_${nationId}`
      });

      const availableCnt = nationStorage?.data?.available_war_setting_cnt || 0;

      if (availableCnt <= 0) {
        return { success: false, message: '잔여 횟수가 부족합니다' };
      }

      const nationDoc = await nationRepository.findByNationNum(sessionId, nationId);
      if (!nationDoc) {
        return { success: false, message: '국가를 찾을 수 없습니다' };
      }

      await nationRepository.updateOneByFilter(
        {
          session_id: sessionId,
          'data.nation': nationId
        },
        {
          'data.war': value ? 1 : 0
        }
      );

      if (nationDoc.data) {
        nationDoc.data.war = value ? 1 : 0;
      }

      const storageFilter = {
        session_id: sessionId,
        storage_id: `nation_${nationId}`
      };

      await kvStorageRepository.updateOneByFilter(
        {
          ...storageFilter
        },
        {
          'data.available_war_setting_cnt': availableCnt - 1
        }
      );

      const updatedStorage =
        nationStorage ?? ({ data: {}, session_id: sessionId, storage_id: `nation_${nationId}` } as KVStorage);
      if (!updatedStorage.data) {
        updatedStorage.data = {};
      }
      updatedStorage.data.available_war_setting_cnt = availableCnt - 1;

      const payload = await buildChiefPolicyPayload(sessionId, nationId, {
        nationDoc,
        kvDoc: updatedStorage,
      });

      return {
        success: true,
        result: true,
        availableCnt: availableCnt - 1,
        message: value ? '선전포고가 차단되었습니다' : '선전포고가 허용되었습니다',
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
