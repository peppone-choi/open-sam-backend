// @ts-nocheck - Argument count mismatches need review
import { generalRepository } from '../../repositories/general.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { cityRepository } from '../../repositories/city.repository';
import { rankDataRepository } from '../../repositories/rank-data.repository';

/**
 * GetOfficerInfo Service
 * 국가의 관직자들 정보 조회
 */
export class GetOfficerInfoService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || user?.id || data.user_id;
    const generalId = user?.generalId || data.general_id;

    try {
      let actualGeneralId = generalId;

      // 장수 ID가 없으면, 세션/소유자 기준으로 현재 장수를 찾는다
      if (!actualGeneralId) {
        if (!userId) {
          return {
            result: false,
            reason: '장수 ID 또는 사용자 정보가 필요합니다',
          };
        }

        const userGeneral = await generalRepository.findBySessionAndOwner(
          sessionId,
          String(userId),
          { npc: { $lt: 2 } },
        );

        if (!userGeneral) {
          return {
            result: false,
            reason: '장수를 찾을 수 없습니다',
          };
        }

        actualGeneralId = userGeneral.data?.no || userGeneral.no;
      }

      const general = await generalRepository.findBySessionAndNo(sessionId, actualGeneralId);

      if (!general) {
        return {
          result: false,
          reason: '장수를 찾을 수 없습니다',
        };
      }

      const generalData = general.data || {};
      const nationId = generalData.nation || 0;
      const meLevel = generalData.officer_level || 0;

      if (nationId === 0) {
        return {
          result: false,
          reason: '재야입니다',
        };
      }

      const nation = await nationRepository.findByNationNum(sessionId, nationId);

      if (!nation) {
        return {
          result: false,
          reason: '국가를 찾을 수 없습니다',
        };
      }

      const nationData = nation.data || {};
      const nationLevel = nationData.level || 0;
      const chiefMinLevel = this.getNationChiefLevel(nationLevel);

      // 관직자 조회 (officer_level >= chiefMinLevel)
      const levelOfficers = await generalRepository
        .findByFilter({
          session_id: sessionId,
          'data.nation': nationId,
          'data.officer_level': { $gte: chiefMinLevel },
        })
        .sort({ 'data.officer_level': -1 })
        .exec();

      // 도시 ID -> 도시명 맵핑을 위한 전체 도시 조회
      const allCities = await cityRepository.findByFilter({
        session_id: sessionId,
      });

      const cityNameMap: Record<number, string> = {};
      allCities.forEach((rawCity: any) => {
        const city: any = typeof rawCity.toObject === 'function' ? rawCity.toObject() : rawCity;
        const cd = city.data || {};
        const cityId = city.city ?? cd.city ?? 0;
        if (!cityId) {
          return;
        }
        const cityName = city.name || cd.name || `도시 ${cityId}`;
        cityNameMap[cityId] = cityName;
      });

      const levelMap: Record<number, any> = {};
      levelOfficers.forEach((officer: any) => {
        const od = officer.data || {};
        const cityId = od.city || 0;
        levelMap[od.officer_level || 0] = {
          name: od.name || '-',
          city: cityId,
          cityName: cityNameMap[cityId] || '?',
          belong: od.belong || 0,
          picture: od.picture || 'default.jpg',
          imgsvr: od.imgsvr || 0,
        };
      });

      // 오호장군 (승전수)
      const tigers = await rankDataRepository
        .findByFilter({
          session_id: sessionId,
          'data.nation_id': nationId,
          'data.type': 'killnum',
          'data.value': { $gt: 0 },
        })
        .sort({ 'data.value': -1 })
        .limit(5)
        .exec();

      const tigersList: any[] = [];
      for (const tiger of tigers) {
        const td = tiger.data || {};
        const gen = await generalRepository.findBySessionAndNo(sessionId, td.general_id);
        if (gen) {
          const gd = gen.data || {};
          tigersList.push({
            name: gd.name || '무명',
            value: td.value || 0,
          });
        }
      }

      // 건안칠자 (계략수)
      const eagles = await rankDataRepository
        .findByFilter({
          session_id: sessionId,
          'data.nation_id': nationId,
          'data.type': 'firenum',
          'data.value': { $gt: 0 },
        })
        .sort({ 'data.value': -1 })
        .limit(7)
        .exec();

      const eaglesList: any[] = [];
      for (const eagle of eagles) {
        const ed = eagle.data || {};
        const gen = await generalRepository.findBySessionAndNo(sessionId, ed.general_id);
        if (gen) {
          const gd = gen.data || {};
          eaglesList.push({
            name: gd.name || '무명',
            value: ed.value || 0,
          });
        }
      }

      // 도시 관직자 조회 (officer_level 2~4)
      const cityOfficers = await generalRepository
        .findByFilter({
          session_id: sessionId,
          'data.nation': nationId,
          'data.officer_level': { $gte: 2, $lte: 4 },
        })
        .exec();

      const cityOfficersMap: Record<number, Record<number, any>> = {};
      cityOfficers.forEach((officer: any) => {
        const od = officer.data || {};
        const officerCity = od.officer_city || 0;
        const officerLevel = od.officer_level || 0;
        const currentCityId = od.city || 0;

        if (!cityOfficersMap[officerCity]) {
          cityOfficersMap[officerCity] = {};
        }

        cityOfficersMap[officerCity][officerLevel] = {
          name: od.name || '-',
          city: currentCityId,
          cityName: cityNameMap[currentCityId] || '?',
          belong: od.belong || 0,
          npc: od.npc || 0,
        };
      });

      // 외교권자/조언자 조회
      const specialPermissionGenerals = await generalRepository
        .findByFilter({
          session_id: sessionId,
          'data.nation': nationId,
          'data.permission': { $in: ['ambassador', 'auditor'] },
        })
        .exec();

      const ambassadors: any[] = [];
      const auditors: any[] = [];

      specialPermissionGenerals.forEach((gen: any) => {
        const gd = gen.data || {};
        const info = {
          no: gd.no || gen.no,
          name: gd.name || '무명',
          officerLevel: gd.officer_level || 0,
          permission: gd.permission || 'normal',
        };
        if (gd.permission === 'ambassador') {
          ambassadors.push(info);
        } else if (gd.permission === 'auditor') {
          auditors.push(info);
        }
      });

      // 외교권자/조언자 후보 계산 (권한 체크)
      // 후보 조건: 군주가 아니고, 사관년도 등을 체크 (PHP 버전 참조)
      const allGeneralsForPermission = await generalRepository
        .findByFilter({
          session_id: sessionId,
          'data.nation': nationId,
          'data.officer_level': { $ne: 12 }, // 군주 제외
          'data.npc': { $lt: 2 }, // NPC 제외
        })
        .exec();

      const candidateAmbassadors: any[] = [];
      const candidateAuditors: any[] = [];

      allGeneralsForPermission.forEach((gen: any) => {
        const gd = gen.data || {};
        const belong = gd.belong || 0;
        const permission = gd.permission || 'normal';
        const officerLevel = gd.officer_level || 0;
        const penalty = gd.penalty || {};

        // 현재 외교권자/조언자는 포함
        if (permission === 'ambassador') {
          candidateAmbassadors.push({
            no: gd.no || gen.no,
            name: gd.name || '무명',
            officerLevel,
            selected: true,
          });
          candidateAuditors.push({
            no: gd.no || gen.no,
            name: gd.name || '무명',
            officerLevel,
            selected: true,
          });
          return;
        }

        if (permission === 'auditor') {
          candidateAuditors.push({
            no: gd.no || gen.no,
            name: gd.name || '무명',
            officerLevel,
            selected: true,
          });
          return;
        }

        // 일반 장수의 후보 체크
        // 외교권자 후보: 사관년도 24개월 이상
        if (belong >= 24 && !penalty?.noAmbassador) {
          candidateAmbassadors.push({
            no: gd.no || gen.no,
            name: gd.name || '무명',
            officerLevel,
            selected: false,
          });
        }

        // 조언자 후보: 사관년도 12개월 이상
        if (belong >= 12 && !penalty?.noAuditor) {
          candidateAuditors.push({
            no: gd.no || gen.no,
            name: gd.name || '무명',
            officerLevel,
            selected: false,
          });
        }
      });

      // 도시 목록 조회
      const cities = await cityRepository.findByFilter({
        session_id: sessionId,
        nation: nationId,
      });

      cities.sort((rawA: any, rawB: any) => {
        const a: any = typeof rawA.toObject === 'function' ? rawA.toObject() : rawA;
        const b: any = typeof rawB.toObject === 'function' ? rawB.toObject() : rawB;
        const ad = a.data || {};
        const bd = b.data || {};
        const regionA = a.region ?? ad.region ?? 0;
        const regionB = b.region ?? bd.region ?? 0;
        if (regionA !== regionB) {
          return regionA - regionB;
        }
        const levelA = a.level ?? ad.level ?? 0;
        const levelB = b.level ?? bd.level ?? 0;
        if (levelA !== levelB) {
          return levelB - levelA;
        }
        const nameA = a.name || ad.name || '';
        const nameB = b.name || bd.name || '';
        return nameA.localeCompare(nameB);
      });

      const cityList: any[] = [];
      cities.forEach((rawCity: any) => {
        const city: any = typeof rawCity.toObject === 'function' ? rawCity.toObject() : rawCity;
        const cd = city.data || {};
        const cityId = city.city ?? cd.city ?? 0;

        cityList.push({
          city: cityId,
          name: city.name || cd.name || '무명',
          level: city.level ?? cd.level ?? 0,
          region: city.region ?? cd.region ?? 0,
          officer_set: cd.officer_set || 0,
          officers: cityOfficersMap[cityId] || {},
        });
      });

      return {
        result: true,
        officer: {
          meLevel,
          nation: {
            nation: nationId,
            name: nationData.name || '무명',
            level: nationLevel,
            color: nationData.color || '#000000',
            chief_set: nationData.chief_set || 0,
          },
          chiefMinLevel,
          levelMap,
          tigers: tigersList,
          eagles: eaglesList,
          cities: cityList,
          ambassadors,
          auditors,
          candidateAmbassadors,
          candidateAuditors,
        },
      };
    } catch (error: any) {
      return {
        result: false,
        reason: error.message || '관직자 정보 조회 중 오류가 발생했습니다',
      };
    }
  }

  static getNationChiefLevel(nationLevel: number): number {
    // PHP: sammo\getNationChiefLevel 함수와 동일
    // 작위가 높을수록 더 많은 관직 슬롯 사용 가능
    if (nationLevel >= 7) return 5;   // 황제: 5~12
    if (nationLevel >= 6) return 6;   // 왕: 6~12
    if (nationLevel >= 5) return 7;   // 공: 7~12
    if (nationLevel >= 4) return 8;   // 주목: 8~12
    if (nationLevel >= 3) return 9;   // 주자사: 9~12
    if (nationLevel >= 2) return 10;  // 군벌: 10~12
    return 11; // 호족: 11~12
  }
}
