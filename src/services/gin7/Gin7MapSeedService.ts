import { v4 as uuidv4 } from 'uuid';
import { GalaxyGrid, IGalaxyGrid, GridTerrain } from '../../models/gin7/GalaxyGrid';
import { StarSystem, IStarSystem, StarType } from '../../models/gin7/StarSystem';
import { Planet, IPlanet, PlanetType, FacilityType, IPlanetFacility } from '../../models/gin7/Planet';
import { MapDataLoader, FullMapData, StarSystemData } from './MapDataLoader';
import { logger } from '../../common/logger';

// Import FACTIONS from MapSeedService to avoid duplicate exports
import { FACTIONS } from './MapSeedService';

/**
 * Special star systems with additional metadata
 */
const SPECIAL_SYSTEMS: Record<number, {
  isCapital?: boolean;
  isFortress?: boolean;
  strategicValue?: number;
  warpGateLevel?: number;
  description?: string;
}> = {
  // 이제를론 (Iserlohn) - system_id: 18
  18: { isFortress: true, strategicValue: 95, warpGateLevel: 5, description: '이제를론 회랑을 지키는 난공불락의 요새' },
  // 오딘 (제국 수도) - 발할라 성계 내
  42: { isCapital: true, strategicValue: 100, warpGateLevel: 5, description: '은하제국의 수도' },
  // 하이네센 (동맹 수도) - 바라트루프에서 가장 가까운 주요 성계
  38: { isCapital: true, strategicValue: 100, warpGateLevel: 5, description: '자유행성동맹의 수도' },
  // 페잔 - system_id: 64
  64: { isCapital: true, strategicValue: 90, warpGateLevel: 5, description: '페잔 자치령의 중심, 우주 무역의 허브' },
  // 가이에스부르크 (Geiersburg) - system_id: 67
  67: { isFortress: true, strategicValue: 80, warpGateLevel: 4, description: '이동 요새 건설의 기지' },
  // 렌텐베르크 요새 - 프레이야 성계
  60: { isFortress: true, strategicValue: 75, warpGateLevel: 4, description: '렌텐베르크 요새가 위치한 성계' },
  // 가르미슈 요새 - 키포이저 성계
  76: { isFortress: true, strategicValue: 70, warpGateLevel: 3, description: '가르미슈 요새가 위치한 성계' },
};

/**
 * Planet generation templates based on faction
 */
const PLANET_TEMPLATES: Record<string, { types: PlanetType[]; avgPlanets: number }> = {
  [FACTIONS.GALACTIC_EMPIRE]: {
    types: ['terran', 'desert', 'ice', 'barren'],
    avgPlanets: 3,
  },
  [FACTIONS.FREE_PLANETS_ALLIANCE]: {
    types: ['terran', 'ocean', 'terran', 'desert'],
    avgPlanets: 3,
  },
  [FACTIONS.FEZZAN]: {
    types: ['terran', 'desert'],
    avgPlanets: 2,
  },
  [FACTIONS.NEUTRAL]: {
    types: ['barren', 'ice', 'volcanic'],
    avgPlanets: 1,
  },
};

/**
 * Gin7MapSeedService
 * Seeds the galaxy map using actual data from 은영전지도.md
 */
export class Gin7MapSeedService {
  private static mapData: FullMapData | null = null;

  /**
   * Load map data from file (cached)
   */
  private static async getMapData(): Promise<FullMapData> {
    if (!this.mapData) {
      this.mapData = await MapDataLoader.loadMapData();
    }
    return this.mapData;
  }

  /**
   * Clear cached map data
   */
  public static clearCache(): void {
    this.mapData = null;
  }

