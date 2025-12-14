import { generalRepository } from '../../repositories/general.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { cityRepository } from '../../repositories/city.repository';
import { Diplomacy } from '../../models/diplomacy.model';
import { sessionRepository } from '../../repositories/session.repository';

/**
 * GetDiplomacy Service
 * 외교 관계 정보를 반환합니다
 * (국가 목록, 도시 분쟁 정보, 외교 관계)
 */
export class GetDiplomacyService {
  static async execute(data: any, user?: any) {
    const sessionId: any = data.session_id || 'sangokushi_default';
    const userId: any = user?.userId || data.user_id;
    
    try {
      // Load session
      const session: any = await sessionRepository.findBySessionId(sessionId );
      if (!session) {
        return {
          success: false,
          message: '세션을 찾을 수 없습니다.'
        };
      }

      // Get user's nation ID
      let myNationID = 0;
      if (userId) {
        const general: any = await generalRepository.findBySessionAndOwner(sessionId, userId);
        
        if (general) {
          const genData: any = general.data as any || {};
          myNationID = genData.nation || 0;
        }
      }

      // Get all nations (filter by level > 0)
      const nationsData: any = await nationRepository.findByFilter({ session_id: sessionId });
      
      const nations: Record<number, any> = {};
      for (const nation of nationsData) {
        const nationData: any = nation.data as any || {};
        const level: any = nationData.level || 0;
        
        if (level > 0) {
          nations[nation.nation] = {
            ...nationData,
            nation: nation.nation,
            name: nation.name,
            cities: [],
            gennum: 0,
          };
        }
      }

      // Recompute general counts per nation (live)
      const allGenerals: any[] = await generalRepository.findByFilter({ session_id: sessionId });
      for (const general of allGenerals) {
        const genData: any = (general.data as any) || {};
        const npc: number = general.npc ?? genData.npc ?? 0;

        // 재야/특수 NPC(5)는 세력 장수 수에서 제외
        if (npc === 5) {
          continue;
        }

        const nationId: number = genData.nation || 0;
        if (nationId && nations[nationId]) {
          nations[nationId].gennum = (nations[nationId].gennum || 0) + 1;
        }
      }

      // Sort nations by power (descending)
      const nationsList: any = Object.values(nations);
      nationsList.sort((a: any, b: any) => (b.power || 0) - (a.power || 0));
      
      // Rebuild sorted map
      const sortedNations: Record<number, any> = {};
      for (const nation of nationsList) {
        sortedNations[nation.nation] = nation;
      }

      // Get cities and build conflict info
      const cities: any = await cityRepository.findByFilter({ session_id: sessionId })
        
        ;

      const realConflict: any[] = [];
      
      for (const city of cities) {
        const nationID: any = city.nation || 0;
        const cityName: any = city.name;
        const rawConflict: any = city.conflict || {};

        // Add city to nation
        if (nationID !== 0 && sortedNations[nationID]) {
          sortedNations[nationID].cities.push(cityName);
        }

        // Process conflict data
        if (typeof rawConflict === 'object' && Object.keys(rawConflict).length >= 2) {
          const sum: any = Object.values(rawConflict).reduce((acc: number, val: any) => acc + (val || 0), 0);
          
          if (sum > 0) {
            const conflict: Record<number, number> = {};
            for (const [nID, killnum] of Object.entries(rawConflict)) {
              const nationId: any = parseInt(nID);
              const kills: any = killnum as number || 0;
              conflict[nationId] = Math.round((100 * kills / sum) * 10) / 10;
            }
            
            realConflict.push([city.city, conflict]);
          }
        }
      }

      // Neutral diplomacy mapping (hide details from non-involved nations)
      const neutralDiplomacyMap: Record<number, number> = {
        3: 2,  // Hide specific alliance/war states
        4: 2,
        5: 2,
        6: 2,
        7: 2,
      };

      // Get diplomacy relationships from diplomacy table
      const diplomacyData: any = await Diplomacy.find({ session_id: sessionId });
      
      const diplomacyList: Record<number, Record<number, number>> = {};
      
      for (const diplo of diplomacyData) {
        const me: any = diplo.me || 0;
        const you: any = diplo.you || 0;
        const state: any = diplo.state || 0;

        if (!diplomacyList[me]) {
          diplomacyList[me] = {};
        }

        // If neither me nor you is the player's nation, hide details
        if (me !== myNationID && you !== myNationID) {
          diplomacyList[me][you] = neutralDiplomacyMap[state] !== undefined ? neutralDiplomacyMap[state] : state;
        } else {
          diplomacyList[me][you] = state;
        }
      }

      return {
        success: true,
        result: true,
        nations: Object.values(sortedNations),
        conflict: realConflict,
        diplomacyList,
        myNationID
      };
    } catch (error: any) {
      console.error('GetDiplomacy error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}
