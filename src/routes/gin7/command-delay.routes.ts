/**
 * GIN7 Command Delay Routes
 * 
 * 명령 지연 및 전자전 시스템 API
 * 
 * @module gin7-command-delay
 */

import { Router, Request, Response, NextFunction } from 'express';
import { commandDelayService, electronicWarfareService, tacticalSessionManager } from '../../services/gin7';
import { CommandPriority, TacticalCommand, TacticalCommandType } from '../../types/gin7/tactical.types';
import { logger } from '../../common/logger';

const router = Router();

// ============================================================
// Command Queue Routes
// ============================================================

/**
 * @swagger
 * /api/gin7/command-delay/queue:
 *   post:
 *     summary: Queue a tactical command with delay
 *     tags: [GIN7 Command Delay]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - battleId
 *               - commanderId
 *               - factionId
 *               - command
 *             properties:
 *               battleId:
 *                 type: string
 *               commanderId:
 *                 type: string
 *               factionId:
 *                 type: string
 *               command:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [MOVE, ATTACK, STOP, FORMATION, ENERGY_DISTRIBUTION, RETREAT, SURRENDER, REPAIR]
 *                   unitIds:
 *                     type: array
 *                     items:
 *                       type: string
 *                   data:
 *                     type: object
 *               priority:
 *                 type: string
 *                 enum: [LOW, NORMAL, HIGH, EMERGENCY]
 *               commanderDistance:
 *                 type: number
 *               commanderSkill:
 *                 type: number
 *     responses:
 *       200:
 *         description: Command queued successfully
 *       400:
 *         description: Invalid request
 *       409:
 *         description: Communication blackout - command rejected
 */
router.post('/queue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      battleId,
      commanderId,
      factionId,
      command,
      priority,
      commanderDistance,
      commanderSkill,
    } = req.body;

    // Validation
    if (!battleId || !commanderId || !factionId || !command) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'battleId, commanderId, factionId, and command are required',
        },
      });
    }

    // Validate battle exists
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

    // Validate command structure
    if (!command.type || !command.unitIds || !Array.isArray(command.unitIds)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_COMMAND',
          message: 'command must have type and unitIds array',
        },
      });
    }

    const currentTick = session.getTick();

    const result = commandDelayService.queueCommand({
      battleId,
      commanderId,
      factionId,
      command: command as TacticalCommand,
      priority: priority as CommandPriority,
      currentTick,
      commanderDistance,
      commanderSkill,
    });

    if (!result.success) {
      const statusCode = result.error === 'COMMUNICATION_BLACKOUT' ? 409 : 400;
      return res.status(statusCode).json({
        success: false,
        error: {
          code: result.error || 'QUEUE_FAILED',
          message: result.message,
        },
      });
    }

    logger.info('[Command Delay API] Command queued', {
      battleId,
      commandId: result.delayedCommand?.id,
      commandType: command.type,
    });

    res.json({
      success: true,
      data: {
        commandId: result.delayedCommand?.id,
        message: result.message,
        issueTime: result.delayedCommand?.issueTime,
        executeTime: result.delayedCommand?.executeTime,
        delayBreakdown: result.delayedCommand?.delayBreakdown,
        estimatedSeconds: Math.ceil((result.delayedCommand?.delayBreakdown.totalDelay || 0) / 16),
      },
    });
  } catch (error) {
    logger.error('[Command Delay API] Queue error', { error });
    next(error);
  }
});

/**
 * @swagger
 * /api/gin7/command-delay/queue/{battleId}:
 *   get:
 *     summary: Get command queue for a battle
 *     tags: [GIN7 Command Delay]
 *     parameters:
 *       - in: path
 *         name: battleId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: factionId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Command queue
 */
