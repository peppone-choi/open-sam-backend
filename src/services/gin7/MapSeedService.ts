import { v4 as uuidv4 } from 'uuid';
import { GalaxyGrid, IGalaxyGrid, GridTerrain } from '../../models/gin7/GalaxyGrid';
import { StarSystem, IStarSystem, StarType } from '../../models/gin7/StarSystem';
import { Planet, IPlanet, PlanetType, FacilityType, IPlanetFacility } from '../../models/gin7/Planet';
import { logger } from '../../common/logger';

/**
 * Faction IDs (to be replaced with actual faction references)
 */
export const FACTIONS = {
  GALACTIC_EMPIRE: 'faction_empire',
  FREE_PLANETS_ALLIANCE: 'faction_alliance',
  FEZZAN: 'faction_fezzan',
  NEUTRAL: 'faction_neutral',
} as const;

/**
 * Major star system definitions based on Legend of Galactic Heroes
 */
interface StarSystemSeed {
  name: string;
  originalName?: string;
  gridX: number;
  gridY: number;
  starType: StarType;
  faction: string;
  isCapital: boolean;
  isFortress: boolean;
  strategicValue: number;
  warpGateLevel: number;
  planets: PlanetSeed[];
  stations?: StationSeed[];
  description?: string;
}

interface PlanetSeed {
  name: string;
  type: PlanetType;
  size: 'small' | 'medium' | 'large' | 'huge';
  orbitIndex: number;
  population: number;
  maxPopulation: number;
  isHomeworld: boolean;
  facilities: { type: FacilityType; level: number }[];
  description?: string;
}

interface StationSeed {
  type: 'military_base' | 'trading_post' | 'shipyard' | 'research_station' | 'fortress';
  hp: number;
}

interface CorridorDefinition {
  name: string;
  startGrid: { x: number; y: number };
  endGrid: { x: number; y: number };
  width: number;  // How many grids wide
}

/**
 * Major Systems - Legend of Galactic Heroes Universe
 * 
 * Map Layout (100x100):
 * - Empire territory: x: 70-99 (right side)
 * - Alliance territory: x: 0-30 (left side)
 * - Corridors: x: 30-70 (middle, narrow passages)
 * - Iserlohn Corridor: y: 45-55
 * - Fezzan Corridor: y: 20-30
 */