  /**
   * Seed the complete galaxy map for a session using 은영전지도.md data
   */
  public static async seedGalaxyFromFile(sessionId: string): Promise<{
    gridsCreated: number;
    systemsCreated: number;
    planetsCreated: number;
  }> {
    logger.info(`[Gin7MapSeedService] Starting galaxy seed for session ${sessionId}`);

    const mapData = await this.getMapData();
    let gridsCreated = 0;
    let systemsCreated = 0;
    let planetsCreated = 0;

    try {
      // Step 1: Create all grid cells (100x50 = 5000 cells)
      logger.info('[Gin7MapSeedService] Phase 1: Seeding grid cells...');
      gridsCreated = await this.seedGridCells(sessionId, mapData);

      // Step 2: Create star systems at their positions
      logger.info('[Gin7MapSeedService] Phase 2: Seeding star systems...');
      const systemResult = await this.seedStarSystems(sessionId, mapData);
      systemsCreated = systemResult.systemsCreated;
      planetsCreated = systemResult.planetsCreated;

      // Step 3: Mark corridor regions (based on blocked cell patterns)
      logger.info('[Gin7MapSeedService] Phase 3: Marking special terrain...');
      await this.markSpecialTerrain(sessionId, mapData);

      logger.info(
        `[Gin7MapSeedService] Galaxy seed completed: ` +
        `${gridsCreated} grids, ${systemsCreated} systems, ${planetsCreated} planets`
      );

      return { gridsCreated, systemsCreated, planetsCreated };
    } catch (error) {
      logger.error('[Gin7MapSeedService] Galaxy seed failed:', error);
      throw error;
    }
  }

