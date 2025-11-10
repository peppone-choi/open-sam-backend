/**
 * LOGH Scenario Data Loader
 * JSON 데이터를 DB로 임포트하는 서비스
 */

import fs from 'fs';
import path from 'path';
import { Planet } from '../../models/logh/Planet.model';
import { StarSystem } from '../../models/logh/StarSystem.model';
import { MapGrid } from '../../models/logh/MapGrid.model';

interface PlanetData {
  planetId: string;
  planetName: string;
  planetNameJa?: string;
  planetNameEn?: string;
  faction: string;
  stats: {
    population: number;
    industry: number;
    technology: number;
    defense: number;
    resources: number;
    loyalty: number;
  };
  gridCoordinates: { x: number; y: number };
  pixelCoordinates?: { x: number; y: number };
  description?: string;
  facilities?: string[];
  production?: string[];
  isCapital?: boolean;
}

interface StarSystemData {
  systemNumber: number;
  systemId: string;
  systemName: string;
  systemNameJa?: string;
  systemNameEn?: string;
  faction: string;
  planets: PlanetData[];
  gridCoordinates?: { x: number; y: number };
  strategicValue?: string;
  territoryType?: string;
  description?: string;
  historicalSignificance?: string;
}

interface MapGridData {
  metadata: {
    name: string;
    nameKo: string;
    gridSize: { width: number; height: number };
    statistics: {
      totalCells: number;
      navigableCells: number;
      impassableCells: number;
      navigablePercentage: number;
    };
    sourceImage?: string;
    originalImageSize?: { width: number; height: number };
  };
  grid: number[][];
}

export class LoadScenarioDataService {
  private configPath: string;
  
  constructor() {
    this.configPath = path.join(__dirname, '../../../config/scenarios/legend-of-galactic-heroes/data');
  }

  /**
   * 전체 시나리오 데이터 로드
   */
  async loadAll(sessionId: string): Promise<void> {
    console.log(`[LOGH] Loading scenario data for session: ${sessionId}`);
    
    try {
      // 1. 맵 그리드 로드
      await this.loadMapGrid(sessionId);
      
      // 2. 성계 및 행성 로드
      await this.loadStarSystemsAndPlanets(sessionId);
      
      console.log(`[LOGH] ✓ All scenario data loaded successfully`);
    } catch (error) {
      console.error(`[LOGH] ✗ Error loading scenario data:`, error);
      throw error;
    }
  }

  /**
   * 맵 그리드 데이터 로드
   */
  async loadMapGrid(sessionId: string): Promise<void> {
    const filePath = path.join(this.configPath, 'map-navigation-grid.json');
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Map grid data file not found: ${filePath}`);
    }

    const rawData = fs.readFileSync(filePath, 'utf-8');
    const data: MapGridData = JSON.parse(rawData);

    // 기존 데이터 삭제
    await MapGrid.deleteMany({ session_id: sessionId });

    // 새 데이터 생성
    await MapGrid.create({
      session_id: sessionId,
      name: data.metadata.name,
      nameKo: data.metadata.nameKo,
      gridSize: data.metadata.gridSize,
      grid: data.grid,
      statistics: data.metadata.statistics,
      sourceImage: data.metadata.sourceImage,
      originalImageSize: data.metadata.originalImageSize,
    });

    console.log(`[LOGH] ✓ Map grid loaded (${data.metadata.gridSize.width}x${data.metadata.gridSize.height})`);
  }

  /**
   * 성계 및 행성 데이터 로드
   */
  async loadStarSystemsAndPlanets(sessionId: string): Promise<void> {
    const filePath = path.join(this.configPath, 'planets-and-systems-with-stats.json');
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Star systems data file not found: ${filePath}`);
    }

    const rawData = fs.readFileSync(filePath, 'utf-8');
    const data: { starSystems: StarSystemData[] } = JSON.parse(rawData);

    // 기존 데이터 삭제
    await Planet.deleteMany({ session_id: sessionId });
    await StarSystem.deleteMany({ session_id: sessionId });

    let planetCount = 0;
    let systemCount = 0;

    for (const systemData of data.starSystems) {
      // 행성 데이터 생성
      const planetIds: string[] = [];
      
      for (const planetData of systemData.planets) {
        const planet = await Planet.create({
          session_id: sessionId,
          planetId: planetData.planetId,
          name: planetData.planetName,
          nameJa: planetData.planetNameJa,
          nameEn: planetData.planetNameEn,
          owner: this.normalizeFaction(planetData.faction),
          systemId: systemData.systemId,
          systemName: systemData.systemName,
          stats: planetData.stats,
          production: {
            ships: planetData.stats.technology,
            resources: planetData.stats.industry,
            shipTypes: planetData.production || [],
          },
          garrisonFleetId: null,
          isFortress: false,
          fortressGuns: 0,
          warehouse: {
            supplies: 0,
            ships: 0,
          },
          facilities: planetData.facilities || [],
          gridCoordinates: planetData.gridCoordinates,
          pixelCoordinates: planetData.pixelCoordinates,
          strategicValue: systemData.strategicValue as any,
          territoryType: systemData.territoryType as any || this.normalizeFaction(planetData.faction),
          description: planetData.description,
          historicalSignificance: systemData.historicalSignificance,
          isCapital: planetData.isCapital || false,
        });
        
        planetIds.push(planet.planetId);
        planetCount++;
      }

      // 성계 데이터 생성
      const gridCoords = systemData.gridCoordinates || 
                        (systemData.planets.length > 0 ? systemData.planets[0].gridCoordinates : { x: 0, y: 0 });
      
      await StarSystem.create({
        session_id: sessionId,
        systemId: systemData.systemId,
        systemNumber: systemData.systemNumber,
        systemName: systemData.systemName,
        systemNameJa: systemData.systemNameJa,
        systemNameEn: systemData.systemNameEn,
        faction: this.normalizeFaction(systemData.faction),
        planetIds,
        planetCount: planetIds.length,
        gridCoordinates: gridCoords,
        strategicValue: systemData.strategicValue as any,
        territoryType: systemData.territoryType as any,
        description: systemData.description,
        historicalSignificance: systemData.historicalSignificance,
        warpRoutes: [], // TODO: Load from warp routes data
      });
      
      systemCount++;
    }

    console.log(`[LOGH] ✓ Loaded ${systemCount} star systems and ${planetCount} planets`);
  }

  /**
   * Faction 문자열 정규화
   */
  private normalizeFaction(faction: string): 'empire' | 'alliance' | 'neutral' {
    const lower = faction.toLowerCase();
    if (lower === 'empire') return 'empire';
    if (lower === 'alliance') return 'alliance';
    return 'neutral';
  }

  /**
   * 특정 세션의 데이터 삭제
   */
  async clearSession(sessionId: string): Promise<void> {
    await Promise.all([
      Planet.deleteMany({ session_id: sessionId }),
      StarSystem.deleteMany({ session_id: sessionId }),
      MapGrid.deleteMany({ session_id: sessionId }),
    ]);
    
    console.log(`[LOGH] ✓ Cleared all data for session: ${sessionId}`);
  }
}
