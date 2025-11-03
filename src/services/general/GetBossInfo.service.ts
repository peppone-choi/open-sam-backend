import { General } from '../../models/general.model';
import { City } from '../../models/city.model';
import { Nation } from '../../models/nation.model';

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
      // 현재 장수 정보 조회
      const general = await (General as any).findOne({
        session_id: sessionId,
        'data.no': generalId
      });

      if (!general) {
        return {
          success: false,
          message: '장수를 찾을 수 없습니다'
        };
      }

      const genData = general.data || {};
      const officerLevel = genData.officer_level || 0;
      const officerCity = genData.officer_city || 0;
      const nationId = genData.nation || 0;
      const troopId = genData.troop || 0;
      const cityId = genData.city || 0;

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
        const troopLeader = await (General as any).findOne({
          session_id: sessionId,
          'data.no': troopId,
          'data.nation': nationId
        });

        if (troopLeader) {
          bossInfo.hasBoss = true;
          bossInfo.bossType = 'troop_leader';
          bossInfo.bossGeneral = {
            no: troopLeader.no,
            name: troopLeader.name,
            picture: troopLeader.picture,
            officer_level: troopLeader.data?.officer_level || 0,
            leadership: troopLeader.data?.leadership || 0,
            strength: troopLeader.data?.strength || 0,
            intel: troopLeader.data?.intel || 0
          };

          // 부대장의 도시 정보
          const bossCityId = troopLeader.data?.city || 0;
          if (bossCityId) {
            const bossCity = await (City as any).findOne({
              session_id: sessionId,
              'data.id': bossCityId
            });
            if (bossCity) {
              bossInfo.bossCity = {
                id: bossCity.data?.id,
                name: bossCity.data?.name || '도시명 없음'
              };
            }
          }
        }
      }

      // 2. 도시 수뇌가 있는 경우 (도시에 임명된 장수가 있고 본인이 도시 수뇌가 아닌 경우)
      if (!bossInfo.hasBoss && officerCity && officerCity !== 0) {
        const cityOfficer = await (General as any).findOne({
          session_id: sessionId,
          'data.officer_city': officerCity,
          'data.officer_level': { $in: [3, 4] }, // 도시 수뇌 (3: 내정, 4: 군사)
          'data.nation': nationId
        });

        if (cityOfficer && cityOfficer.no !== generalId) {
          bossInfo.hasBoss = true;
          bossInfo.bossType = 'city_officer';
          bossInfo.bossGeneral = {
            no: cityOfficer.no,
            name: cityOfficer.name,
            picture: cityOfficer.picture,
            officer_level: cityOfficer.data?.officer_level || 0,
            leadership: cityOfficer.data?.leadership || 0,
            strength: cityOfficer.data?.strength || 0,
            intel: cityOfficer.data?.intel || 0
          };

          // 도시 정보
          const city = await (City as any).findOne({
            session_id: sessionId,
            'data.id': officerCity
          });
          if (city) {
            bossInfo.bossCity = {
              id: city.data?.id,
              name: city.data?.name || '도시명 없음'
            };
          }
        }
      }

      // 3. 국가 수뇌가 있는 경우 (수뇌부 장수 중 하나)
      if (!bossInfo.hasBoss && nationId && nationId !== 0 && officerLevel >= 5) {
        // 국가 수뇌는 직접적인 상급자가 아니지만 참고용으로 제공
        const nation = await (Nation as any).findOne({
          session_id: sessionId,
          'data.nation': nationId
        });

        if (nation) {
          const nationData = nation.data || {};
          
          // 국가 수뇌 목록 조회 (officer_level 5-11)
          const nationChiefs = await (General as any).find({
            session_id: sessionId,
            'data.nation': nationId,
            'data.officer_level': { $gte: 5, $lt: 12 },
            'data.officer_city': 0
          }).limit(10);

          if (nationChiefs.length > 0) {
            bossInfo.hasBoss = true;
            bossInfo.bossType = 'nation_chief';
            // 가장 높은 관직을 가진 수뇌
            const topChief = nationChiefs.sort((a, b) => 
              (b.data?.officer_level || 0) - (a.data?.officer_level || 0)
            )[0];

            bossInfo.bossGeneral = {
              no: topChief.no,
              name: topChief.name,
              picture: topChief.picture,
              officer_level: topChief.data?.officer_level || 0,
              leadership: topChief.data?.leadership || 0,
              strength: topChief.data?.strength || 0,
              intel: topChief.data?.intel || 0
            };
          }

          bossInfo.bossNation = {
            nation: nationId,
            name: nationData.name || '국가명 없음',
            color: nationData.color || 0
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