router.get('/queue/:battleId', async (req: Request, res: Response) => {
  const { battleId } = req.params;
  const { factionId } = req.query;

  const queue = commandDelayService.getQueue(battleId, factionId as string | undefined);
  const session = tacticalSessionManager.getSession(battleId);
  const currentTick = session?.getTick() || 0;

  const queueWithProgress = queue.map(cmd => ({
    id: cmd.id,
    commandType: cmd.command.type,
    unitIds: cmd.command.unitIds,
    priority: cmd.priority,
    status: cmd.status,
    issueTime: cmd.issueTime,
    executeTime: cmd.executeTime,
    remainingTicks: Math.max(0, cmd.executeTime - currentTick),
    remainingSeconds: Math.ceil(Math.max(0, cmd.executeTime - currentTick) / 16),
    progress: commandDelayService.getProgress(cmd.id, currentTick),
    delayBreakdown: cmd.delayBreakdown,
    cancellable: cmd.cancellable,
  }));

  res.json({
    success: true,
    data: {
      battleId,
      currentTick,
      commands: queueWithProgress,
      total: queue.length,
    },
  });
});

/**
 * @swagger
 * /api/gin7/command-delay/queue/{battleId}/summary:
 *   get:
 *     summary: Get command queue summary
 *     tags: [GIN7 Command Delay]
 *     parameters:
 *       - in: path
 *         name: battleId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: factionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Queue summary
 */
router.get('/queue/:battleId/summary', async (req: Request, res: Response) => {
  const { battleId } = req.params;
  const { factionId } = req.query;

  if (!factionId || typeof factionId !== 'string') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'factionId query parameter is required',
      },
    });
  }

  const summary = commandDelayService.getQueueSummary(battleId, factionId);

  res.json({
    success: true,
    data: summary,
  });
});

/**
 * @swagger
 * /api/gin7/command-delay/command/{commandId}:
 *   get:
 *     summary: Get specific command details
 *     tags: [GIN7 Command Delay]
 *     parameters:
 *       - in: path
 *         name: commandId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Command details
 *       404:
 *         description: Command not found
 */
router.get('/command/:commandId', async (req: Request, res: Response) => {
  const { commandId } = req.params;

  const command = commandDelayService.getCommand(commandId);
  if (!command) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'COMMAND_NOT_FOUND',
        message: `Command ${commandId} not found`,
      },
    });
  }

  const session = tacticalSessionManager.getSession(command.battleId);
  const currentTick = session?.getTick() || 0;

  res.json({
    success: true,
    data: {
      ...command,
      remainingTicks: commandDelayService.getRemainingDelay(commandId, currentTick),
      progress: commandDelayService.getProgress(commandId, currentTick),
    },
  });
});

/**
 * @swagger
 * /api/gin7/command-delay/command/{commandId}/cancel:
 *   post:
 *     summary: Cancel a queued command
 *     tags: [GIN7 Command Delay]
 *     parameters:
 *       - in: path
 *         name: commandId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Command cancelled
 *       400:
 *         description: Cannot cancel
 *       404:
 *         description: Command not found
 */
router.post('/command/:commandId/cancel', async (req: Request, res: Response) => {
  const { commandId } = req.params;

  const result = commandDelayService.cancelCommand(commandId);

  if (!result.success) {
    const command = commandDelayService.getCommand(commandId);
    const statusCode = command ? 400 : 404;
    return res.status(statusCode).json({
      success: false,
      error: {
        code: command ? 'CANNOT_CANCEL' : 'COMMAND_NOT_FOUND',
        message: result.message,
      },
    });
  }

  logger.info('[Command Delay API] Command cancelled', { commandId });

  res.json({
    success: true,
    data: {
      message: result.message,
      chaosProbability: result.chaosProbability,
    },
  });
});

// ============================================================
// Electronic Warfare Routes
// ============================================================

/**
 * @swagger
 * /api/gin7/command-delay/ew/state/{battleId}:
 *   get:
 *     summary: Get electronic warfare state for a battle
 *     tags: [GIN7 Electronic Warfare]
 *     parameters:
 *       - in: path
 *         name: battleId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: factionId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: EW state
 */
router.get('/ew/state/:battleId', async (req: Request, res: Response) => {
  const { battleId } = req.params;
  const { factionId } = req.query;

  if (factionId && typeof factionId === 'string') {
    const state = electronicWarfareService.getState(battleId, factionId);
    return res.json({
      success: true,
      data: state || {
        battleId,
        factionId,
        minovskyDensity: 0,
        jammingLevel: 'CLEAR',
        isUnderEWAttack: false,
      },
    });
  }

  const states = electronicWarfareService.getBattleStates(battleId);
  res.json({
    success: true,
    data: {
      battleId,
      states,
    },
  });
});