const MAJOR_SYSTEMS: StarSystemSeed[] = [
  // ======= GALACTIC EMPIRE =======
  {
    name: 'Odin',
    originalName: 'オーディン',
    gridX: 90,
    gridY: 50,
    starType: 'yellow_dwarf',
    faction: FACTIONS.GALACTIC_EMPIRE,
    isCapital: true,
    isFortress: false,
    strategicValue: 100,
    warpGateLevel: 5,
    description: 'Capital of the Galactic Empire. Home to Neue Sanssouci palace.',
    planets: [
      {
        name: 'Odin Prime',
        type: 'terran',
        size: 'huge',
        orbitIndex: 3,
        population: 50000000000,  // 50 billion
        maxPopulation: 100000000000,
        isHomeworld: true,
        description: 'Seat of the Goldenbaum Dynasty',
        facilities: [
          { type: 'capital_building', level: 10 },
          { type: 'military_academy', level: 8 },
          { type: 'shipyard', level: 7 },
          { type: 'factory', level: 8 },
          { type: 'spaceport', level: 9 },
        ]
      },
      {
        name: 'Odin II',
        type: 'desert',
        size: 'medium',
        orbitIndex: 2,
        population: 5000000000,
        maxPopulation: 20000000000,
        isHomeworld: false,
        facilities: [
          { type: 'mine', level: 6 },
          { type: 'factory', level: 5 },
        ]
      }
    ],
    stations: [
      { type: 'military_base', hp: 10000 },
      { type: 'shipyard', hp: 8000 },
    ]
  },
  {
    name: 'Phezzan',
    originalName: 'フェザーン',
    gridX: 50,
    gridY: 25,
    starType: 'yellow_dwarf',
    faction: FACTIONS.FEZZAN,
    isCapital: true,
    isFortress: false,
    strategicValue: 90,
    warpGateLevel: 5,
    description: 'Autonomous dominion and trade hub. Controls the Fezzan Corridor.',
    planets: [
      {
        name: 'Phezzan',
        type: 'terran',
        size: 'large',
        orbitIndex: 2,
        population: 30000000000,
        maxPopulation: 50000000000,
        isHomeworld: true,
        description: 'Center of galactic commerce',
        facilities: [
          { type: 'capital_building', level: 8 },
          { type: 'spaceport', level: 10 },
          { type: 'factory', level: 7 },
          { type: 'entertainment', level: 8 },
        ]
      }
    ],
    stations: [
      { type: 'trading_post', hp: 5000 },
      { type: 'trading_post', hp: 5000 },
    ]
  },
  // Kreuznach - Empire secondary system
  {
    name: 'Kreuznach',
    gridX: 85,
    gridY: 45,
    starType: 'yellow_dwarf',
    faction: FACTIONS.GALACTIC_EMPIRE,
    isCapital: false,
    isFortress: false,
    strategicValue: 60,
    warpGateLevel: 3,
    description: 'Major industrial center of the Empire',
    planets: [
      {
        name: 'Kreuznach III',
        type: 'terran',
        size: 'large',
        orbitIndex: 3,
        population: 15000000000,
        maxPopulation: 40000000000,
        isHomeworld: false,
        facilities: [
          { type: 'factory', level: 8 },
          { type: 'shipyard', level: 6 },
          { type: 'mine', level: 5 },
        ]
      }
    ]
  },
  // Geiersburg - Empire fortress (mobile fortress base)
  {
    name: 'Geiersburg',
    originalName: 'ガイエスブルク',
    gridX: 75,
    gridY: 48,
    starType: 'red_giant',
    faction: FACTIONS.GALACTIC_EMPIRE,
    isCapital: false,
    isFortress: true,
    strategicValue: 80,
    warpGateLevel: 4,
    description: 'Site of the mobile fortress construction',
    planets: [
      {
        name: 'Geiersburg Base',
        type: 'barren',
        size: 'small',
        orbitIndex: 1,
        population: 500000000,
        maxPopulation: 2000000000,
        isHomeworld: false,
        facilities: [
          { type: 'military_academy', level: 6 },
          { type: 'defense_grid', level: 8 },
        ]
      }
    ],
    stations: [
      { type: 'fortress', hp: 50000 },
    ]
  },

  // ======= ISERLOHN CORRIDOR =======
  {
    name: 'Iserlohn',
    originalName: 'イゼルローン',
    gridX: 50,
    gridY: 50,
    starType: 'binary',
    faction: FACTIONS.GALACTIC_EMPIRE, // Initially Empire controlled
    isCapital: false,
    isFortress: true,
    strategicValue: 95,
    warpGateLevel: 5,
    description: 'The impregnable space fortress guarding the Iserlohn Corridor. Key strategic chokepoint between Empire and Alliance.',
    planets: [],
    stations: [
      { type: 'fortress', hp: 100000 }, // Iserlohn Fortress - Thor Hammer
    ]
  },
  // Amlitzer - near Iserlohn
  {
    name: 'Amlitzer',
    originalName: 'アムリッツァ',
    gridX: 55,
    gridY: 52,
    starType: 'red_giant',
    faction: FACTIONS.NEUTRAL,
    isCapital: false,
    isFortress: false,
    strategicValue: 40,
    warpGateLevel: 2,
    description: 'Site of the devastating Battle of Amlitzer',
    planets: [
      {
        name: 'Amlitzer II',
        type: 'ice',
        size: 'small',
        orbitIndex: 2,
        population: 0,
        maxPopulation: 1000000000,
        isHomeworld: false,
        facilities: []
      }
    ]
  },
  // Astarte - Battle location
  {
    name: 'Astarte',
    originalName: 'アスターテ',
    gridX: 45,
    gridY: 48,
    starType: 'yellow_dwarf',
    faction: FACTIONS.NEUTRAL,
    isCapital: false,
    isFortress: false,
    strategicValue: 30,
    warpGateLevel: 1,
    description: 'Site of Yang Wen-li first major victory',
    planets: [
      {
        name: 'Astarte I',
        type: 'barren',
        size: 'small',
        orbitIndex: 1,
        population: 0,
        maxPopulation: 500000000,
        isHomeworld: false,
        facilities: []
      }
    ]
  },

  // ======= FREE PLANETS ALLIANCE =======
  {
    name: 'Heinessen',
    originalName: 'ハイネセン',
    gridX: 10,
    gridY: 50,
    starType: 'yellow_dwarf',
    faction: FACTIONS.FREE_PLANETS_ALLIANCE,
    isCapital: true,
    isFortress: false,
    strategicValue: 100,
    warpGateLevel: 5,
    description: 'Capital of the Free Planets Alliance. Founded by Ale Heinessen.',
    planets: [
      {
        name: 'Heinessen',
        type: 'terran',
        size: 'huge',
        orbitIndex: 3,
        population: 40000000000,
        maxPopulation: 80000000000,
        isHomeworld: true,
        description: 'Heart of the democratic Alliance',
        facilities: [
          { type: 'capital_building', level: 10 },
          { type: 'military_academy', level: 7 },
          { type: 'shipyard', level: 6 },
          { type: 'factory', level: 7 },
          { type: 'spaceport', level: 8 },
          { type: 'entertainment', level: 6 },
        ]
      },
      {
        name: 'Heinessen II',
        type: 'ocean',
        size: 'medium',
        orbitIndex: 2,
        population: 8000000000,
        maxPopulation: 25000000000,
        isHomeworld: false,
        facilities: [
          { type: 'farm', level: 8 },
          { type: 'research_lab', level: 5 },
        ]
      }
    ],
    stations: [
      { type: 'military_base', hp: 8000 },
      { type: 'shipyard', hp: 7000 },
    ]
  },
  // Tiamat - Alliance military base
  {
    name: 'Tiamat',
    originalName: 'ティアマト',
    gridX: 20,
    gridY: 55,
    starType: 'blue_giant',
    faction: FACTIONS.FREE_PLANETS_ALLIANCE,
    isCapital: false,
    isFortress: false,
    strategicValue: 50,
    warpGateLevel: 3,
    description: 'Major Alliance naval base',
    planets: [
      {
        name: 'Tiamat III',
        type: 'terran',
        size: 'medium',
        orbitIndex: 3,
        population: 5000000000,
        maxPopulation: 15000000000,
        isHomeworld: false,
        facilities: [
          { type: 'military_academy', level: 6 },
          { type: 'shipyard', level: 7 },
        ]
      }
    ],
    stations: [
      { type: 'military_base', hp: 6000 },
    ]
  },
  // El Facil - Alliance system
  {
    name: 'El Facil',
    originalName: 'エル・ファシル',
    gridX: 25,
    gridY: 45,
    starType: 'yellow_dwarf',
    faction: FACTIONS.FREE_PLANETS_ALLIANCE,
    isCapital: false,
    isFortress: false,
    strategicValue: 45,
    warpGateLevel: 2,
    description: 'Where Yang Wen-li became famous for evacuation success',
    planets: [
      {
        name: 'El Facil',
        type: 'terran',
        size: 'medium',
        orbitIndex: 2,
        population: 3000000000,
        maxPopulation: 10000000000,
        isHomeworld: false,
        facilities: [
          { type: 'farm', level: 5 },
          { type: 'factory', level: 4 },
          { type: 'spaceport', level: 5 },
        ]
      }
    ]
  },
  // Shampool - Alliance border system
  {
    name: 'Shampool',
    gridX: 30,
    gridY: 52,
    starType: 'white_dwarf',
    faction: FACTIONS.FREE_PLANETS_ALLIANCE,
    isCapital: false,
    isFortress: false,
    strategicValue: 35,
    warpGateLevel: 2,
    description: 'Border system near the Iserlohn corridor',
    planets: [
      {
        name: 'Shampool II',
        type: 'desert',
        size: 'small',
        orbitIndex: 2,
        population: 1000000000,
        maxPopulation: 5000000000,
        isHomeworld: false,
        facilities: [
          { type: 'mine', level: 5 },
        ]
      }
    ]
  },
];

