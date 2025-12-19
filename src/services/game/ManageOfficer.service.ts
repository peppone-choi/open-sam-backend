// @ts-nocheck - Pending full type alignment
import { generalRepository } from '../../repositories/general.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { cityRepository } from '../../repositories/city.repository';
import { GetOfficerInfoService } from '../info/GetOfficerInfo.service';
import { GameConst } from '../../constants/GameConst';

const CHIEF_STAT_MIN = GameConst.chiefStatMin || GameConst.defaultStat || 70;

const error = (reason: string) => ({ result: false, reason });

function bitMask(level: number): number {
  return 1 << level;
}

function isOfficerSet(mask: number, level: number): boolean {
  return (mask & bitMask(level)) !== 0;
}

function addOfficerSet(mask: number, level: number): number {
  return mask | bitMask(level);
}

function normalizeGeneral(doc: any) {
  if (!doc) return null;
  const data = doc.data || {};
  return {
    session_id: doc.session_id || data.session_id,
    no: data.no ?? doc.no,
    name: data.name ?? doc.name,
    nation: data.nation ?? doc.nation ?? 0,
    officer_level: data.officer_level ?? doc.officer_level ?? 0,
    officer_city: data.officer_city ?? doc.officer_city ?? 0,
    strength: data.strength ?? doc.strength ?? 0,
    intel: data.intel ?? doc.intel ?? 0,
    penalty: data.penalty || doc.penalty || {},
  };
}

async function loadGeneral(sessionId: string, generalNo: number) {
  if (!generalNo) return null;
  const cached = await generalRepository.findBySessionAndNo(sessionId, generalNo);
  if (cached) {
    return normalizeGeneral(cached);
  }
  const fromDb = await generalRepository.findOneByFilter({
    session_id: sessionId,
    $or: [{ 'data.no': generalNo }, { no: generalNo }],
  });
  return normalizeGeneral(fromDb);
}

async function demoteExistingChiefs(sessionId: string, nationId: number, officerLevel: number, excludeGeneralNo?: number) {
  const currentChiefs = await generalRepository
    .findByFilter({
      session_id: sessionId,
      $or: [
        { 'data.nation': nationId, 'data.officer_level': officerLevel },
        { nation: nationId, officer_level: officerLevel },
      ],
    })
    .lean();

  for (const chief of currentChiefs || []) {
    const chiefNo = chief?.data?.no ?? chief?.no;
    if (!chiefNo || (excludeGeneralNo && chiefNo === excludeGeneralNo)) {
      continue;
    }
    await generalRepository.updateBySessionAndNo(sessionId, chiefNo, {
      officer_level: 1,
      officer_city: 0,
      'data.officer_level': 1,
      'data.officer_city': 0,
    });
  }
}

async function demoteExistingCityOfficers(sessionId: string, officerLevel: number, cityId: number, excludeGeneralNo?: number) {
  const currentOfficers = await generalRepository
    .findByFilter({
      session_id: sessionId,
      $or: [
        { 'data.officer_level': officerLevel, 'data.officer_city': cityId },
        { officer_level: officerLevel, officer_city: cityId },
      ],
    })
    .lean();

  for (const officer of currentOfficers || []) {
    const officerNo = officer?.data?.no ?? officer?.no;
    if (!officerNo || (excludeGeneralNo && officerNo === excludeGeneralNo)) {
      continue;
    }
    await generalRepository.updateBySessionAndNo(sessionId, officerNo, {
      officer_level: 1,
      officer_city: 0,
      'data.officer_level': 1,
      'data.officer_city': 0,
    });
  }
}

export class ManageOfficerService {
  static async appoint(data: any, user?: any) {
    const sessionId = data.session_id || data.serverID || 'sangokushi_default';
    const officerLevel = Number(data.officerLevel ?? data.officer_level);
    const destGeneralID = Number(data.destGeneralID ?? data.dest_general_id ?? 0);
    const destCityID = Number(data.destCityID ?? data.dest_city_id ?? 0);
    const userId = user?.userId || user?.id;

    if (!userId) {
      return error('인증이 필요합니다.');
    }

    if (!officerLevel || Number.isNaN(officerLevel)) {
      return error('임명할 관직이 지정되지 않았습니다.');
    }

    if (officerLevel >= 12 || officerLevel < 2) {
      return error('지원하지 않는 관직입니다.');
    }

    const actor = await generalRepository.findBySessionAndOwner(sessionId, String(userId));
    if (!actor) {
      return error('장수를 찾을 수 없습니다.');
    }

    const actorData = actor.data || {};
    const actorNation = actorData.nation ?? actor.nation ?? 0;
    const actorOfficerLevel = actorData.officer_level ?? actor.officer_level ?? 0;

    if (actorNation === 0) {
      return error('국가에 소속되어 있지 않습니다.');
    }

    if (actorOfficerLevel < 5) {
      return error('수뇌만 관직을 임명할 수 있습니다.');
    }

    // 군주(레벨 12)는 다른 군주를 임명할 수 없음 (자기 자리를 빼앗길 수 있음)
    // 또한 자신과 동등하거나 높은 관직을 임명할 수 없음
    if (officerLevel >= actorOfficerLevel) {
      return error('자신과 동등하거나 상급 관직은 임명할 수 없습니다.');
    }

    if (officerLevel >= 5) {
      return this.appointChief({ sessionId, nationId: actorNation, officerLevel, destGeneralID });
    }

    if (officerLevel >= 2 && officerLevel <= 4) {
      if (!destCityID) {
        return error('도시가 지정되지 않았습니다.');
      }
      return this.appointCityOfficer({ sessionId, nationId: actorNation, officerLevel, destGeneralID, destCityID });
    }

    return error('지원하지 않는 관직입니다.');
  }

