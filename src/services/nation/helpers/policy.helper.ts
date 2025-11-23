// @ts-nocheck - shared helper for chief center/policy payloads
import GameConstants from '../../../utils/game-constants';
import { nationRepository } from '../../../repositories/nation.repository';
import { kvStorageRepository } from '../../../repositories/kvstorage.repository';

interface BuildPolicyOptions {
  nationDoc?: any;
  kvDoc?: any;
}

export async function buildChiefPolicyPayload(
  sessionId: string,
  nationId: number,
  options: BuildPolicyOptions = {}
) {
  const nationDoc = options.nationDoc ?? (await nationRepository.findByNationNum(sessionId, nationId));
  if (!nationDoc) {
    return null;
  }

  const nationData = nationDoc.data || {};
  const kvDoc =
    options.kvDoc ??
    (await kvStorageRepository.findOneByFilter({
      session_id: sessionId,
      storage_id: `nation_${nationId}`,
    }));

  const nationNotice = kvDoc?.data?.nationNotice || kvDoc?.value?.nationNotice || null;
  const scoutMsg = kvDoc?.data?.scout_msg || kvDoc?.value?.scout_msg || '';
  const availableWarSettingCnt =
    kvDoc?.data?.available_war_setting_cnt || kvDoc?.value?.available_war_setting_cnt || 0;

  const policy = {
    rate: nationData.rate ?? nationDoc.rate ?? 0,
    bill: nationData.bill ?? nationDoc.bill ?? 100,
    secretLimit: nationData.secretlimit ?? nationData.secretLimit ?? 1,
    blockWar: Boolean(nationData.war ?? nationDoc.war ?? 0),
    blockScout: Boolean(nationData.scout ?? nationDoc.scout ?? 0),
  };

  const warSettingCnt = {
    remain: availableWarSettingCnt,
    inc: GameConstants.WAR_BLOCK_SETTING_INC,
    max: GameConstants.WAR_BLOCK_SETTING_MAX,
  };

  return {
    policy,
    warSettingCnt,
    notices: {
      nation: nationNotice,
      scout: scoutMsg || '',
    },
    nationDoc,
    kvDoc,
  };
}