  /**
   * Seed all grid cells from the map data
   */
  private static async seedGridCells(sessionId: string, mapData: FullMapData): Promise<number> {
    const { grid, gridInfo } = mapData;
    const bulkOps: any[] = [];
    let created = 0;

    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        const isPassable = grid[y][x] === 1;
        
        // Determine terrain type based on passability
        const terrain: GridTerrain = isPassable ? 'normal' : 'nebula';
        
        // Create terrain modifiers
        const terrainModifiers = isPassable
          ? { movementCost: 1.0, detectionRange: 1.0, combatModifier: 1.0 }
          : { movementCost: 10.0, detectionRange: 0.3, combatModifier: 0.5 }; // Blocked cells have high cost

        bulkOps.push({
          updateOne: {
            filter: { sessionId, x, y },
            update: {
              $setOnInsert: {
                sessionId,
                x,
                y,
                terrain,
                terrainModifiers,
                occupants: [],
                ownerFactions: [],
                starSystemIds: [],
                exploredBy: [],
                data: { isPassable },
              },
            },
            upsert: true,
          },
        });

        created++;

        // Execute in batches of 500
        if (bulkOps.length >= 500) {
          await GalaxyGrid.bulkWrite(bulkOps);
          bulkOps.length = 0;
          logger.debug(`[Gin7MapSeedService] Processed ${created} grid cells...`);
        }
      }
    }

    // Execute remaining operations
    if (bulkOps.length > 0) {
      await GalaxyGrid.bulkWrite(bulkOps);
    }

    logger.info(`[Gin7MapSeedService] Created ${created} grid cells`);
    return created;
  }

  /**
   * Seed all star systems from map data
   */
  private static async seedStarSystems(
    sessionId: string,
    mapData: FullMapData
  ): Promise<{ systemsCreated: number; planetsCreated: number }> {
    let systemsCreated = 0;
    let planetsCreated = 0;

    for (const systemData of mapData.starSystems) {
      try {
        const result = await this.createStarSystem(sessionId, systemData);
        if (result.system) {
          systemsCreated++;
          planetsCreated += result.planetsCreated;
        }
      } catch (error) {
        logger.error(`[Gin7MapSeedService] Failed to create system ${systemData.system_name_ko}:`, error);
      }
    }

    logger.info(`[Gin7MapSeedService] Created ${systemsCreated} star systems with ${planetsCreated} planets`);
    return { systemsCreated, planetsCreated };
  }

  /**
   * Create a single star system with planets
   */
  private static async createStarSystem(
    sessionId: string,
    data: StarSystemData
  ): Promise<{ system: IStarSystem | null; planetsCreated: number }> {
    const systemId = uuidv4();
    const factionCode = MapDataLoader.factionToCode(data.faction);
    const specialData = SPECIAL_SYSTEMS[data.system_id] || {};

    // Determine star type based on system_id (deterministic but varied)
    const starTypes: StarType[] = ['yellow_dwarf', 'red_giant', 'blue_giant', 'white_dwarf', 'binary', 'neutron'];
    const starType = starTypes[data.system_id % starTypes.length];

    // Update grid to mark as having a star system
    await GalaxyGrid.findOneAndUpdate(
      { sessionId, x: data.grid_x, y: data.grid_y },
      {
        $set: {
          terrain: 'normal',
          name: data.system_name_ko,
          'terrainModifiers.movementCost': 1.0,
          'terrainModifiers.detectionRange': 1.0,
          'terrainModifiers.combatModifier': 1.0,
          'data.isPassable': true,
        },
        $addToSet: {
          starSystemIds: systemId,
          exploredBy: factionCode,
        },
      },
      { upsert: true }
    );

    // Create star system document
    const system = await StarSystem.create({
      systemId,
      sessionId,
      name: data.system_name_ko,
      originalName: data.system_name_en || undefined,
      gridRef: { x: data.grid_x, y: data.grid_y },
      localPosition: { x: 500, y: 500 },
      starType,
      strategicValue: specialData.strategicValue || this.calculateStrategicValue(data),
      isCapital: specialData.isCapital || false,
      isFortress: specialData.isFortress || false,
      controllingFactionId: factionCode,
      warpGateLevel: specialData.warpGateLevel || Math.floor(data.system_id % 5) + 1,
      description: specialData.description,
      stations: specialData.isFortress
        ? [{ stationId: uuidv4(), type: 'fortress' as const, ownerId: factionCode, hp: 50000, maxHp: 50000 }]
        : [],
      data: {
        sourceSystemId: data.system_id,
        planetNumber: data.planet_number,
      },
    });

    // Generate planets for this system
    const planetsCreated = await this.createPlanetsForSystem(sessionId, systemId, data, factionCode);

    logger.debug(`[Gin7MapSeedService] Created system: ${data.system_name_ko} at (${data.grid_x}, ${data.grid_y})`);
    return { system, planetsCreated };
  }

  /**
   * Calculate strategic value based on system properties
   */
  private static calculateStrategicValue(data: StarSystemData): number {
    let value = 20; // Base value

    // Higher value for systems near center (corridors)
    const distFromCenter = Math.abs(data.grid_x - 50);
    if (distFromCenter < 20) value += 30;
    else if (distFromCenter < 30) value += 15;

    // Faction capitals get bonus
    if (data.faction === '페잔 자치령') value += 20;

    // Random variation based on system_id
    value += (data.system_id % 20);

    return Math.min(100, Math.max(10, value));
  }

  /**
   * Create planets for a star system
   */
  private static async createPlanetsForSystem(
    sessionId: string,
    systemId: string,
    systemData: StarSystemData,
    factionCode: string
  ): Promise<number> {
    const template = PLANET_TEMPLATES[factionCode] || PLANET_TEMPLATES[FACTIONS.NEUTRAL];
    
    // Determine number of planets (based on planet_number in source data, or template average)
    const planetCount = systemData.planet_number > 0 
      ? Math.min(systemData.planet_number, 5) 
      : Math.floor(Math.random() * template.avgPlanets) + 1;

    const planetIds: string[] = [];
    const specialData = SPECIAL_SYSTEMS[systemData.system_id];

    for (let i = 0; i < planetCount; i++) {
      const planetId = uuidv4();
      const planetType = template.types[i % template.types.length];
      const size = this.getPlanetSize(planetType, i);
      const isHomeworld = specialData?.isCapital && i === 0;

      // Calculate population based on planet type and faction
      const { population, maxPopulation } = this.calculatePopulation(planetType, size, factionCode, isHomeworld);

      // Generate facilities
      const facilities = this.generateFacilities(planetType, size, factionCode, isHomeworld);

      await Planet.create({
        planetId,
        sessionId,
        systemId,
        name: `${systemData.system_name_ko} ${this.toRoman(i + 1)}`,
        type: planetType,
        size,
        orbitIndex: i + 1,
        ownerId: factionCode,
        population,
        maxPopulation,
        isHomeworld,
        facilities,
        maxFacilitySlots: size === 'huge' ? 15 : size === 'large' ? 12 : size === 'medium' ? 10 : 6,
        morale: isHomeworld ? 90 : 70,
        loyalty: factionCode === FACTIONS.NEUTRAL ? 50 : 80,
        description: isHomeworld ? `${systemData.faction}의 주요 행성` : undefined,
      });

      planetIds.push(planetId);
    }

    // Update system with planet references
    await StarSystem.updateOne({ systemId }, { $set: { planetIds } });

    return planetIds.length;
  }

  /**
   * Get planet size based on type and orbit
   */
  private static getPlanetSize(type: PlanetType, orbitIndex: number): 'small' | 'medium' | 'large' | 'huge' {
    if (type === 'terran' || type === 'ocean') {
      return orbitIndex === 0 ? 'huge' : orbitIndex === 1 ? 'large' : 'medium';
    }
    if (type === 'gas_giant') {
      return 'huge';
    }
    return orbitIndex < 2 ? 'medium' : 'small';
  }

  /**
   * Calculate population based on planet properties
   */
  private static calculatePopulation(
    type: PlanetType,
    size: string,
    faction: string,
    isHomeworld: boolean
  ): { population: number; maxPopulation: number } {
    let basePop = 0;
    let multiplier = 1;

    // Base population by type
    switch (type) {
      case 'terran':
        basePop = 5_000_000_000;
        break;
      case 'ocean':
        basePop = 3_000_000_000;
        break;
      case 'desert':
        basePop = 1_000_000_000;
        break;
      case 'ice':
        basePop = 500_000_000;
        break;
      default:
        basePop = 100_000_000;
    }

    // Size multiplier
    switch (size) {
      case 'huge':
        multiplier *= 5;
        break;
      case 'large':
        multiplier *= 2;
        break;
      case 'medium':
        multiplier *= 1;
        break;
      default:
        multiplier *= 0.5;
    }

    // Homeworld bonus
    if (isHomeworld) {
      multiplier *= 10;
    }

    // Faction variation
    if (faction === FACTIONS.GALACTIC_EMPIRE) {
      multiplier *= 1.2; // Empire has larger populations
    }

    const population = Math.floor(basePop * multiplier);
    const maxPopulation = population * 3;

    return { population, maxPopulation };
  }

  /**
   * Generate facilities for a planet
   */
  private static generateFacilities(
    type: PlanetType,
    size: string,
    faction: string,
    isHomeworld: boolean
  ): IPlanetFacility[] {
    const facilities: IPlanetFacility[] = [];

    if (isHomeworld) {
      facilities.push(this.createFacility('capital_building', 10));
      facilities.push(this.createFacility('military_academy', 8));
      facilities.push(this.createFacility('shipyard', 7));
      facilities.push(this.createFacility('factory', 8));
      facilities.push(this.createFacility('spaceport', 9));
      return facilities;
    }

    // Standard facilities based on type
    if (type === 'terran' || type === 'ocean') {
      facilities.push(this.createFacility('farm', 4 + Math.floor(Math.random() * 3)));
      facilities.push(this.createFacility('factory', 3 + Math.floor(Math.random() * 3)));
    }
    if (type === 'desert' || type === 'barren') {
      facilities.push(this.createFacility('mine', 4 + Math.floor(Math.random() * 3)));
    }
    if (size === 'large' || size === 'huge') {
      facilities.push(this.createFacility('spaceport', 3 + Math.floor(Math.random() * 3)));
    }

    return facilities;
  }

  /**
   * Create a facility object
   */
  private static createFacility(type: FacilityType, level: number): IPlanetFacility {
    return {
      facilityId: uuidv4(),
      type,
      level,
      hp: level * 100,
      maxHp: level * 100,
      isOperational: true,
      productionBonus: 0,
    };
  }

  /**
   * Convert number to Roman numeral
   */
  private static toRoman(num: number): string {
    const romanNumerals: [number, string][] = [
      [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
    ];
    let result = '';
    let remaining = num;
    for (const [value, numeral] of romanNumerals) {
      while (remaining >= value) {
        result += numeral;
        remaining -= value;
      }
    }
    return result;
  }

  /**
   * Mark special terrain areas (corridors, black holes, etc.)
   */
  private static async markSpecialTerrain(sessionId: string, mapData: FullMapData): Promise<void> {
    // Identify corridor regions by looking at blocked cell patterns
    // The corridors are narrow passages between blocked regions
    
    // Mark Iserlohn Corridor region (approximate y: 10-20)
    const corridorUpdates: any[] = [];
    
    for (let x = 15; x <= 85; x++) {
      for (let y = 10; y <= 20; y++) {
        if (MapDataLoader.isPassable(mapData, x, y)) {
          // Check if this is in a corridor (passable cells surrounded by blocked)
          const neighbors = [
            MapDataLoader.isPassable(mapData, x, y - 1),
            MapDataLoader.isPassable(mapData, x, y + 1),
          ];
          const blockedNeighbors = neighbors.filter(n => !n).length;
          
          if (blockedNeighbors >= 1) {
            corridorUpdates.push({
              updateOne: {
                filter: { sessionId, x, y },
                update: {
                  $set: {
                    terrain: 'corridor',
                    'terrainModifiers.movementCost': 0.8,
                    'terrainModifiers.detectionRange': 0.7,
                    name: '이제를론 회랑',
                  },
                },
              },
            });
          }
        }
      }
    }

    // Mark Fezzan Corridor region (approximate y: 25-35)
    for (let x = 30; x <= 70; x++) {
      for (let y = 25; y <= 35; y++) {
        if (MapDataLoader.isPassable(mapData, x, y)) {
          const neighbors = [
            MapDataLoader.isPassable(mapData, x, y - 1),
            MapDataLoader.isPassable(mapData, x, y + 1),
          ];
          const blockedNeighbors = neighbors.filter(n => !n).length;
          
          if (blockedNeighbors >= 1) {
            corridorUpdates.push({
              updateOne: {
                filter: { sessionId, x, y },
                update: {
                  $set: {
                    terrain: 'corridor',
                    'terrainModifiers.movementCost': 0.8,
                    'terrainModifiers.detectionRange': 0.7,
                    name: '페잔 회랑',
                  },
                },
              },
            });
          }
        }
      }
    }

    if (corridorUpdates.length > 0) {
      await GalaxyGrid.bulkWrite(corridorUpdates);
      logger.info(`[Gin7MapSeedService] Marked ${corridorUpdates.length} corridor cells`);
    }
  }

  /**
   * Clear all map data for a session
   */
  public static async clearGalaxy(sessionId: string): Promise<void> {
    await GalaxyGrid.deleteMany({ sessionId });
    await StarSystem.deleteMany({ sessionId });
    await Planet.deleteMany({ sessionId });
    logger.info(`[Gin7MapSeedService] Cleared galaxy for session ${sessionId}`);
  }

  /**
   * Get seeding statistics
   */
  public static async getStats(sessionId: string): Promise<{
    grids: number;
    passableGrids: number;
    blockedGrids: number;
    systems: number;
    planets: number;
    byFaction: Record<string, number>;
  }> {
    const grids = await GalaxyGrid.countDocuments({ sessionId });
    const passableGrids = await GalaxyGrid.countDocuments({ sessionId, terrain: { $ne: 'nebula' } });
    const blockedGrids = await GalaxyGrid.countDocuments({ sessionId, terrain: 'nebula' });
    const systems = await StarSystem.countDocuments({ sessionId });
    const planets = await Planet.countDocuments({ sessionId });

    const byFactionAgg = await StarSystem.aggregate([
      { $match: { sessionId } },
      { $group: { _id: '$controllingFactionId', count: { $sum: 1 } } },
    ]);

    const byFaction: Record<string, number> = {};
    for (const item of byFactionAgg) {
      byFaction[item._id] = item.count;
    }

    return { grids, passableGrids, blockedGrids, systems, planets, byFaction };
  }
}

