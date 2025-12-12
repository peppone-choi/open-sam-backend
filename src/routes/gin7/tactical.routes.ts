/**
 * GIN7 Tactical Combat Routes
 * 
 * REST API for managing tactical combat sessions
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getSocketManager } from '../../socket/socketManager';
import { tacticalSessionManager } from '../../services/gin7/TacticalSession';
import { fleetFormationService } from '../../services/gin7/FleetFormationService';
import { Fleet } from '../../models/gin7/Fleet';
import { FORMATION_DEFINITIONS, FormationType } from '../../types/gin7/formation.types';
import { logger } from '../../common/logger';

const router = Router();

/**
 * @swagger
 * /api/gin7/tactical/battles:
 *   post:
 *     summary: Create a new tactical battle
 *     tags: [GIN7 Tactical]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *               - gridId
 *               - participants
 *             properties:
 *               sessionId:
 *                 type: string
 *                 description: Game session ID
 *               gridId:
 *                 type: string
 *                 description: Galaxy grid ID where battle occurs
 *               participants:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     factionId:
 *                       type: string
 *                     fleetIds:
 *                       type: array
 *                       items:
 *                         type: string
 *                     commanderIds:
 *                       type: array
 *                       items:
 *                         type: string
 *     responses:
 *       201:
 *         description: Battle created
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.post('/battles', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId, gridId, participants } = req.body;

    // Validation
    if (!sessionId || !gridId || !participants || !Array.isArray(participants)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'sessionId, gridId, and participants array are required',
        },
      });
    }

    if (participants.length < 2) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'At least 2 participants are required',
        },
      });
    }

    // Validate fleets exist
    for (const p of participants) {
      if (!p.factionId || !p.fleetIds || !Array.isArray(p.fleetIds)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Each participant must have factionId and fleetIds',
          },
        });
      }

      for (const fleetId of p.fleetIds) {
        const fleet = await Fleet.findOne({ sessionId, fleetId });
        if (!fleet) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'FLEET_NOT_FOUND',
              message: `Fleet ${fleetId} not found`,
            },
          });
        }
        if (fleet.status === 'COMBAT') {
          return res.status(400).json({
            success: false,
            error: {
              code: 'GIN7_E005',
              message: `Fleet ${fleetId} is already in combat`,
            },
          });
        }
      }
    }

    // Get tactical handler
    const socketManager = getSocketManager();
    const tacticalHandler = socketManager?.getTacticalHandler();

    if (!tacticalHandler) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'TACTICAL_DISABLED',
          message: 'Tactical combat system is not enabled',
        },
      });
    }

    // Create battle
    const session = await tacticalHandler.createBattle(sessionId, gridId, participants);

    // Update fleet statuses
    for (const p of participants) {
      for (const fleetId of p.fleetIds) {
        await Fleet.updateOne(
          { sessionId, fleetId },
          { 
            status: 'COMBAT',
            isLocked: true,
            lockedReason: `BATTLE:${session.getBattleId()}`,
          }
        );
      }
    }

    logger.info('[Tactical API] Battle created', {
      battleId: session.getBattleId(),
      sessionId,
      gridId,
      participantCount: participants.length,
    });

    res.status(201).json({
      success: true,
      data: {
        battleId: session.getBattleId(),
        status: session.getStatus(),
        participants: session.getParticipants(),
        units: session.getUnits().length,
      },
    });
  } catch (error) {
    logger.error('[Tactical API] Create battle error', { error });
    next(error);
  }
});

/**
 * @swagger
 * /api/gin7/tactical/battles/{battleId}:
 *   get:
 *     summary: Get battle status
 *     tags: [GIN7 Tactical]
 *     parameters:
 *       - in: path
 *         name: battleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Battle status
 *       404:
 *         description: Battle not found
 */
router.get('/battles/:battleId', async (req: Request, res: Response) => {
  const { battleId } = req.params;
  const session = tacticalSessionManager.getSession(battleId);

  if (!session) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'BATTLE_NOT_FOUND',
        message: `Battle ${battleId} not found`,
      },
    });
  }

  res.json({
    success: true,
    data: {
      battleId: session.getBattleId(),
      sessionId: session.sessionId,
      gridId: session.gridId,
      status: session.getStatus(),
      tick: session.getTick(),
      startTime: session.getStartTime(),
      participants: session.getParticipants(),
      unitCount: session.getUnits().length,
      result: session.getResult(),
    },
  });
});

/**
 * @swagger
 * /api/gin7/tactical/battles/{battleId}/snapshot:
 *   get:
 *     summary: Get full battle snapshot
 *     tags: [GIN7 Tactical]
 *     parameters:
 *       - in: path
 *         name: battleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Battle snapshot
 *       404:
 *         description: Battle not found
 */
