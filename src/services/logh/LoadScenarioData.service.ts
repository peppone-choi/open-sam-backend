/**
 * LOGH Scenario Data Loader
 * JSON 데이터를 DB로 임포트하는 서비스
 */

import fs from 'fs';
import path from 'path';
import { Planet } from '../../models/logh/Planet.model';
import { StarSystem } from '../../models/logh/StarSystem.model';
import { MapGrid } from '../../models/logh/MapGrid.model';
import { LoghCommander } from '../../models/logh/Commander.model';
import { Fleet } from '../../models/logh/Fleet.model';

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

interface AdmiralData {
  id: number;
  name: string;
  nameEn?: string;
  nameJa?: string;
  faction: number; // 1=제국, 2=동맹
  gender: string;
  age: number;
  rank: number;
  leadership: number;
  politics: number;
  operations: number;
  intelligence: number;
  command: number;
  maneuver: number;
  attack: number;
  defense: number;
  merit: number;
  evaluation: number;
  fame: number;
  description?: string;
}

interface InitialDeploymentData {
  faction: string;
  date: string;
  dateJa?: string;
  positions: Array<{
    positionName: string;
    positionNameJa?: string;
    holderName: string;
    holderNameJa?: string;
  }>;
  fleets: Array<{
    unitType: string;
    unitNumber: number;
    unitName: string;
    unitNameJa?: string;
    commanderName: string;
    commanderNameJa?: string;
    commanderRank?: string;
    location: {
      system: string;
      systemJa?: string;
      planet?: string;
      planetJa?: string;
    };
    ships?: number;
    notes?: string;
  }>;
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
      
      // 3. 제독(Commander) 로드
      await this.loadAdmirals(sessionId);
      
      // 4. 함대 초기 배치 로드
      await this.loadInitialDeployment(sessionId);
      
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
        // gridCoordinates 기본값 설정 (없으면 0,0) 및 범위 제한
        const rawCoords = planetData.gridCoordinates || { x: 0, y: 0 };
        const gridCoords = {
          x: Math.max(0, Math.min(99, rawCoords.x)),
          y: Math.max(0, Math.min(49, rawCoords.y)),
        };
        
        // strategicValue 변환 (capital -> critical)
        let strategicValue: 'critical' | 'high' | 'normal' | 'low' | undefined = 
          systemData.strategicValue as any;
        if (strategicValue === 'capital' as any) {
          strategicValue = 'critical';
        }
        
        const planet = await Planet.create({
          session_id: sessionId,
          planetId: planetData.planetId,
          name: planetData.planetName,
          nameJa: planetData.planetNameJa,
          nameEn: planetData.planetNameEn,
          owner: this.normalizeFaction(planetData.faction),
          systemId: systemData.systemId,
          systemName: systemData.systemName,
          stats: planetData.stats || {
            population: 0,
            industry: 0,
            technology: 0,
            defense: 0,
            resources: 0,
            loyalty: 50,
          },
          production: {
            ships: planetData.stats?.technology || 0,
            resources: planetData.stats?.industry || 0,
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
          gridCoordinates: gridCoords,
          pixelCoordinates: planetData.pixelCoordinates,
          strategicValue,
          territoryType: systemData.territoryType as any || this.normalizeFaction(planetData.faction),
          description: planetData.description,
          historicalSignificance: systemData.historicalSignificance,
          isCapital: planetData.isCapital || false,
        });
        
        planetIds.push(planet.planetId);
        planetCount++;
      }

      // 성계 데이터 생성 - gridCoordinates 범위 제한
      const rawSysCoords = systemData.gridCoordinates || 
                        (systemData.planets.length > 0 ? systemData.planets[0].gridCoordinates : { x: 0, y: 0 });
      const gridCoords = {
        x: Math.max(0, Math.min(99, rawSysCoords.x)),
        y: Math.max(0, Math.min(49, rawSysCoords.y)),
      };
      
      // strategicValue 변환 (capital -> critical)
      let sysStrategicValue: 'critical' | 'high' | 'normal' | 'low' | undefined = 
        systemData.strategicValue as any;
      if (sysStrategicValue === 'capital' as any) {
        sysStrategicValue = 'critical';
      }
      
      await StarSystem.create({
        session_id: sessionId,
        systemId: systemData.systemId,
        systemNumber: systemData.systemNumber,
        systemName: systemData.systemName,
        systemNameJa: systemData.systemNameJa,
        systemNameEn: systemData.systemNameEn,
        faction: this.normalizeFaction(systemData.faction),
        planetIds,
        gridCoordinates: gridCoords,
        strategicValue: sysStrategicValue,
        territoryType: systemData.territoryType as any || this.normalizeFaction(systemData.faction),
        description: systemData.description,
        historicalSignificance: systemData.historicalSignificance,
      });
      
