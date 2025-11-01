import { General } from '../../models/general.model';
import { Nation } from '../../models/nation.model';
import { City } from '../../models/city.model';
import { NgDiplomacy } from '../../models/ng_diplomacy.model';
import { Session } from '../../models/session.model';

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
      const session: any = await Session.findOne({ session_id: sessionId });
      if (!session) {
        return {
          success: false,
          message: 'Session not found'
        };
      }

      // Get user's nation ID
      let myNationID = 0;
      if (userId) {
        const general: any = await General.findOne({ 
          session_id: sessionId, 
          owner: userId 
        }).select('data').lean();
        
        if (general) {
          const genData: any = general.data as any || {};
          myNationID = genData.nation || 0;
        }
      }

      // Get all nations (filter by level > 0)
      const nationsData: any = await Nation.find({ session_id: sessionId }).lean();
      
      const nations: Record<number, any> = {};
      for (const nation of nationsData) {
        const nationData: any = nation.data as any || {};
        const level: any = nationData.level || 0;
        
        if (level > 0) {
          nations[nation.nation] = {
            ...nationData,
            nation: nation.nation,
            name: nation.name,
            cities: []
          };
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
      const cities: any = await City.find({ session_id: sessionId })
        .select('city name nation conflict')
        .lean();

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

      // Get diplomacy relationships
      const diplomacyData: any = await NgDiplomacy.find({ session_id: sessionId }).lean();
      
      const diplomacyList: Record<number, Record<number, number>> = {};
      
      for (const diplo of diplomacyData) {
        const diploData: any = diplo.data as any || {};
        const me: any = diploData.me || 0;
        const you: any = diploData.you || 0;
        const state: any = diploData.state || 0;

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