router.get('/battles/:battleId/snapshot', async (req: Request, res: Response) => {
  const { battleId } = req.params;
  const session = tacticalSessionManager.getSession(battleId);

  if (!session) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'BATTLE_NOT_FOUND',
        message: `Battle ${battleId} not found`,
      },
    });
  }

  res.json({
    success: true,
    data: session.getSnapshot(),
  });
});

/**
 * @swagger
 * /api/gin7/tactical/sessions/{sessionId}/battles:
 *   get:
 *     summary: Get all battles for a game session
 *     tags: [GIN7 Tactical]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of battles
 */
router.get('/sessions/:sessionId/battles', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const sessions = tacticalSessionManager.getSessionsByGameSession(sessionId);

  res.json({
    success: true,
    data: sessions.map(s => ({
      battleId: s.getBattleId(),
      gridId: s.gridId,
      status: s.getStatus(),
      tick: s.getTick(),
      startTime: s.getStartTime(),
      participantCount: s.getParticipants().length,
      unitCount: s.getUnits().length,
    })),
  });
});

/**
 * @swagger
 * /api/gin7/tactical/stats:
 *   get:
 *     summary: Get tactical system stats
 *     tags: [GIN7 Tactical]
 *     responses:
 *       200:
 *         description: System stats
 */
router.get('/stats', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      activeBattles: tacticalSessionManager.getActiveSessionCount(),
      tickIntervalMs: 60,
      mapSize: { width: 10000, height: 10000, depth: 5000 },
    },
  });
});

// ============================================================
// Formation Management Routes
// ============================================================

/**
 * @swagger
 * /api/gin7/tactical/formations:
 *   get:
 *     summary: Get all available formation definitions
 *     tags: [GIN7 Formation]
 *     responses:
 *       200:
 *         description: List of formations with their stats
 */
router.get('/formations', async (_req: Request, res: Response) => {
  const formations = Object.values(FORMATION_DEFINITIONS).map(def => ({
    type: def.type,
    name: def.name,
    nameKo: def.nameKo,
    description: def.description,
    descriptionKo: def.descriptionKo,
    modifiers: def.modifiers,
    minShips: def.minShips,
    changeTime: def.changeTime,
    recommendedFor: def.recommendedFor,
  }));

  res.json({
    success: true,
    data: formations,
  });
});

/**
 * @swagger
 * /api/gin7/tactical/formations/{formationType}:
 *   get:
 *     summary: Get specific formation details
 *     tags: [GIN7 Formation]
 *     parameters:
 *       - in: path
 *         name: formationType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [STANDARD, SPINDLE, LINE, CIRCULAR, ECHELON, WEDGE, ENCIRCLE, RETREAT]
 *     responses:
 *       200:
 *         description: Formation details
 *       404:
 *         description: Formation not found
 */
router.get('/formations/:formationType', async (req: Request, res: Response) => {
  const { formationType } = req.params;
  const definition = FORMATION_DEFINITIONS[formationType as FormationType];

  if (!definition) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'FORMATION_NOT_FOUND',
        message: `Formation type '${formationType}' not found`,
      },
    });
  }

  res.json({
    success: true,
    data: definition,
  });
});

/**
 * @swagger
 * /api/gin7/tactical/battles/{battleId}/formation:
 *   get:
 *     summary: Get formation state for a fleet in battle
 *     tags: [GIN7 Formation]
 *     parameters:
 *       - in: path
 *         name: battleId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: fleetId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Formation state
 *       404:
 *         description: Battle or fleet not found
 */
router.get('/battles/:battleId/formation', async (req: Request, res: Response) => {
  const { battleId } = req.params;
  const { fleetId } = req.query;

  const session = tacticalSessionManager.getSession(battleId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'BATTLE_NOT_FOUND',
        message: `Battle ${battleId} not found`,
      },
    });
  }

  if (!fleetId || typeof fleetId !== 'string') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'fleetId query parameter is required',
      },
    });
  }

  const formationState = fleetFormationService.getFormationState(fleetId);
  if (!formationState) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'FORMATION_NOT_FOUND',
        message: `Formation state for fleet ${fleetId} not found`,
      },
    });
  }

  const modifiers = fleetFormationService.getFormationModifiers(fleetId);

  res.json({
    success: true,
    data: {
      fleetId,
      formationState,
      effectiveModifiers: modifiers,
    },
  });
});

