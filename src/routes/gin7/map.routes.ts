import { Router } from 'express';
import { autoExtractToken } from '../../middleware/auth';
import { GalaxyGrid, GRID_CONSTANTS } from '../../models/gin7/GalaxyGrid';
import { StarSystem } from '../../models/gin7/StarSystem';
import { Planet } from '../../models/gin7/Planet';
import { WarpTravel } from '../../models/gin7/WarpTravel';
import { getWarpNavigationService, WARP_CONSTANTS } from '../../services/gin7/WarpNavigationService';
import { getIntraSystemTravelService } from '../../services/gin7/IntraSystemTravelService';
import { MapSeedService } from '../../services/gin7/MapSeedService';

const router = Router();

// ==================== PUBLIC ENDPOINTS ====================

/**
 * GET /api/gin7/map/constants
 * Returns map constants (public endpoint)
 */
router.get('/constants', (_req, res) => {
  res.json({
    success: true,
    schemaVersion: '2025-12-02.gin7.map.constants.1',
    data: {
      grid: GRID_CONSTANTS,
      warp: WARP_CONSTANTS,
    },
  });
});

// ==================== AUTHENTICATED ENDPOINTS ====================
router.use(autoExtractToken);

/**
 * GET /api/gin7/map/grid/:x/:y
 * Get specific grid information
 */
router.get('/grid/:x/:y', async (req, res) => {
  try {
    const { sessionId } = await ensureSession(req);
    const x = parseInt(req.params.x, 10);
    const y = parseInt(req.params.y, 10);

    if (isNaN(x) || isNaN(y) || x < 0 || x >= 100 || y < 0 || y >= 100) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates. Must be 0-99.',
        errorCode: 'INVALID_COORDINATES'
      });
    }

    const grid = await GalaxyGrid.findOne({ sessionId, x, y });
    
    if (!grid) {
      // Return default grid info
      return res.json({
        success: true,
        schemaVersion: '2025-12-02.gin7.map.grid.1',
        data: {
          x,
          y,
          terrain: 'normal',
          occupants: [],
          ownerFactions: [],
          starSystems: [],
          explored: false,
        },
      });
    }

    // Fetch star systems in this grid
    const systems = await StarSystem.find({
      sessionId,
      systemId: { $in: grid.starSystemIds }
    }).select('systemId name isCapital isFortress controllingFactionId strategicValue');

    res.json({
      success: true,
      schemaVersion: '2025-12-02.gin7.map.grid.1',
      data: {
        x: grid.x,
        y: grid.y,
        terrain: grid.terrain,
        terrainModifiers: grid.terrainModifiers,
        occupants: grid.occupants,
        ownerFactions: grid.ownerFactions,
        starSystems: systems,
        name: grid.name,
        description: grid.description,
        explored: grid.exploredBy.length > 0,
      },
    });
  } catch (error: any) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/gin7/map/chunk
 * Get multiple grids at once (for efficient loading)
 * Query params: startX, startY, endX, endY (max 10x10 = 100 grids)
 */
