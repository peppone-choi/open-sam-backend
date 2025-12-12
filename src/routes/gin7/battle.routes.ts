/**
 * GIN7 Battle Routes
 * 
 * REST API endpoints for MMO-Battle integration.
 * Handles battle initiation, grid queries, and battle status.
 */

import { Router } from 'express';
import { gridService } from '../../services/gin7/GridService';
import { battleInitiationService, IBattleInitiationRequest } from '../../services/gin7/battle/BattleInitiationService';
import { battleResultService } from '../../services/gin7/battle/BattleResultService';
import { RealtimeBattle } from '../../models/gin7/RealtimeBattle';
import { Fleet } from '../../models/gin7/Fleet';
import { GalaxyGrid } from '../../models/gin7/GalaxyGrid';

const router = Router();

/**
 * @swagger
 * /api/gin7/battle/grid/{x}/{y}:
 *   get:
 *     summary: Get grid state
 *     description: Get the current state of a grid cell including fleets, factions, and battle status
 *     tags: [GIN7 Battle]
 *     parameters:
 *       - in: path
 *         name: x
 *         required: true
 *         schema:
 *           type: integer
 *         description: Grid X coordinate (0-99)
 *       - in: path
 *         name: y
 *         required: true
 *         schema:
 *           type: integer
 *         description: Grid Y coordinate (0-99)
 *       - in: query
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Game session ID
 *     responses:
 *       200:
 *         description: Grid state
 *       404:
 *         description: Grid not found
 */
router.get('/grid/:x/:y', async (req, res) => {
  try {
    const sessionId = req.query.sessionId as string;
    const x = parseInt(req.params.x);
    const y = parseInt(req.params.y);

    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'sessionId required' });
    }

    if (isNaN(x) || isNaN(y) || x < 0 || x > 99 || y < 0 || y > 99) {
      return res.status(400).json({ success: false, message: 'Invalid coordinates' });
    }

    const summary = await gridService.getGridSummary(sessionId, x, y);
    if (!summary) {
      return res.status(404).json({ success: false, message: 'Grid not found' });
    }

    res.json({ success: true, grid: summary });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/gin7/battle/grid/{x}/{y}/fleets:
 *   get:
 *     summary: Get fleets in grid
 *     description: Get all fleets currently in a grid
 *     tags: [GIN7 Battle]
 *     parameters:
 *       - in: path
 *         name: x
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: y
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: factionId
 *         schema:
 *           type: string
 *         description: Optional filter by faction
 *     responses:
 *       200:
 *         description: List of fleets
 */