      systemCount++;
    }

    console.log(`[LOGH] ✓ Loaded ${systemCount} star systems and ${planetCount} planets`);
  }

  /**
   * 제독(Commander) 데이터 로드
   */
  async loadAdmirals(sessionId: string): Promise<void> {
    const filePath = path.join(this.configPath, 'admirals.json');
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Admirals data file not found: ${filePath}`);
    }

    const rawData = fs.readFileSync(filePath, 'utf-8');
    const data: { admirals: AdmiralData[] } = JSON.parse(rawData);

    // 기존 데이터 삭제
    await LoghCommander.deleteMany({ session_id: sessionId });

    let commanderCount = 0;

    for (const admiral of data.admirals) {
      // faction 숫자를 문자열로 변환 (1=empire, 2=alliance)
      const factionType = admiral.faction === 1 ? 'empire' : 'alliance';

      await LoghCommander.create({
        session_id: sessionId,
        no: admiral.id,
        name: admiral.name,
        nameJa: admiral.nameJa,
        nameEn: admiral.nameEn,
        faction: factionType,
        gender: admiral.gender as any,
        age: admiral.age,
        rank: admiral.rank,
        jobPosition: null, // 직책은 initial-deployment에서 설정
        stats: {
          leadership: admiral.leadership,
          politics: admiral.politics,
          operations: admiral.operations,
          intelligence: admiral.intelligence,
          command: admiral.command,
          maneuver: admiral.maneuver,
          attack: admiral.attack,
          defense: admiral.defense,
        },
        commandPoints: {
          personal: 100, // 초기값
          military: 100,
          maxPersonal: 100,
          maxMilitary: 100,
        },
        fleetId: null, // 함대는 initial-deployment에서 할당
        fame: admiral.fame,
        merit: admiral.merit,
        evaluation: admiral.evaluation,
        loyalty: 100, // 초기값
        customData: {
          description: admiral.description,
        },
        medals: [],
      });

      commanderCount++;
    }

    console.log(`[LOGH] ✓ Loaded ${commanderCount} commanders (admirals)`);
  }

  /**
   * 함대 초기 배치 로드
   */
  async loadInitialDeployment(sessionId: string): Promise<void> {
    // 제국과 동맹 배치 데이터 로드
    await this.loadFactionDeployment(sessionId, 'empire');
    await this.loadFactionDeployment(sessionId, 'alliance');
  }

  /**
   * 특정 진영 함대 배치 로드
   */
  private async loadFactionDeployment(
    sessionId: string,
    faction: 'empire' | 'alliance'
  ): Promise<void> {
    const fileName = faction === 'empire' 
      ? 'empire-initial-deployment.json' 
      : 'alliance-initial-deployment.json';
    const filePath = path.join(this.configPath, fileName);

    if (!fs.existsSync(filePath)) {
      console.warn(`[LOGH] Warning: ${fileName} not found, skipping`);
      return;
    }

    const rawData = fs.readFileSync(filePath, 'utf-8');
    const data: InitialDeploymentData = JSON.parse(rawData);

    let fleetCount = 0;

    for (const fleetData of data.fleets) {
      // 함대 지휘관 찾기
      const commander = await LoghCommander.findOne({
        session_id: sessionId,
        name: fleetData.commanderName,
      });

      if (!commander) {
        console.warn(`[LOGH] Warning: Commander '${fleetData.commanderName}' not found for ${fleetData.unitName}`);
        continue;
      }

      // 행성 위치 찾기
      let gridPosition = { x: 50, y: 25 }; // 기본값
      if (fleetData.location?.planet) {
        const planet = await Planet.findOne({
          session_id: sessionId,
          name: fleetData.location.planet,
        });
        if (planet) {
          gridPosition = planet.gridCoordinates;
        }
      } else if (fleetData.location?.system) {
        const system = await StarSystem.findOne({
          session_id: sessionId,
          systemName: fleetData.location.system,
        });
        if (system) {
          gridPosition = system.gridCoordinates;
        }
      }

      // 함대 생성
      const fleet = await Fleet.create({
        session_id: sessionId,
        fleetId: `${faction}_fleet_${fleetData.unitNumber}`,
        name: fleetData.unitName,
        nameJa: fleetData.unitNameJa,
        faction,
        commanderId: commander.no,
        fleetType: 'fleet', // 기본 함대 타입
        ships: [],
        totalShips: fleetData.ships || 0,
        totalUnits: Math.floor((fleetData.ships || 0) / 300), // 1 unit = 300 ships
        maxUnits: 60, // fleet 타입 최대
        crew: [],
        totalCrew: 0,
        maxCrewSlots: 10,
        fuel: 1000, // 초기 연료
        supplies: 1000, // 초기 보급
        morale: 100, // 초기 사기
        strategicPosition: gridPosition,
        tacticalPosition: null,
        destination: null,
        isMoving: false,
        status: 'idle',
        combatTarget: null,
        movementRange: 10,
        groundTroops: [],
        totalGroundTroops: 0,
      });

      // 커맨더에 함대 할당
      commander.fleetId = fleet.fleetId;
      await commander.save();

      fleetCount++;
    }

    console.log(`[LOGH] ✓ Loaded ${fleetCount} ${faction} fleets`);
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
      LoghCommander.deleteMany({ session_id: sessionId }),
      Fleet.deleteMany({ session_id: sessionId }),
    ]);
    
    console.log(`[LOGH] ✓ Cleared all data for session: ${sessionId}`);
  }
}