/**
 * Corridor definitions - narrow passages between Empire and Alliance
 */
const CORRIDORS: CorridorDefinition[] = [
  {
    name: 'Iserlohn Corridor',
    startGrid: { x: 35, y: 48 },
    endGrid: { x: 65, y: 52 },
    width: 5
  },
  {
    name: 'Fezzan Corridor',
    startGrid: { x: 35, y: 22 },
    endGrid: { x: 65, y: 28 },
    width: 7
  }
];

/**
 * MapSeedService
 * Seeds the galaxy map with initial data
 */
export class MapSeedService {
  
  /**
   * Seed the complete galaxy map for a session
   */
  public static async seedGalaxy(sessionId: string): Promise<{
    gridsCreated: number;
    systemsCreated: number;
    planetsCreated: number;
  }> {
    logger.info(`[MapSeedService] Starting galaxy seed for session ${sessionId}`);
    
    let gridsCreated = 0;
    let systemsCreated = 0;
    let planetsCreated = 0;

    try {
      // 1. Create corridor terrain (special grids)
      for (const corridor of CORRIDORS) {
        const created = await this.seedCorridor(sessionId, corridor);
        gridsCreated += created;
      }

      // 2. Create special terrain (nebulae, asteroid fields)
      gridsCreated += await this.seedSpecialTerrain(sessionId);

      // 3. Create major star systems
      for (const systemSeed of MAJOR_SYSTEMS) {
        const result = await this.seedStarSystem(sessionId, systemSeed);
        if (result.system) {
          systemsCreated++;
          planetsCreated += result.planetsCreated;
          gridsCreated++; // Grid for the system
        }
      }

      // 4. Generate additional minor systems
      const minorResult = await this.seedMinorSystems(sessionId, 45);
      systemsCreated += minorResult.systemsCreated;
      planetsCreated += minorResult.planetsCreated;
      gridsCreated += minorResult.gridsCreated;

      logger.info(`[MapSeedService] Galaxy seed completed: ${gridsCreated} grids, ${systemsCreated} systems, ${planetsCreated} planets`);

      return { gridsCreated, systemsCreated, planetsCreated };
    } catch (error) {
      logger.error('[MapSeedService] Galaxy seed failed:', error);
      throw error;
    }
  }