/**
 * @swagger
 * /api/gin7/tactical/battles/{battleId}/formation/change:
 *   post:
 *     summary: Change fleet formation
 *     tags: [GIN7 Formation]
 *     parameters:
 *       - in: path
 *         name: battleId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fleetId
 *               - targetFormation
 *             properties:
 *               fleetId:
 *                 type: string
 *               targetFormation:
 *                 type: string
 *                 enum: [STANDARD, SPINDLE, LINE, CIRCULAR, ECHELON, WEDGE, ENCIRCLE, RETREAT]
 *               priority:
 *                 type: string
 *                 enum: [NORMAL, URGENT]
 *     responses:
 *       200:
 *         description: Formation change initiated
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Battle not found
 */
router.post('/battles/:battleId/formation/change', async (req: Request, res: Response) => {
  const { battleId } = req.params;
  const { fleetId, targetFormation, priority } = req.body;

  const session = tacticalSessionManager.getSession(battleId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'BATTLE_NOT_FOUND',
        message: `Battle ${battleId} not found`,
      },
    });
  }

  if (!fleetId || !targetFormation) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'fleetId and targetFormation are required',
      },
    });
  }

  // Validate formation type
  if (!FORMATION_DEFINITIONS[targetFormation as FormationType]) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_FORMATION',
        message: `Invalid formation type: ${targetFormation}`,
      },
    });
  }

  const result = fleetFormationService.startFormationChange({
    fleetId,
    targetFormation: targetFormation as FormationType,
    priority: priority as 'NORMAL' | 'URGENT',
  });

  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'FORMATION_CHANGE_FAILED',
        message: result.message,
      },
    });
  }

  logger.info('[Tactical API] Formation change initiated', {
    battleId,
    fleetId,
    targetFormation,
    priority,
    estimatedTime: result.estimatedTime,
  });

  res.json({
    success: true,
    data: {
      message: result.message,
      estimatedTime: result.estimatedTime,
      targetFormation,
    },
  });
});

/**
 * @swagger
 * /api/gin7/tactical/battles/{battleId}/maneuver:
 *   post:
 *     summary: Execute advanced maneuver (parallel move, turn 180, etc.)
 *     tags: [GIN7 Formation]
 *     parameters:
 *       - in: path
 *         name: battleId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - unitIds
 *               - maneuverType
 *             properties:
 *               unitIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               maneuverType:
 *                 type: string
 *                 enum: [PARALLEL_MOVE, TURN_180, TURN_90_LEFT, TURN_90_RIGHT, SPREAD, COMPRESS]
 *               direction:
 *                 type: object
 *                 properties:
 *                   x:
 *                     type: number
 *                   y:
 *                     type: number
 *                   z:
 *                     type: number
 *     responses:
 *       200:
 *         description: Maneuver initiated
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Battle not found
 */
router.post('/battles/:battleId/maneuver', async (req: Request, res: Response) => {
  const { battleId } = req.params;
  const { unitIds, maneuverType, direction } = req.body;

  const session = tacticalSessionManager.getSession(battleId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'BATTLE_NOT_FOUND',
        message: `Battle ${battleId} not found`,
      },
    });
  }

  if (!unitIds || !Array.isArray(unitIds) || unitIds.length === 0 || !maneuverType) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'unitIds (array) and maneuverType are required',
      },
    });
  }

  // Validate maneuver type
  const validManeuvers = ['PARALLEL_MOVE', 'TURN_180', 'TURN_90_LEFT', 'TURN_90_RIGHT', 'SPREAD', 'COMPRESS'];
  if (!validManeuvers.includes(maneuverType)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_MANEUVER',
        message: `Invalid maneuver type: ${maneuverType}. Valid types: ${validManeuvers.join(', ')}`,
      },
    });
  }

  // PARALLEL_MOVE requires direction
  if (maneuverType === 'PARALLEL_MOVE' && !direction) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'PARALLEL_MOVE requires direction parameter',
      },
    });
  }

  const result = fleetFormationService.executeManeuver({
    unitIds,
    type: maneuverType,
    params: direction ? { direction } : undefined,
  });

  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MANEUVER_FAILED',
        message: result.message,
      },
    });
  }

  logger.info('[Tactical API] Maneuver initiated', {
    battleId,
    maneuverType,
    unitCount: result.affectedUnits.length,
  });

  res.json({
    success: true,
    data: {
      message: result.message,
      affectedUnits: result.affectedUnits,
      maneuverType,
    },
  });
});

// ============================================================
// Demo Battle Routes (for testing)
// ============================================================

/**
 * @swagger
 * /api/gin7/tactical/demo/create:
 *   post:
 *     summary: Create a demo battle with mock fleets for testing
 *     tags: [GIN7 Tactical Demo]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sessionId:
 *                 type: string
 *                 default: demo-session
 *               empireShips:
 *                 type: number
 *                 default: 5000
 *               allianceShips:
 *                 type: number
 *                 default: 5000
 *     responses:
 *       201:
 *         description: Demo battle created with fleet IDs
 */