router.get('/chunk', async (req, res) => {
  try {
    const { sessionId } = await ensureSession(req);
    
    const startX = parseInt(req.query.startX as string, 10) || 0;
    const startY = parseInt(req.query.startY as string, 10) || 0;
    const endX = parseInt(req.query.endX as string, 10) || startX + 9;
    const endY = parseInt(req.query.endY as string, 10) || startY + 9;

    // Validate bounds
    if (endX - startX > 10 || endY - startY > 10) {
      return res.status(400).json({
        success: false,
        message: 'Chunk size cannot exceed 10x10',
        errorCode: 'CHUNK_TOO_LARGE'
      });
    }

    const grids = await GalaxyGrid.find({
      sessionId,
      x: { $gte: startX, $lte: endX },
      y: { $gte: startY, $lte: endY }
    }).lean();

    // Collect all system IDs
    const systemIds = grids.flatMap(g => g.starSystemIds || []);
    const systems = await StarSystem.find({
      sessionId,
      systemId: { $in: systemIds }
    }).select('systemId name gridRef isCapital isFortress controllingFactionId').lean();

    // Create a map of grid key to grid data
    const gridMap: Record<string, any> = {};
    for (let x = startX; x <= endX && x < 100; x++) {
      for (let y = startY; y <= endY && y < 100; y++) {
        const key = `${x},${y}`;
        const grid = grids.find(g => g.x === x && g.y === y);
        gridMap[key] = grid || {
          x, y,
          terrain: 'normal',
          occupants: [],
          ownerFactions: [],
          starSystemIds: [],
        };
      }
    }

    res.json({
      success: true,
      schemaVersion: '2025-12-02.gin7.map.chunk.1',
      data: {
        bounds: { startX, startY, endX, endY },
        grids: gridMap,
        systems: systems.reduce((acc, s) => {
          acc[s.systemId] = s;
          return acc;
        }, {} as Record<string, any>),
      },
    });
  } catch (error: any) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/gin7/map/system/:systemId
 * Get star system details
 */
router.get('/system/:systemId', async (req, res) => {
  try {
    const { sessionId } = await ensureSession(req);
    const { systemId } = req.params;

    const system = await StarSystem.findOne({ sessionId, systemId });
    if (!system) {
      return res.status(404).json({
        success: false,
        message: 'Star system not found',
        errorCode: 'SYSTEM_NOT_FOUND'
      });
    }

    // Fetch planets
    const planets = await Planet.find({
      sessionId,
      systemId
    }).lean();

    res.json({
      success: true,
      schemaVersion: '2025-12-02.gin7.map.system.1',
      data: {
        system: {
          systemId: system.systemId,
          name: system.name,
          originalName: system.originalName,
          gridRef: system.gridRef,
          localPosition: system.localPosition,
          starType: system.starType,
          luminosity: system.luminosity,
          strategicValue: system.strategicValue,
          isCapital: system.isCapital,
          isFortress: system.isFortress,
          controllingFactionId: system.controllingFactionId,
          warpGateLevel: system.warpGateLevel,
          stations: system.stations,
          description: system.description,
        },
        planets: planets.map(p => ({
          planetId: p.planetId,
          name: p.name,
          type: p.type,
          size: p.size,
          orbitIndex: p.orbitIndex,
          ownerId: p.ownerId,
          population: p.population,
          maxPopulation: p.maxPopulation,
          morale: p.morale,
          loyalty: p.loyalty,
          facilities: p.facilities,
          defenseRating: p.defenseRating,
          isHomeworld: p.isHomeworld,
          hasWarpGate: p.hasWarpGate,
        })),
      },
    });
  } catch (error: any) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/gin7/map/planet/:planetId
 * Get planet details
 */
router.get('/planet/:planetId', async (req, res) => {
  try {
    const { sessionId } = await ensureSession(req);
    const { planetId } = req.params;

    const planet = await Planet.findOne({ sessionId, planetId });
    if (!planet) {
      return res.status(404).json({
        success: false,
        message: 'Planet not found',
        errorCode: 'PLANET_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      schemaVersion: '2025-12-02.gin7.map.planet.1',
      data: planet,
    });
  } catch (error: any) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==================== WARP NAVIGATION ====================

/**
 * POST /api/gin7/map/warp
 * Request warp travel
 */
router.post('/warp', async (req, res) => {
  try {
    const { sessionId, factionId, unitId } = await ensureSession(req);
    const { origin, destination, engineLevel } = req.body;

    if (!origin || !destination) {
      return res.status(400).json({
        success: false,
        message: 'Origin and destination are required',
        errorCode: 'MISSING_COORDINATES'
      });
    }

    const warpService = getWarpNavigationService();
    const result = await warpService.requestWarp({
      sessionId,
      unitId: unitId || req.body.unitId,
      factionId: factionId || req.body.factionId,
      origin,
      destination,
      engineLevel: engineLevel || 1,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error,
        errorCode: result.errorCode,
      });
    }

    res.json({
      success: true,
      schemaVersion: '2025-12-02.gin7.map.warp.1',
      data: {
        travelId: result.travelId,
        estimatedDuration: result.estimatedDuration,
      },
    });
  } catch (error: any) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/gin7/map/warp/:travelId
 * Get warp travel status
 */
router.get('/warp/:travelId', async (req, res) => {
  try {
    const { sessionId } = await ensureSession(req);
    const { travelId } = req.params;

    const warpService = getWarpNavigationService();
    const travel = await warpService.getWarpStatus(sessionId, travelId);

    if (!travel) {
      return res.status(404).json({
        success: false,
        message: 'Warp travel not found',
        errorCode: 'WARP_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      schemaVersion: '2025-12-02.gin7.map.warp.1',
      data: travel,
    });
  } catch (error: any) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * DELETE /api/gin7/map/warp/:travelId
 * Cancel warp travel
 */
router.delete('/warp/:travelId', async (req, res) => {
  try {
    const { sessionId } = await ensureSession(req);
    const { travelId } = req.params;

    const warpService = getWarpNavigationService();
    const result = await warpService.cancelWarp(sessionId, travelId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error,
      });
    }

    res.json({
      success: true,
      schemaVersion: '2025-12-02.gin7.map.warp.1',
      data: { cancelled: true },
    });
  } catch (error: any) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/gin7/map/warp/active
 * Get all active warps for session
 */
router.get('/warp/active', async (req, res) => {
  try {
    const { sessionId } = await ensureSession(req);

    const warpService = getWarpNavigationService();
    const activeWarps = await warpService.getActiveWarps(sessionId);

    res.json({
      success: true,
      schemaVersion: '2025-12-02.gin7.map.warp.1',
      data: activeWarps,
    });
  } catch (error: any) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/gin7/map/warp/calculate
 * Calculate warp time without initiating travel
 */
router.get('/warp/calculate', async (req, res) => {
  try {
    await ensureSession(req);
    
    const originX = parseInt(req.query.originX as string, 10);
    const originY = parseInt(req.query.originY as string, 10);
    const destX = parseInt(req.query.destX as string, 10);
    const destY = parseInt(req.query.destY as string, 10);
    const engineLevel = parseInt(req.query.engineLevel as string, 10) || 1;

    if (isNaN(originX) || isNaN(originY) || isNaN(destX) || isNaN(destY)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates',
        errorCode: 'INVALID_COORDINATES'
      });
    }

    const warpService = getWarpNavigationService();
    const distance = warpService.calculateDistance(originX, originY, destX, destY);
    const warpTime = warpService.calculateWarpTime(distance, engineLevel);
    const misjumpChance = WARP_CONSTANTS.MISJUMP_BASE_CHANCE + 
      (distance * WARP_CONSTANTS.MISJUMP_DISTANCE_FACTOR) - 
      (engineLevel * 0.01);

    res.json({
      success: true,
      schemaVersion: '2025-12-02.gin7.map.warp.1',
      data: {
        distance,
        chargeTime: WARP_CONSTANTS.BASE_CHARGE_TIME,
        warpTime,
        coolingTime: WARP_CONSTANTS.COOLING_TIME,
        totalTime: WARP_CONSTANTS.BASE_CHARGE_TIME + warpTime + WARP_CONSTANTS.COOLING_TIME,
        misjumpChance: Math.max(0, misjumpChance),
      },
    });
  } catch (error: any) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==================== INTRA-SYSTEM TRAVEL ====================

/**
 * POST /api/gin7/map/travel/orbit
 * Enter orbit around a planet
 */
router.post('/travel/orbit', async (req, res) => {
  try {
    const { sessionId, factionId, unitId } = await ensureSession(req);
    const { planetId, engineLevel } = req.body;

    if (!planetId) {
      return res.status(400).json({
        success: false,
        message: 'Planet ID is required',
        errorCode: 'MISSING_PLANET_ID'
      });
    }

    const travelService = getIntraSystemTravelService();
    const result = await travelService.enterOrbit(
      sessionId,
      unitId || req.body.unitId,
      factionId || req.body.factionId,
      planetId,
      engineLevel || 1
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error,
      });
    }

    res.json({
      success: true,
      schemaVersion: '2025-12-02.gin7.map.travel.1',
      data: { travelId: result.travelId },
    });
  } catch (error: any) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/gin7/map/travel/land
 * Land on a planet
 */
router.post('/travel/land', async (req, res) => {
  try {
    const { sessionId, factionId, unitId } = await ensureSession(req);
    const { planetId } = req.body;

    if (!planetId) {
      return res.status(400).json({
        success: false,
        message: 'Planet ID is required',
        errorCode: 'MISSING_PLANET_ID'
      });
    }

    const travelService = getIntraSystemTravelService();
    const result = await travelService.landOnPlanet(
      sessionId,
      unitId || req.body.unitId,
      factionId || req.body.factionId,
      planetId
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error,
      });
    }

    res.json({
      success: true,
      schemaVersion: '2025-12-02.gin7.map.travel.1',
      data: { travelId: result.travelId },
    });
  } catch (error: any) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/gin7/map/travel/takeoff
 * Take off from a planet
 */
router.post('/travel/takeoff', async (req, res) => {
  try {
    const { sessionId, factionId, unitId } = await ensureSession(req);
    const { planetId } = req.body;

    if (!planetId) {
      return res.status(400).json({
        success: false,
        message: 'Planet ID is required',
        errorCode: 'MISSING_PLANET_ID'
      });
    }

    const travelService = getIntraSystemTravelService();
    const result = await travelService.takeOff(
      sessionId,
      unitId || req.body.unitId,
      factionId || req.body.factionId,
      planetId
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error,
      });
    }

    res.json({
      success: true,
      schemaVersion: '2025-12-02.gin7.map.travel.1',
      data: { travelId: result.travelId },
    });
  } catch (error: any) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==================== SEARCH ====================

/**
 * GET /api/gin7/map/search/systems
 * Search star systems by name
 */
router.get('/search/systems', async (req, res) => {
  try {
    const { sessionId } = await ensureSession(req);
    const query = req.query.q as string;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 50);

    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters',
        errorCode: 'QUERY_TOO_SHORT'
      });
    }

    const systems = await StarSystem.find({
      sessionId,
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { originalName: { $regex: query, $options: 'i' } }
      ]
    })
    .select('systemId name originalName gridRef isCapital isFortress controllingFactionId')
    .limit(limit)
    .lean();

    res.json({
      success: true,
      schemaVersion: '2025-12-02.gin7.map.search.1',
      data: systems,
    });
  } catch (error: any) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/gin7/map/faction/:factionId/systems
 * Get all systems controlled by a faction
 */
router.get('/faction/:factionId/systems', async (req, res) => {
  try {
    const { sessionId } = await ensureSession(req);
    const { factionId } = req.params;

    const systems = await StarSystem.find({
      sessionId,
      controllingFactionId: factionId
    })
    .select('systemId name gridRef isCapital isFortress strategicValue warpGateLevel')
    .lean();

    res.json({
      success: true,
      schemaVersion: '2025-12-02.gin7.map.faction.1',
      data: systems,
    });
  } catch (error: any) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==================== ADMIN ENDPOINTS ====================

/**
 * POST /api/gin7/map/seed
 * Seed the galaxy (admin only)
 */
router.post('/seed', async (req, res) => {
  try {
    const { sessionId } = await ensureSession(req);
    // TODO: Add admin check

    const result = await MapSeedService.seedGalaxy(sessionId);

    res.json({
      success: true,
      schemaVersion: '2025-12-02.gin7.map.seed.1',
      data: result,
    });
  } catch (error: any) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * DELETE /api/gin7/map/seed
 * Clear the galaxy (admin only)
 */
router.delete('/seed', async (req, res) => {
  try {
    const { sessionId } = await ensureSession(req);
    // TODO: Add admin check

    await MapSeedService.clearGalaxy(sessionId);

    res.json({
      success: true,
      schemaVersion: '2025-12-02.gin7.map.seed.1',
      data: { cleared: true },
    });
  } catch (error: any) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==================== HELPER FUNCTIONS ====================

interface SessionContext {
  sessionId: string;
  userId?: string;
  factionId?: string;
  unitId?: string;
}

async function ensureSession(req: any): Promise<SessionContext> {
  const sessionId = (req.user?.sessionId || req.query?.sessionId || req.body?.sessionId) as string | undefined;
  
  if (!sessionId) {
    const error = new Error('세션 식별자가 필요합니다.');
    (error as any).status = 400;
    throw error;
  }

  return {
    sessionId,
    userId: req.user?.userId || req.user?.id,
    factionId: req.body?.factionId || req.query?.factionId,
    unitId: req.body?.unitId || req.query?.unitId,
  };
}

export default router;