  /**
   * Seed a corridor between Empire and Alliance
   */
  private static async seedCorridor(sessionId: string, corridor: CorridorDefinition): Promise<number> {
    let created = 0;
    
    const startY = corridor.startGrid.y;
    const endY = corridor.endGrid.y;
    const midY = Math.floor((startY + endY) / 2);
    
    for (let x = corridor.startGrid.x; x <= corridor.endGrid.x; x++) {
      for (let y = midY - Math.floor(corridor.width / 2); y <= midY + Math.floor(corridor.width / 2); y++) {
        const existingGrid = await GalaxyGrid.findOne({ sessionId, x, y });
        if (!existingGrid) {
          await GalaxyGrid.create({
            sessionId,
            x,
            y,
            terrain: 'corridor',
            terrainModifiers: {
              movementCost: 0.8,  // Faster through corridor
              detectionRange: 0.7, // Harder to hide
              combatModifier: 1.0
            },
            name: corridor.name,
            exploredBy: [FACTIONS.GALACTIC_EMPIRE, FACTIONS.FREE_PLANETS_ALLIANCE, FACTIONS.FEZZAN]
          });
          created++;
        }
      }
    }
    
    // Create surrounding nebula/asteroid terrain to make corridor necessary
    for (let x = corridor.startGrid.x; x <= corridor.endGrid.x; x++) {
      // Above corridor
      for (let y = midY + Math.floor(corridor.width / 2) + 1; y <= midY + Math.floor(corridor.width / 2) + 3; y++) {
        if (y < 100) {
          const existing = await GalaxyGrid.findOne({ sessionId, x, y });
          if (!existing) {
            await GalaxyGrid.create({
              sessionId,
              x,
              y,
              terrain: 'nebula',
              terrainModifiers: {
                movementCost: 2.0,
                detectionRange: 0.3,
                combatModifier: 0.8
              }
            });
            created++;
          }
        }
      }
      // Below corridor
      for (let y = midY - Math.floor(corridor.width / 2) - 3; y < midY - Math.floor(corridor.width / 2); y++) {
        if (y >= 0) {
          const existing = await GalaxyGrid.findOne({ sessionId, x, y });
          if (!existing) {
            await GalaxyGrid.create({
              sessionId,
              x,
              y,
              terrain: 'nebula',
              terrainModifiers: {
                movementCost: 2.0,
                detectionRange: 0.3,
                combatModifier: 0.8
              }
            });
            created++;
          }
        }
      }
    }
    
    logger.info(`[MapSeedService] Created ${corridor.name}: ${created} grids`);
    return created;
  }