router.post('/demo/create', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      sessionId = 'demo-session', 
      empireShips = 5000, 
      allianceShips = 5000 
    } = req.body;

    // Create demo fleets
    const empireFleetId = `demo-empire-fleet-${Date.now()}`;
    const allianceFleetId = `demo-alliance-fleet-${Date.now()}`;

    // Empire Fleet (Galactic Empire)
    const empireFleet = new Fleet({
      fleetId: empireFleetId,
      sessionId,
      factionId: 'empire',
      name: '제1함대 (라인하르트)',
      commanderId: 'reinhard',
      ships: {
        battleship: Math.floor(empireShips * 0.3),
        cruiser: Math.floor(empireShips * 0.3),
        destroyer: Math.floor(empireShips * 0.3),
        carrier: Math.floor(empireShips * 0.05),
        flagship: 1,
        support: Math.floor(empireShips * 0.05),
      },
      totalShips: empireShips,
      hp: empireShips * 100,
      maxHp: empireShips * 100,
      morale: 90,
      supplies: 100,
      location: {
        gridId: 'demo-grid',
        x: -1500,
        y: 0,
        z: 0,
      },
      status: 'IDLE',
      formation: 'SPINDLE',
      experience: 80,
      veterancy: 0.3,
      realtimeCombat: {
        position: { x: -1500, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        heading: 0,
        angularVelocity: 0,
        speed: 0,
        maxSpeed: 50,
        acceleration: 5,
        turnRate: 0.1,
      },
    });
    await empireFleet.save();

    // Alliance Fleet (Free Planets Alliance)
    const allianceFleet = new Fleet({
      fleetId: allianceFleetId,
      sessionId,
      factionId: 'alliance',
      name: '제13함대 (양 웬리)',
      commanderId: 'yang-wenli',
      ships: {
        battleship: Math.floor(allianceShips * 0.25),
        cruiser: Math.floor(allianceShips * 0.35),
        destroyer: Math.floor(allianceShips * 0.25),
        carrier: Math.floor(allianceShips * 0.08),
        flagship: 1,
        support: Math.floor(allianceShips * 0.07),
      },
      totalShips: allianceShips,
      hp: allianceShips * 100,
      maxHp: allianceShips * 100,
      morale: 85,
      supplies: 100,
      location: {
        gridId: 'demo-grid',
        x: 1500,
        y: 0,
        z: 0,
      },
      status: 'IDLE',
      formation: 'STANDARD',
      experience: 75,
      veterancy: 0.25,
      realtimeCombat: {
        position: { x: 1500, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        heading: Math.PI,
        angularVelocity: 0,
        speed: 0,
        maxSpeed: 55,
        acceleration: 6,
        turnRate: 0.12,
      },
    });
    await allianceFleet.save();

    logger.info('[Tactical Demo] Demo fleets created', {
      sessionId,
      empireFleetId,
      allianceFleetId,
      empireShips,
      allianceShips,
    });

    res.status(201).json({
      success: true,
      data: {
        sessionId,
        fleets: [
          {
            fleetId: empireFleetId,
            name: empireFleet.name,
            faction: 'empire',
            ships: empireShips,
          },
          {
            fleetId: allianceFleetId,
            name: allianceFleet.name,
            faction: 'alliance',
            ships: allianceShips,
          },
        ],
        message: 'Demo fleets created. Use these fleet IDs to create a battle via WebSocket.',
      },
    });
  } catch (error) {
    logger.error('[Tactical Demo] Create demo fleets error', { error });
    next(error);
  }
});

/**
 * @swagger
 * /api/gin7/tactical/demo/cleanup:
 *   delete:
 *     summary: Clean up demo fleets and battles
 *     tags: [GIN7 Tactical Demo]
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         schema:
 *           type: string
 *           default: demo-session
 *     responses:
 *       200:
 *         description: Demo data cleaned up
 */
router.delete('/demo/cleanup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.query.sessionId as string || 'demo-session';

    // Delete demo fleets
    const result = await Fleet.deleteMany({
      sessionId,
      fleetId: { $regex: /^demo-/ },
    });

    logger.info('[Tactical Demo] Cleanup completed', {
      sessionId,
      deletedFleets: result.deletedCount,
    });

    res.json({
      success: true,
      data: {
        sessionId,
        deletedFleets: result.deletedCount,
        message: 'Demo data cleaned up',
      },
    });
  } catch (error) {
    logger.error('[Tactical Demo] Cleanup error', { error });
    next(error);
  }
});

export default router;

