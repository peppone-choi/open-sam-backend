import { generalRepository } from '../../repositories/general.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { cityRepository } from '../../repositories/city.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { getNationTypeInfo } from '../../core/nation-type/NationTypeFactory';

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
      const session = await sessionRepository.findBySessionId(sessionId );
      if (!session) {
        return {
          success: false,
          message: '세션을 찾을 수 없습니다.'
        };
      }

      // Get all nations with their static info
      const nationsData = await nationRepository.findByFilter({ session_id: sessionId });
      
      // Build nations map
      const nations: Record<number, any> = {};
      for (const nation of nationsData) {
        const nationData = nation.data || {};
        const nationType = nationData.type || null;
        const typeInfo = getNationTypeInfo(nationType);
        
        nations[nation.nation] = {
          ...nationData,
          nation: nation.nation,
          name: nation.name,
          color: nation.color || nationData.color || '#666666',
          level: nationData.level ?? 0,
          power: nationData.power ?? 0,
          capital: nationData.capital ?? 0,
          gold: nationData.gold ?? 0,
          rice: nationData.rice ?? 0,
          tech: nationData.tech ?? 0,
          gennum: nationData.gennum ?? 0,
          type: nationType, // raw type string for frontend
          typeInfo: {
            name: typeInfo.name,
            pros: typeInfo.pros,
            cons: typeInfo.cons
          },
          generals: [],
          cities: {}
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

      // Get nation 0 (neutral/wandering) - always exists
      sortedNations[0] = {
        nation: 0,
        name: '재야',
        color: '#666666',
        level: 0,
        power: 0,
        capital: 0,
        gold: 0,
        rice: 0,
        tech: 0,
        gennum: 0,
        type: 'neutral',
        typeInfo: { name: '중립', pros: '', cons: '' },
        generals: [],
        cities: {}
      };

      // Get all generals ordered by dedication DESC
      const generals = (await generalRepository.findBySession(sessionId))
        .sort((a, b) => ((b.data as any)?.dedication || 0) - ((a.data as any)?.dedication || 0));

      // Add generals to their nations
      for (const general of generals) {
        const genData = general.data as any || {};
        const nationID = genData.nation ?? 0;
        const officerLevel = genData.officer_level ?? 1;
        const npc = genData.npc ?? (general.owner === 'NPC' ? 2 : 0);
        
        // Extract general info
        const generalInfo: any = {
          no: general.no,
          name: general.name,
          npc: npc,
          nation: nationID,
          city: genData.city ?? 0,
          officer_level: officerLevel,
          dedication: genData.dedication ?? 0,
        };

        // Add permission if auditor or ambassador
        const permission = genData.permission;
        if (permission === 'auditor' || permission === 'ambassador') {
          generalInfo.permission = permission;
        }

        // Initialize nation if needed
        if (!sortedNations[nationID]) {
          sortedNations[nationID] = { 
            nation: nationID, 
            name: `국가${nationID}`,
            color: '#666666',
            level: 0,
            generals: [],
            cities: {}
          };
        }

        sortedNations[nationID].generals.push(generalInfo);
      }

      // Get all cities
      const cities = await cityRepository.findByFilter({ session_id: sessionId })
        
        ;

      // Add cities to their nations
      for (const city of cities) {
        const nationID = city.nation || 0;

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