  /**
   * Seed special terrain areas
   */
  private static async seedSpecialTerrain(sessionId: string): Promise<number> {
    let created = 0;
    
    // Create some black holes (impassable)
    const blackHoles = [
      { x: 40, y: 70 },
      { x: 60, y: 15 },
      { x: 75, y: 80 },
    ];
    
    for (const bh of blackHoles) {
      await GalaxyGrid.create({
        sessionId,
        x: bh.x,
        y: bh.y,
        terrain: 'black_hole',
        name: 'Black Hole',
        terrainModifiers: {
          movementCost: 999,
          detectionRange: 0,
          combatModifier: 0
        }
      });
      created++;
    }
    
    // Create asteroid fields
    const asteroidFields = [
      { x: 15, y: 70, radius: 2 },
      { x: 80, y: 30, radius: 2 },
      { x: 55, y: 75, radius: 3 },
    ];
    
    for (const field of asteroidFields) {
      for (let dx = -field.radius; dx <= field.radius; dx++) {
        for (let dy = -field.radius; dy <= field.radius; dy++) {
          const x = field.x + dx;
          const y = field.y + dy;
          if (x >= 0 && x < 100 && y >= 0 && y < 100) {
            const existing = await GalaxyGrid.findOne({ sessionId, x, y });
            if (!existing) {
              await GalaxyGrid.create({
                sessionId,
                x,
                y,
                terrain: 'asteroid_field',
                terrainModifiers: {
                  movementCost: 1.5,
                  detectionRange: 0.5,
                  combatModifier: 0.9
                }
              });
              created++;
            }
          }
        }
      }
    }
    
    return created;
  }

  /**
   * Seed a major star system
   */
  private static async seedStarSystem(
    sessionId: string, 
    seed: StarSystemSeed
  ): Promise<{ system: IStarSystem | null; planetsCreated: number }> {
    try {
      const systemId = uuidv4();
      
      // Create or update grid
      await GalaxyGrid.findOneAndUpdate(
        { sessionId, x: seed.gridX, y: seed.gridY },
        {
          $set: {
            terrain: 'normal',
            name: seed.name,
            exploredBy: [seed.faction]
          },
          $addToSet: { starSystemIds: systemId }
        },
        { upsert: true }
      );

      // Create star system
      const system = await StarSystem.create({
        systemId,
        sessionId,
        name: seed.name,
        originalName: seed.originalName,
        gridRef: { x: seed.gridX, y: seed.gridY },
        localPosition: { x: 500, y: 500 },
        starType: seed.starType,
        strategicValue: seed.strategicValue,
        isCapital: seed.isCapital,
        isFortress: seed.isFortress,
        controllingFactionId: seed.faction,
        warpGateLevel: seed.warpGateLevel,
        description: seed.description,
        stations: (seed.stations || []).map(s => ({
          stationId: uuidv4(),
          type: s.type,
          ownerId: seed.faction,
          hp: s.hp,
          maxHp: s.hp
        }))
      });

      // Create planets
      let planetsCreated = 0;
      for (const planetSeed of seed.planets) {
        const planetId = uuidv4();
        
        const facilities: IPlanetFacility[] = planetSeed.facilities.map(f => ({
          facilityId: uuidv4(),
          type: f.type,
          level: f.level,
          hp: f.level * 100,
          maxHp: f.level * 100,
          isOperational: true,
          productionBonus: 0
        }));

        await Planet.create({
          planetId,
          sessionId,
          systemId,
          name: planetSeed.name,
          type: planetSeed.type,
          size: planetSeed.size,
          orbitIndex: planetSeed.orbitIndex,
          ownerId: seed.faction,
          population: planetSeed.population,
          maxPopulation: planetSeed.maxPopulation,
          isHomeworld: planetSeed.isHomeworld,
          facilities,
          maxFacilitySlots: planetSeed.size === 'huge' ? 15 : planetSeed.size === 'large' ? 12 : planetSeed.size === 'medium' ? 10 : 6,
          morale: 70,
          loyalty: seed.faction === FACTIONS.NEUTRAL ? 50 : 80,
          description: planetSeed.description
        });

        // Update system with planet reference
        await StarSystem.updateOne(
          { systemId },
          { $push: { planetIds: planetId } }
        );

        planetsCreated++;
      }

      logger.info(`[MapSeedService] Created system: ${seed.name} with ${planetsCreated} planets`);
      return { system, planetsCreated };
    } catch (error) {
      logger.error(`[MapSeedService] Failed to create system ${seed.name}:`, error);
      return { system: null, planetsCreated: 0 };
    }
  }