  private static async appointChief({ sessionId, nationId, officerLevel, destGeneralID }: { sessionId: string; nationId: number; officerLevel: number; destGeneralID: number; }) {
    const nationDoc: any = await nationRepository.findByNationNum(sessionId, nationId);
    if (!nationDoc) {
      return error('국가를 찾을 수 없습니다.');
    }
    const nationData = nationDoc.data || {};
    const nationLevel = nationData.level ?? nationDoc.level ?? 0;
    const chiefSet = nationData.chief_set || 0;

    const minOfficerLevel = GetOfficerInfoService.getNationChiefLevel(nationLevel);
    if (officerLevel < minOfficerLevel) {
      return error('임명할 수 없는 관직입니다.');
    }

    if (isOfficerSet(chiefSet, officerLevel)) {
      return error('이번 턴에는 이미 임명했습니다.');
    }

    const destGeneral = await loadGeneral(sessionId, destGeneralID);
    if (destGeneralID && !destGeneral) {
      return error('임명할 장수를 찾을 수 없습니다.');
    }

    if (destGeneral && destGeneral.nation !== nationId) {
      return error('아국 장수만 임명할 수 있습니다.');
    }

    if (destGeneral) {
      if (officerLevel === 11) {
        // allow any stats
      } else if (officerLevel % 2 === 0) {
        if ((destGeneral.strength ?? 0) < CHIEF_STAT_MIN) {
          return error('무력이 부족합니다.');
        }
      } else {
        if ((destGeneral.intel ?? 0) < CHIEF_STAT_MIN) {
          return error('지력이 부족합니다.');
        }
      }
    }

    await demoteExistingChiefs(sessionId, nationId, officerLevel, destGeneral?.no);

    if (destGeneral) {
      await generalRepository.updateBySessionAndNo(sessionId, destGeneral.no, {
        officer_level: officerLevel,
        officer_city: 0,
        'data.officer_level': officerLevel,
        'data.officer_city': 0,
      });
    }

    const updatedChiefSet = destGeneral ? addOfficerSet(chiefSet, officerLevel) : chiefSet;
    await nationRepository.updateByNationNum(sessionId, nationId, {
      data: {
        ...nationData,
        chief_set: updatedChiefSet,
      },
    });

    return {
      result: true,
      message: destGeneral ? `${destGeneral.name}을(를) 임명했습니다.` : '관직을 비웠습니다.',
    };
  }

  private static async appointCityOfficer({ sessionId, nationId, officerLevel, destGeneralID, destCityID }: { sessionId: string; nationId: number; officerLevel: number; destGeneralID: number; destCityID: number; }) {
    const cityDoc: any = await cityRepository.findByCityNum(sessionId, destCityID);
    if (!cityDoc) {
      return error('도시를 찾을 수 없습니다.');
    }

    const cityNation = cityDoc.nation ?? cityDoc.data?.nation ?? 0;
    if (cityNation !== nationId) {
      return error('아국 도시가 아닙니다.');
    }

    const officerSet = cityDoc.officer_set ?? cityDoc.data?.officer_set ?? 0;
    if (destGeneralID && isOfficerSet(officerSet, officerLevel)) {
      return error('이미 다른 장수가 임명되었습니다.');
    }

    const destGeneral = await loadGeneral(sessionId, destGeneralID);
    if (destGeneralID && !destGeneral) {
      return error('임명할 장수를 찾을 수 없습니다.');
    }

    if (destGeneral && destGeneral.nation !== nationId) {
      return error('아국 장수만 임명할 수 있습니다.');
    }

    if (destGeneral) {
      if (officerLevel === 4 && (destGeneral.strength ?? 0) < CHIEF_STAT_MIN) {
        return error('무력이 부족합니다.');
      }
      if (officerLevel === 3 && (destGeneral.intel ?? 0) < CHIEF_STAT_MIN) {
        return error('지력이 부족합니다.');
      }
    }

    await demoteExistingCityOfficers(sessionId, officerLevel, destCityID, destGeneral?.no);

    if (destGeneral) {
      await generalRepository.updateBySessionAndNo(sessionId, destGeneral.no, {
        officer_level: officerLevel,
        officer_city: destCityID,
        'data.officer_level': officerLevel,
        'data.officer_city': destCityID,
      });
    }

    const updatedOfficerSet = destGeneral ? addOfficerSet(officerSet, officerLevel) : officerSet;
    await cityRepository.updateByCityNum(sessionId, destCityID, {
      officer_set: updatedOfficerSet,
      data: {
        ...(cityDoc.data || {}),
        officer_set: updatedOfficerSet,
      },
    });

    return {
      result: true,
      message: destGeneral ? `${destGeneral.name}을(를) 임명했습니다.` : '관직을 비웠습니다.',
    };
  }
}
