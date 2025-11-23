// @ts-nocheck - Argument count mismatches need review
import { generalRepository } from '../../repositories/general.repository';
import { cityRepository } from '../../repositories/city.repository';
import { nationRepository } from '../../repositories/nation.repository';

/**
 * GetBossInfo Service
 * 장수의 상급자(부장, 도시 수뇌 등) 정보 조회
 */
export class GetBossInfoService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;

    if (!generalId) {
      return {
        success: false,
        message: '장수 ID가 필요합니다'
      };
    }

    try {
      // 현재 장수 정보 조회 (캐시 우선, 없으면 DB 조회)
      let general = await generalRepository.findBySessionAndNo(sessionId, generalId);
      if (!general) {
        general = await generalRepository.findOneByFilter({
          session_id: sessionId,
          $or: [{ 'data.no': generalId }, { no: generalId }]
        });
      }

      if (!general) {
        return {
          success: false,
          message: '장수를 찾을 수 없습니다'
        };
      }

      const generalData = general.data || general;
      const officerLevel = generalData.officer_level || 0;
      const officerCity = generalData.officer_city || 0;
      const nationId = generalData.nation || 0;
      const troopId = generalData.troop || 0;
      const cityId = generalData.city || 0;


      // 상급자 정보 초기화
      const bossInfo: any = {
        hasBoss: false,
        bossType: null, // 'nation_chief', 'city_officer', 'troop_leader'
        bossGeneral: null,
        bossCity: null,
        bossNation: null
      };

      // 1. 부대장이 있는 경우 (부대에 소속되어 있고 본인이 부대장이 아닌 경우)
      if (troopId && troopId !== generalId) {
        const troopLeader = await generalRepository.findOneByFilter({
          session_id: sessionId,
          no: troopId,
          nation: nationId
        });

        if (troopLeader) {
          bossInfo.hasBoss = true;
          bossInfo.bossType = 'troop_leader';
          bossInfo.bossGeneral = {
            no: troopLeader.no,
            name: troopLeader.name,
            picture: troopLeader.picture,
            officer_level: troopLeader.officer_level || 0,
            leadership: troopLeader.leadership || 0,
            strength: troopLeader.strength || 0,
            intel: troopLeader.intel || 0
          };

          // 부대장의 도시 정보
          const bossCityId = troopLeader.city || 0;
          if (bossCityId) {
            const bossCity = await cityRepository.findOneByFilter({
              session_id: sessionId,
              id: bossCityId
            });
            if (bossCity) {
              bossInfo.bossCity = {
                id: bossCity.id,
                name: bossCity.name || '도시명 없음'
              };
            }
          }
        }
      }

      // 2. 도시 수뇌가 있는 경우 (도시에 임명된 장수가 있고 본인이 도시 수뇌가 아닌 경우)
      if (!bossInfo.hasBoss && officerCity && officerCity !== 0) {
        const cityOfficer = await generalRepository.findOneByFilter({
          session_id: sessionId,
          officer_city: officerCity,
          officer_level: { $in: [3, 4] }, // 도시 수뇌 (3: 내정, 4: 군사)
          nation: nationId
        });

        if (cityOfficer && cityOfficer.no !== generalId) {
          bossInfo.hasBoss = true;
          bossInfo.bossType = 'city_officer';
          bossInfo.bossGeneral = {
            no: cityOfficer.no,
            name: cityOfficer.name,
            picture: cityOfficer.picture,
            officer_level: cityOfficer.officer_level || 0,
            leadership: cityOfficer.leadership || 0,
            strength: cityOfficer.strength || 0,
            intel: cityOfficer.intel || 0
          };

          // 도시 정보
          const city = await cityRepository.findOneByFilter({
            session_id: sessionId,
            id: officerCity
          });
          if (city) {
            bossInfo.bossCity = {
              id: city.id,
              name: city.name || '도시명 없음'
            };
          }
        }
      }

      // 3. 국가 수뇌가 있는 경우 (수뇌부 장수 중 하나)
      if (!bossInfo.hasBoss && nationId && nationId !== 0 && officerLevel >= 5) {
        // 국가 수뇌는 직접적인 상급자가 아니지만 참고용으로 제공
        const nation = await nationRepository.findOneByFilter({
          session_id: sessionId,
          nation: nationId
        });

        if (nation) {
          // 국가 수뇌 목록 조회 (officer_level 5-11)
          const nationChiefs = await generalRepository.findByFilter({
            session_id: sessionId,
            nation: nationId,
            officer_level: { $gte: 5, $lt: 12 },
            officer_city: 0
          }).limit(10);

          if (nationChiefs.length > 0) {
            bossInfo.hasBoss = true;
            bossInfo.bossType = 'nation_chief';
            // 가장 높은 관직을 가진 수뇌
            const topChief = nationChiefs.sort((a, b) =>
              (b.officer_level || 0) - (a.officer_level || 0)
            )[0];

            bossInfo.bossGeneral = {
              no: topChief.no,
              name: topChief.name,
              picture: topChief.picture,
              officer_level: topChief.officer_level || 0,
              leadership: topChief.leadership || 0,
              strength: topChief.strength || 0,
              intel: topChief.intel || 0
            };
          }

          bossInfo.bossNation = {
            nation: nationId,
            name: nation.name || '국가명 없음',
            color: nation.color || 0
          };
        }
      }

      // 4. 군주인 경우 (officer_level === 12)
      if (officerLevel === 12) {
        bossInfo.hasBoss = false;
        bossInfo.bossType = 'emperor';
        bossInfo.isEmperor = true;
      }

      return {
        success: true,
        result: true,
        bossInfo
      };
    } catch (error: any) {
      console.error('GetBossInfo error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}

