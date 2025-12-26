import { generalRepository } from '../../repositories/general.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { cityRepository } from '../../repositories/city.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { COMMON_ERRORS } from '../../constants/messages';
import * as fs from 'fs';
import * as path from 'path';

/**
 * GetMap Service
 * 게임 맵 정보를 반환합니다 (도시, 국가, 첩보 정보 등)
 */
export class GetMapService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || data.user_id;
    const neutralView = !!(data.neutralView || false);
    const showMe = !!(data.showMe || false);
    
    try {
      // Load session
      const session = await sessionRepository.findBySessionId(sessionId );
      if (!session) {
        return {
          success: false,
          message: COMMON_ERRORS.sessionNotFound
        };
      }

      // Get session info (year, month, startYear)
      const sessionData = session.data as any || {};
      const gameEnv = sessionData.game_env || {};
      const startYear = gameEnv.startyear || sessionData.startyear || session.startyear || 184;
      
      // turnDate를 호출하여 최신 년/월 계산 (GetFrontInfo와 동일한 방식)
      const { ExecuteEngineService } = await import('./ExecuteEngine.service');
      const turntime = sessionData.turntime ? new Date(sessionData.turntime) : new Date();
      const gameEnvCopy = { ...sessionData };
      const turnInfo = ExecuteEngineService.turnDate(turntime, gameEnvCopy);
      
      const year = turnInfo.year;
      const month = turnInfo.month;

      // Find user's general
      let myCity: number | null = null;
      let myNation: number | null = null;
      
      if (userId) {
        const general = await generalRepository.findBySessionAndOwner(sessionId, userId);

        if (general && (showMe || !neutralView)) {
          const genData = general.data as any || {};
          myCity = genData.city || null;
          myNation = genData.nation || null;

          if (!showMe) {
            myCity = null;
          }
          if (neutralView) {
            myNation = null;
          }
        }
      }

      // Get spy info (첩보 정보)
      let spyInfo: Record<number, number> = {};
      
      if (myNation) {
        const nation = await nationRepository.findByNationNum(sessionId, myNation);

        if (nation) {
          const nationData = nation.data as any || {};
          const rawSpy = nationData.spy || '';

          if (rawSpy) {
            // Parse spy info
            if (typeof rawSpy === 'string') {
              if (rawSpy.includes('|') || !isNaN(Number(rawSpy))) {
                // Legacy format: "cityNo*10+remainMonth|..."
                rawSpy.split('|').forEach(value => {
                  const numValue = parseInt(value);
                  const cityNo = Math.floor(numValue / 10);
                  const remainMonth = numValue % 10;
                  spyInfo[cityNo] = remainMonth;
                });
              } else {
                // JSON format
                try {
                  spyInfo = JSON.parse(rawSpy);
                } catch (e) {
                  spyInfo = {};
                }
              }
            } else if (typeof rawSpy === 'object') {
              spyInfo = rawSpy;
            }
          }
        }
      }

      // Get nation list
      const nations = await nationRepository.findByFilter({ session_id: sessionId })
        
        ;

      const nationList: any[] = [];
      for (const nation of nations) {
        const nationData = nation.data as any || {};
        const color = nation.color || nationData.color || '#000000';
        const capital = nation.capital ?? nationData.capital ?? 0;
        const flagImage = nation.flagImage || nationData.flagImage || null;
        const flagTextColor = nation.flagTextColor || nationData.flagTextColor || 'auto';
        const flagBgColor = nation.flagBgColor || nationData.flagBgColor || null;
        const flagBorderColor = nation.flagBorderColor || nationData.flagBorderColor || 'auto';
        
        nationList.push([
          nation.nation,
          nation.name || nationData.name || '무명',
          color,
          capital,
          flagImage,
          flagTextColor,
          flagBgColor,
          flagBorderColor
        ]);
      }

      // Get cities where my nation's generals are located
      let shownByGeneralList: number[] = [];
      if (myNation) {
        const generals = await generalRepository.findByFilter({ 
          session_id: sessionId, 
          'data.nation': myNation 
        });

        const citySet = new Set<number>();
        for (const gen of generals) {
          const genData = gen.data as any || {};
          if (genData.city) {
            citySet.add(genData.city);
          }
        }
        shownByGeneralList = Array.from(citySet);
      }

      // Get city list
      const cities = await cityRepository.findByFilter({ session_id: sessionId })
        
        ;

      const cityList: any[] = [];
      const cityPositionMap: Map<number, { x: number; y: number }> = new Map();
      
      for (const city of cities) {
        // data 필드 폴백 (MongoDB 스키마 유연성 대응)
        const d = city.data || {};
        const level = city.level ?? d.level ?? 0;
        const state = city.state ?? d.state ?? 0;
        const nation = city.nation ?? d.nation ?? 0;
        const region = city.region ?? d.region ?? 0;
        const supply = city.supply ?? d.supply ?? 0;
        const name = city.name || d.name || '';
        const x = city.x ?? d.x ?? 0;
        const y = city.y ?? d.y ?? 0;
        
        // 추가 스탯 (Heatmap용)
        const pop = city.pop ?? d.pop ?? 0;
        const agri = city.agri ?? d.agri ?? 0;
        const comm = city.comm ?? d.comm ?? 0;
        const def = city.def ?? d.def ?? 0;
        const wall = city.wall ?? d.wall ?? 0;
        
        cityList.push([
          city.city,
          level,
          state,
          nation,
          region,
          supply,
          name,
          x,
          y,
          pop,
          agri,
          comm,
          def,
          wall
        ]);
        
        cityPositionMap.set(city.city, { x, y });
      }

      // 도로 연결 정보 로드 (neighbors 기반)
      let roadList: [number, number][] = [];
      const processedPairs = new Set<string>();
      
      try {
        // 시나리오 ID 추출
        const scenarioId = session.scenarioId || sessionData.scenarioId || 'sangokushi';
        const citiesJsonPath = path.join(
          __dirname,
          '../../../config/scenarios',
          scenarioId,
          'data/cities.json'
        );
        
        if (fs.existsSync(citiesJsonPath)) {
          const citiesData = JSON.parse(fs.readFileSync(citiesJsonPath, 'utf-8'));
          if (citiesData.cities && Array.isArray(citiesData.cities)) {
            for (const cityData of citiesData.cities) {
              if (cityData.id && cityData.neighbors && Array.isArray(cityData.neighbors)) {
                for (const neighborId of cityData.neighbors) {
                  // 중복 방지 (1-2와 2-1은 같은 도로)
                  const pairKey = [Math.min(cityData.id, neighborId), Math.max(cityData.id, neighborId)].join('-');
                  if (!processedPairs.has(pairKey)) {
                    processedPairs.add(pairKey);
                    roadList.push([cityData.id, neighborId]);
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.warn('Failed to load road connections from scenario:', error);
        // DB에서 neighbors 필드 시도
        for (const city of cities) {
          const d = city.data || {};
          const neighbors = city.neighbors || d.neighbors || [];
          if (Array.isArray(neighbors)) {
            for (const neighbor of neighbors) {
              const neighborId = typeof neighbor === 'number' ? neighbor : parseInt(String(neighbor), 10);
              if (!isNaN(neighborId)) {
                const pairKey = [Math.min(city.city, neighborId), Math.max(city.city, neighborId)].join('-');
                if (!processedPairs.has(pairKey)) {
                  processedPairs.add(pairKey);
                  roadList.push([city.city, neighborId]);
                }
              }
            }
          }
        }
      }

      // If admin (userGrade >= 5), show all cities in spy info
      const userGrade = user?.grade || 0;

      if ((showMe || !neutralView) && userGrade >= 5) {
        spyInfo = {};
        for (const city of cityList) {
          spyInfo[city[0]] = 1; // city[0] is city ID
        }
      }

      return {
        success: true,
        result: true,
        startYear,
        year,
        month,
        cityList,
        nationList,
        roadList,  // 도시 간 도로 연결 정보 [fromCity, toCity][]
        spyList: spyInfo,
        shownByGeneralList,
        myCity,
        myNation,
        version: 0
      };
    } catch (error: any) {
      console.error('GetMap error:', error);
      return {
        success: false,
        result: false,
        message: error.message
      };
    }
  }
}
