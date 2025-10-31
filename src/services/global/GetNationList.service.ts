import { General } from '../../models/general.model';
import { Nation } from '../../models/nation.model';
import { City } from '../../models/city.model';
import { Session } from '../../models/session.model';

/**
 * GetNationList Service
 * Returns all nations with their generals and cities
 * Sorted by power (strongest first)
 */
export class GetNationListService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    
    try {
      // Load session
      const session = await Session.findOne({ session_id: sessionId });
      if (!session) {
        return {
          success: false,
          message: 'Session not found'
        };
      }

      // Get all nations with their static info
      const nationsData = await Nation.find({ session_id: sessionId }).lean();
      
      // Build nations map
      const nations: Record<number, any> = {};
      for (const nation of nationsData) {
        nations[nation.nation] = {
          ...nation.data,
          nation: nation.nation,
          name: nation.name
        };
      }

      // Sort by power (descending)
      const nationsList = Object.values(nations);
      nationsList.sort((a: any, b: any) => (b.power || 0) - (a.power || 0));
      
      // Rebuild map with sorted order
      const sortedNations: Record<number, any> = {};
      for (const nation of nationsList) {
        sortedNations[nation.nation] = nation;
      }

      // Get nation 0 (neutral) if exists
      const neutralNation = await Nation.findOne({ session_id: sessionId, nation: 0 }).lean();
      if (neutralNation) {
        sortedNations[0] = {
          ...neutralNation.data,
          nation: 0,
          name: neutralNation.name
        };
      }

      // Get all generals ordered by dedication DESC
      const generals = await General.find({ session_id: sessionId })
        .select('no name owner data')
        .sort({ 'data.dedication': -1 })
        .lean();

      // Add generals to their nations
      for (const general of generals) {
        const genData = general.data as any || {};
        const nationID = genData.nation || 0;
        
        // Extract general info
        const generalInfo: any = {
          npc: general.owner === 'NPC' ? 1 : 0,
          name: general.name,
          nation: nationID,
          officer_level: genData.officer_level || 1,
        };

        // Add permission if auditor or ambassador
        const permission = genData.permission;
        if (permission === 'auditor' || permission === 'ambassador') {
          generalInfo.permission = permission;
        }

        // Simplify officer_level (< 5 becomes 1)
        if (generalInfo.officer_level < 5) {
          generalInfo.officer_level = 1;
        }

        // Initialize generals array if needed
        if (!sortedNations[nationID]) {
          sortedNations[nationID] = { nation: nationID, generals: [] };
        }
        if (!sortedNations[nationID].generals) {
          sortedNations[nationID].generals = [];
        }

        sortedNations[nationID].generals.push(generalInfo);
      }

      // Get all cities
      const cities = await City.find({ session_id: sessionId })
        .select('city name data')
        .lean();

      // Add cities to their nations
      for (const city of cities) {
        const cityData = city.data as any || {};
        const nationID = cityData.nation || 0;

        // Initialize cities object if needed
        if (!sortedNations[nationID]) {
          sortedNations[nationID] = { nation: nationID, cities: {} };
        }
        if (!sortedNations[nationID].cities) {
          sortedNations[nationID].cities = {};
        }

        sortedNations[nationID].cities[city.city] = city.name;
      }

      return {
        success: true,
        result: true,
        nations: sortedNations
      };
    } catch (error: any) {
      console.error('GetNationList error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}