router.get('/grid/:x/:y/fleets', async (req, res) => {
  try {
    const sessionId = req.query.sessionId as string;
    const factionId = req.query.factionId as string | undefined;
    const x = parseInt(req.params.x);
    const y = parseInt(req.params.y);

    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'sessionId required' });
    }

    let fleets;
    if (factionId) {
      fleets = await gridService.getFleetsByFaction(sessionId, x, y, factionId);
    } else {
      fleets = await gridService.getFleetsInGrid(sessionId, x, y);
    }

    res.json({ 
      success: true, 
      fleets: fleets.map(f => ({
        fleetId: f.fleetId,
        name: f.name,
        factionId: f.factionId,
        commanderId: f.commanderId,
        status: f.status,
        totalShips: f.totalShips,
        unitCount: f.units.reduce((sum, u) => sum + Math.ceil(u.count / 300), 0)
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/gin7/battle/can-initiate:
 *   post:
 *     summary: Check if battle can be initiated
 *     description: Check if a battle can be initiated in a grid
 *     tags: [GIN7 Battle]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *               - gridX
 *               - gridY
 *               - initiatorFleetId
 *             properties:
 *               sessionId:
 *                 type: string
 *               gridX:
 *                 type: integer
 *               gridY:
 *                 type: integer
 *               initiatorFleetId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Can initiate check result
 */
router.post('/can-initiate', async (req, res) => {
  try {
    const { sessionId, gridX, gridY, initiatorFleetId } = req.body;

    if (!sessionId || gridX === undefined || gridY === undefined || !initiatorFleetId) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const result = await battleInitiationService.canInitiateBattle(
      sessionId, gridX, gridY, initiatorFleetId
    );

    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/gin7/battle/eligible-fleets:
 *   post:
 *     summary: Get eligible fleets for battle
 *     description: Get all fleets that can participate in a battle
 *     tags: [GIN7 Battle]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *               - gridX
 *               - gridY
 *             properties:
 *               sessionId:
 *                 type: string
 *               gridX:
 *                 type: integer
 *               gridY:
 *                 type: integer
 *               factionId:
 *                 type: string
 *                 description: Optional filter by faction
 *     responses:
 *       200:
 *         description: List of eligible fleets
 */
router.post('/eligible-fleets', async (req, res) => {
  try {
    const { sessionId, gridX, gridY, factionId } = req.body;

    if (!sessionId || gridX === undefined || gridY === undefined) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const eligibleFleets = await battleInitiationService.getEligibleFleets(
      sessionId, gridX, gridY, factionId
    );

    res.json({ 
      success: true, 
      fleets: eligibleFleets.map(ef => ({
        fleetId: ef.fleetId,
        eligible: ef.eligible,
        reason: ef.reason,
        isOnline: ef.isOnline,
        name: ef.fleet?.name,
        factionId: ef.fleet?.factionId,
        commanderId: ef.fleet?.commanderId,
        commanderName: ef.commander?.name
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/gin7/battle/initiate:
 *   post:
 *     summary: Initiate a battle
 *     description: Start a realtime battle from MMO world
 *     tags: [GIN7 Battle]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *               - gridX
 *               - gridY
 *               - initiatorFleetId
 *             properties:
 *               sessionId:
 *                 type: string
 *               gridX:
 *                 type: integer
 *               gridY:
 *                 type: integer
 *               initiatorFleetId:
 *                 type: string
 *               targetFactionId:
 *                 type: string
 *                 description: Optional specific faction to attack
 *               reason:
 *                 type: string
 *                 description: Reason for battle initiation
 *     responses:
 *       200:
 *         description: Battle initiated
 *       400:
 *         description: Cannot initiate battle
 */
router.post('/initiate', async (req, res) => {
  try {
    const request: IBattleInitiationRequest = {
      sessionId: req.body.sessionId,
      gridX: req.body.gridX,
      gridY: req.body.gridY,
      initiatorFleetId: req.body.initiatorFleetId,
      targetFactionId: req.body.targetFactionId,
      reason: req.body.reason
    };

    if (!request.sessionId || request.gridX === undefined || 
        request.gridY === undefined || !request.initiatorFleetId) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const result = await battleInitiationService.initiateBattle(request);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      battleId: result.battleId,
      participants: result.participants?.map(p => ({
        fleetId: p.fleetId,
        faction: p.faction,
        isPlayerControlled: p.isPlayerControlled
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/gin7/battle/{battleId}:
 *   get:
 *     summary: Get battle state
 *     description: Get the current state of a realtime battle
 *     tags: [GIN7 Battle]
 *     parameters:
 *       - in: path
 *         name: battleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Battle state
 *       404:
 *         description: Battle not found
 */
router.get('/:battleId', async (req, res) => {
  try {
    const battle = await RealtimeBattle.findOne({ battleId: req.params.battleId });
    
    if (!battle) {
      return res.status(404).json({ success: false, message: 'Battle not found' });
    }

    res.json({
      success: true,
      battle: {
        battleId: battle.battleId,
        sessionId: battle.sessionId,
        status: battle.status,
        gridLocation: battle.gridLocation,
        factions: battle.factions,
        participants: battle.participants.map(p => ({
          fleetId: p.fleetId,
          faction: p.faction,
          isDefeated: p.isDefeated,
          isPlayerControlled: p.isPlayerControlled,
          shipCount: p.shipCount,
          shipsLost: p.shipsLost,
          damageDealt: p.damageDealt,
          damageTaken: p.damageTaken
        })),
        tickCount: battle.tickCount,
        maxTicks: battle.maxTicks,
        startedAt: battle.startedAt,
        endedAt: battle.endedAt,
        result: battle.result
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/gin7/battle/{battleId}/reinforce:
 *   post:
 *     summary: Add reinforcement to battle
 *     description: Add a fleet as reinforcement to an existing battle
 *     tags: [GIN7 Battle]
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
 *               - sessionId
 *               - fleetId
 *             properties:
 *               sessionId:
 *                 type: string
 *               fleetId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reinforcement added
 *       400:
 *         description: Cannot add reinforcement
 */
router.post('/:battleId/reinforce', async (req, res) => {
  try {
    const { sessionId, fleetId } = req.body;
    const { battleId } = req.params;

    if (!sessionId || !fleetId) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const result = await battleInitiationService.addReinforcement(sessionId, battleId, fleetId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/gin7/battle/pending:
 *   get:
 *     summary: Get grids with pending battles
 *     description: Get all grids that have hostile factions but no active battle
 *     tags: [GIN7 Battle]
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of grids with pending battles
 */
router.get('/pending', async (req, res) => {
  try {
    const sessionId = req.query.sessionId as string;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'sessionId required' });
    }

    const grids = await gridService.getGridsWithPendingBattles(sessionId);

    res.json({
      success: true,
      grids: grids.map(g => ({
        gridId: g.gridId,
        x: g.x,
        y: g.y,
        factions: g.ownerFactions,
        hostileFactions: g.hostileFactions,
        fleetCount: g.fleets?.length || 0
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/gin7/battle/active:
 *   get:
 *     summary: Get active battles
 *     description: Get all currently active battles in a session
 *     tags: [GIN7 Battle]
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of active battles
 */
router.get('/active', async (req, res) => {
  try {
    const sessionId = req.query.sessionId as string;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'sessionId required' });
    }

    const battles = await RealtimeBattle.find({
      sessionId,
      status: { $in: ['PREPARING', 'ACTIVE'] }
    });

    res.json({
      success: true,
      battles: battles.map(b => ({
        battleId: b.battleId,
        gridLocation: b.gridLocation,
        factions: b.factions,
        status: b.status,
        tickCount: b.tickCount,
        participantCount: b.participants.length,
        startedAt: b.startedAt
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/gin7/battle/fleet/{fleetId}/move:
 *   post:
 *     summary: Move fleet to grid
 *     description: Move a fleet to a new grid location
 *     tags: [GIN7 Battle]
 *     parameters:
 *       - in: path
 *         name: fleetId
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
 *               - sessionId
 *               - targetX
 *               - targetY
 *             properties:
 *               sessionId:
 *                 type: string
 *               targetX:
 *                 type: integer
 *               targetY:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Fleet moved
 *       400:
 *         description: Cannot move fleet
 */
router.post('/fleet/:fleetId/move', async (req, res) => {
  try {
    const { sessionId, targetX, targetY } = req.body;
    const { fleetId } = req.params;

    if (!sessionId || targetX === undefined || targetY === undefined) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const result = await gridService.moveFleetToGrid(sessionId, fleetId, targetX, targetY);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      fleet: result.fleet ? {
        fleetId: result.fleet.fleetId,
        gridId: result.fleet.gridId
      } : null,
      encounterDetected: result.encounterResult?.hasEncounter || false,
      encounter: result.encounterResult
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