/**
 * @swagger
 * /api/gin7/command-delay/ew/attack:
 *   post:
 *     summary: Execute electronic warfare attack
 *     tags: [GIN7 Electronic Warfare]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - battleId
 *               - attackerFactionId
 *               - targetFactionId
 *               - intensity
 *             properties:
 *               battleId:
 *                 type: string
 *               attackerFactionId:
 *                 type: string
 *               targetFactionId:
 *                 type: string
 *               intensity:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *               duration:
 *                 type: number
 *     responses:
 *       200:
 *         description: EW attack executed
 *       400:
 *         description: Invalid request
 */
router.post('/ew/attack', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { battleId, attackerFactionId, targetFactionId, intensity, duration = 300 } = req.body;

    if (!battleId || !attackerFactionId || !targetFactionId || intensity === undefined) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'battleId, attackerFactionId, targetFactionId, and intensity are required',
        },
      });
    }

    if (intensity < 0 || intensity > 100) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INTENSITY',
          message: 'intensity must be between 0 and 100',
        },
      });
    }

    const result = electronicWarfareService.executeEWAttack({
      battleId,
      attackerFactionId,
      targetFactionId,
      intensity,
      duration,
    });

    logger.info('[Command Delay API] EW attack executed', {
      battleId,
      attacker: attackerFactionId,
      target: targetFactionId,
      intensity,
    });

    const targetState = electronicWarfareService.getState(battleId, targetFactionId);

    res.json({
      success: true,
      data: {
        message: result.message,
        targetState,
      },
    });
  } catch (error) {
    logger.error('[Command Delay API] EW attack error', { error });
    next(error);
  }
});

/**
 * @swagger
 * /api/gin7/command-delay/ew/minovsky:
 *   post:
 *     summary: Spread Minovsky particles
 *     tags: [GIN7 Electronic Warfare]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - battleId
 *               - factionId
 *               - intensity
 *             properties:
 *               battleId:
 *                 type: string
 *               factionId:
 *                 type: string
 *               intensity:
 *                 type: number
 *               duration:
 *                 type: number
 *               area:
 *                 type: string
 *                 enum: [LOCAL, GLOBAL]
 *     responses:
 *       200:
 *         description: Minovsky spread executed
 */
router.post('/ew/minovsky', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { battleId, factionId, intensity, duration = 300, area = 'LOCAL' } = req.body;

    if (!battleId || !factionId || intensity === undefined) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'battleId, factionId, and intensity are required',
        },
      });
    }

    const result = electronicWarfareService.spreadMinovskyParticles({
      battleId,
      factionId,
      intensity,
      duration,
      area,
    });

    logger.info('[Command Delay API] Minovsky spread', {
      battleId,
      factionId,
      intensity,
      area,
    });

    res.json({
      success: true,
      data: {
        message: result.message,
        states: electronicWarfareService.getBattleStates(battleId),
      },
    });
  } catch (error) {
    logger.error('[Command Delay API] Minovsky spread error', { error });
    next(error);
  }
});

/**
 * @swagger
 * /api/gin7/command-delay/ew/clear:
 *   post:
 *     summary: Clear jamming (countermeasure)
 *     tags: [GIN7 Electronic Warfare]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - battleId
 *               - factionId
 *             properties:
 *               battleId:
 *                 type: string
 *               factionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Jamming cleared
 */
router.post('/ew/clear', async (req: Request, res: Response) => {
  const { battleId, factionId } = req.body;

  if (!battleId || !factionId) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'battleId and factionId are required',
      },
    });
  }

  const result = electronicWarfareService.clearJamming(battleId, factionId);
  const state = electronicWarfareService.getState(battleId, factionId);

  res.json({
    success: true,
    data: {
      message: result.message,
      currentState: state,
    },
  });
});

export default router;