  /**
   * Generate minor systems to fill the galaxy
   */
  private static async seedMinorSystems(
    sessionId: string,
    count: number
  ): Promise<{ systemsCreated: number; planetsCreated: number; gridsCreated: number }> {
    let systemsCreated = 0;
    let planetsCreated = 0;
    let gridsCreated = 0;

    const names = [
      'Altair', 'Vega', 'Capella', 'Deneb', 'Rigel', 'Betelgeuse', 'Sirius',
      'Arcturus', 'Procyon', 'Pollux', 'Castor', 'Aldebaran', 'Spica',
      'Antares', 'Regulus', 'Fomalhaut', 'Canopus', 'Achernar', 'Hadar',
      'Acrux', 'Mimosa', 'Alioth', 'Dubhe', 'Alkaid', 'Mizar', 'Merak',
      'Phecda', 'Megrez', 'Thuban', 'Alderamin', 'Enif', 'Markab',
      'Scheat', 'Algenib', 'Alpheratz', 'Caph', 'Shedar', 'Ruchbah',
      'Navi', 'Mirfak', 'Almaak', 'Hamal', 'Sheratan', 'Menkar',
      'Zaurak', 'Arneb', 'Nihal', 'Saiph', 'Mintaka', 'Alnilam'
    ];

    for (let i = 0; i < count && i < names.length; i++) {
      // Find empty grid
      let x, y;
      let attempts = 0;
      do {
        x = Math.floor(Math.random() * 100);
        y = Math.floor(Math.random() * 100);
        attempts++;
      } while (
        attempts < 100 &&
        await GalaxyGrid.findOne({ sessionId, x, y, starSystemIds: { $exists: true, $ne: [] } })
      );

      if (attempts >= 100) continue;

      // Determine faction based on position
      let faction: string = FACTIONS.NEUTRAL;
      if (x > 70) faction = FACTIONS.GALACTIC_EMPIRE;
      else if (x < 30) faction = FACTIONS.FREE_PLANETS_ALLIANCE;

      const seed: StarSystemSeed = {
        name: names[i],
        gridX: x,
        gridY: y,
        starType: this.randomStarType(),
        faction,
        isCapital: false,
        isFortress: false,
        strategicValue: Math.floor(Math.random() * 40) + 10,
        warpGateLevel: Math.floor(Math.random() * 3),
        planets: this.generateRandomPlanets(1 + Math.floor(Math.random() * 3), faction)
      };

      const result = await this.seedStarSystem(sessionId, seed);
      if (result.system) {
        systemsCreated++;
        planetsCreated += result.planetsCreated;
        gridsCreated++;
      }
    }

    return { systemsCreated, planetsCreated, gridsCreated };
  }

  private static randomStarType(): StarType {
    const types: StarType[] = ['yellow_dwarf', 'red_giant', 'blue_giant', 'white_dwarf', 'binary', 'neutron'];
    const weights = [0.4, 0.2, 0.1, 0.15, 0.1, 0.05];
    const rand = Math.random();
    let sum = 0;
    for (let i = 0; i < types.length; i++) {
      sum += weights[i];
      if (rand < sum) return types[i];
    }
    return 'yellow_dwarf';
  }

  private static generateRandomPlanets(count: number, faction: string): PlanetSeed[] {
    const planets: PlanetSeed[] = [];
    const types: PlanetType[] = ['terran', 'ocean', 'desert', 'ice', 'volcanic', 'barren'];
    const sizes: Array<'small' | 'medium' | 'large'> = ['small', 'medium', 'large'];

    for (let i = 0; i < count; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const size = sizes[Math.floor(Math.random() * sizes.length)];
      const pop = type === 'terran' || type === 'ocean' 
        ? Math.floor(Math.random() * 5000000000) + 1000000000
        : Math.floor(Math.random() * 500000000);

      planets.push({
        name: `Planet ${i + 1}`,
        type,
        size,
        orbitIndex: i + 1,
        population: pop,
        maxPopulation: pop * 5,
        isHomeworld: false,
        facilities: this.generateRandomFacilities(Math.floor(Math.random() * 3))
      });
    }

    return planets;
  }

  private static generateRandomFacilities(count: number): { type: FacilityType; level: number }[] {
    const facilityTypes: FacilityType[] = ['factory', 'farm', 'mine', 'spaceport'];
    const facilities: { type: FacilityType; level: number }[] = [];
    
    for (let i = 0; i < count; i++) {
      facilities.push({
        type: facilityTypes[Math.floor(Math.random() * facilityTypes.length)],
        level: Math.floor(Math.random() * 4) + 1
      });
    }
    
    return facilities;
  }

  /**
   * Clear all map data for a session
   */
  public static async clearGalaxy(sessionId: string): Promise<void> {
    await GalaxyGrid.deleteMany({ sessionId });
    await StarSystem.deleteMany({ sessionId });
    await Planet.deleteMany({ sessionId });
    logger.info(`[MapSeedService] Cleared galaxy for session ${sessionId}`);
  }
}

