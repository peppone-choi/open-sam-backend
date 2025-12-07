/**
 * Ground Combat Routes - 지상전 API
 * 
 * Base path: /api/gin7/ground
 */

import { Router, Request, Response } from 'express';
import { groundCombatService } from '../../services/gin7/GroundCombatService';
import { GroundBattle, GroundUnitType, GROUND_UNIT_SPECS, COUNTER_MATRIX } from '../../models/gin7/GroundBattle';
import { logger } from '../../common/logger';

const router = Router();

// ============================================================
// Battle Management
// ============================================================

/**
 * POST /api/gin7/ground/start
 * 지상전 시작
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { sessionId, planetId, attackerFactionId, attackerFleetId } = req.body;
    
    if (!sessionId || !planetId || !attackerFactionId || !attackerFleetId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: sessionId, planetId, attackerFactionId, attackerFleetId'
      });
    }
    
    const battle = await groundCombatService.startBattle({
      sessionId,
      planetId,
      attackerFactionId,
      attackerFleetId
    });
    
    logger.info('[Ground Routes] Battle started', {
      battleId: battle.battleId,
      planetId
    });
    
    return res.status(201).json({
      success: true,
      data: {
        battleId: battle.battleId,
        status: battle.status,
        planetId: battle.planetId,
        attackerFactionId: battle.attackerFactionId,
        defenderFactionId: battle.defenderFactionId
      }
    });
  } catch (error: any) {
    logger.error('[Ground Routes] Start battle error', { error: error.message });
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/gin7/ground/:battleId
 * 전투 정보 조회
 */
router.get('/:battleId', async (req: Request, res: Response) => {
  try {
    const { battleId } = req.params;
    
    const battle = await groundCombatService.getBattle(battleId);
    if (!battle) {
      return res.status(404).json({
        success: false,
        error: 'Battle not found'
      });
    }
    
    return res.json({
      success: true,
      data: {
        battleId: battle.battleId,
        sessionId: battle.sessionId,
        planetId: battle.planetId,
        systemId: battle.systemId,
        status: battle.status,
        result: battle.result,
        
        attackerFactionId: battle.attackerFactionId,
        defenderFactionId: battle.defenderFactionId,
        
        attackerUnits: battle.attackerUnits.map(u => ({
          unitId: u.unitId,
          type: u.type,
          typeName: GROUND_UNIT_SPECS[u.type].nameKo,
          count: u.count,
          hp: u.stats.hp,
          maxHp: u.stats.maxHp,
          morale: u.stats.morale,
          isDestroyed: u.isDestroyed,
          isChaos: u.isChaos,
          isRetreating: u.isRetreating
        })),
        defenderUnits: battle.defenderUnits.map(u => ({
          unitId: u.unitId,
          type: u.type,
          typeName: GROUND_UNIT_SPECS[u.type].nameKo,
          count: u.count,
          hp: u.stats.hp,
          maxHp: u.stats.maxHp,
          morale: u.stats.morale,
          isDestroyed: u.isDestroyed,
          isChaos: u.isChaos,
          isRetreating: u.isRetreating
        })),
        
        attackerDropQueue: battle.attackerDropQueue.length,
        defenderDropQueue: battle.defenderDropQueue.length,
        
        conquestGauge: battle.conquestGauge,
        conquestRate: battle.conquestRate,
        currentTick: battle.currentTick,
        
        terrainModifier: battle.terrainModifier,
        orbitalStrike: {
          available: battle.orbitalStrike.available,
          onCooldown: battle.orbitalStrike.lastUsedTick !== undefined &&
            (battle.currentTick - battle.orbitalStrike.lastUsedTick) < battle.orbitalStrike.cooldownTicks,
          cooldownRemaining: battle.orbitalStrike.lastUsedTick !== undefined
            ? Math.max(0, battle.orbitalStrike.cooldownTicks - (battle.currentTick - battle.orbitalStrike.lastUsedTick))
            : 0
        },
        
        startedAt: battle.startedAt,
        endedAt: battle.endedAt
      }
    });
  } catch (error: any) {
    logger.error('[Ground Routes] Get battle error', { error: error.message });
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/gin7/ground/:battleId/log
 * 전투 로그 조회
 */
router.get('/:battleId/log', async (req: Request, res: Response) => {
  try {
    const { battleId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    const battle = await groundCombatService.getBattle(battleId);
    if (!battle) {
      return res.status(404).json({
        success: false,
        error: 'Battle not found'
      });
    }
    
    const logs = battle.combatLog
      .slice(-Number(limit) - Number(offset), battle.combatLog.length - Number(offset))
      .reverse();
    
    return res.json({
      success: true,
      data: {
        logs,
        total: battle.combatLog.length
      }
    });
  } catch (error: any) {
    logger.error('[Ground Routes] Get battle log error', { error: error.message });
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/gin7/ground/planet/:planetId
 * 행성의 활성 전투 조회
 */
router.get('/planet/:planetId', async (req: Request, res: Response) => {
  try {
    const { planetId } = req.params;
    const { sessionId } = req.query;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'sessionId query parameter required'
      });
    }
    
    const battle = await groundCombatService.getActiveBattleOnPlanet(
      sessionId as string,
      planetId
    );
    
    if (!battle) {
      return res.json({
        success: true,
        data: null
      });
    }
    
    return res.json({
      success: true,
      data: {
        battleId: battle.battleId,
        status: battle.status,
        attackerFactionId: battle.attackerFactionId,
        defenderFactionId: battle.defenderFactionId,
        conquestGauge: battle.conquestGauge
      }
    });
  } catch (error: any) {
    logger.error('[Ground Routes] Get planet battle error', { error: error.message });
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/gin7/ground/faction/:factionId
 * 팩션의 모든 전투 조회
 */
router.get('/faction/:factionId', async (req: Request, res: Response) => {
  try {
    const { factionId } = req.params;
    const { sessionId } = req.query;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'sessionId query parameter required'
      });
    }
    
    const battles = await groundCombatService.getFactionBattles(
      sessionId as string,
      factionId
    );
    
    return res.json({
      success: true,
      data: battles.map(b => ({
        battleId: b.battleId,
        planetId: b.planetId,
        status: b.status,
        result: b.result,
        isAttacker: b.attackerFactionId === factionId,
        conquestGauge: b.conquestGauge,
        startedAt: b.startedAt,
        endedAt: b.endedAt
      }))
    });
  } catch (error: any) {
    logger.error('[Ground Routes] Get faction battles error', { error: error.message });
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================
// Deployment (강하/철수)
// ============================================================

/**
 * POST /api/gin7/ground/drop
 * 유닛 강하
 */
router.post('/drop', async (req: Request, res: Response) => {
  try {
    const { battleId, fleetId, unitType, count } = req.body;
    
    if (!battleId || !fleetId || !unitType || !count) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: battleId, fleetId, unitType, count'
      });
    }
    
    // 유닛 타입 검증
    if (!['armored', 'grenadier', 'infantry'].includes(unitType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid unitType. Must be one of: armored, grenadier, infantry'
      });
    }
    
    const dropItem = await groundCombatService.dropUnits({
      battleId,
      fleetId,
      unitType: unitType as GroundUnitType,
      count: Number(count)
    });
    
    logger.info('[Ground Routes] Units dropping', {
      battleId,
      unitId: dropItem.unitId,
      unitType,
      count: dropItem.count
    });
    
    return res.status(201).json({
      success: true,
      data: {
        unitId: dropItem.unitId,
        unitType: dropItem.unitType,
        unitTypeName: GROUND_UNIT_SPECS[dropItem.unitType].nameKo,
        count: dropItem.count,
        expectedDropAt: dropItem.expectedDropAt
      }
    });
  } catch (error: any) {
    logger.error('[Ground Routes] Drop units error', { error: error.message });
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/gin7/ground/withdraw
 * 유닛 철수
 */
router.post('/withdraw', async (req: Request, res: Response) => {
  try {
    const { battleId, unitId } = req.body;
    
    if (!battleId || !unitId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: battleId, unitId'
      });
    }
    
    await groundCombatService.withdrawUnit({ battleId, unitId });
    
    logger.info('[Ground Routes] Unit withdrawing', {
      battleId,
      unitId
    });
    
    return res.json({
      success: true,
      message: 'Unit withdrawal initiated'
    });
  } catch (error: any) {
    logger.error('[Ground Routes] Withdraw unit error', { error: error.message });
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================
// Orbital Strike
// ============================================================

/**
 * POST /api/gin7/ground/orbital-strike
 * 궤도 폭격 요청
 */
router.post('/orbital-strike', async (req: Request, res: Response) => {
  try {
    const { battleId, targetSide, requestingFactionId } = req.body;
    
    if (!battleId || !targetSide || !requestingFactionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: battleId, targetSide, requestingFactionId'
      });
    }
    
    if (!['attacker', 'defender'].includes(targetSide)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid targetSide. Must be one of: attacker, defender'
      });
    }
    
    const result = await groundCombatService.requestOrbitalStrike({
      battleId,
      targetSide: targetSide as 'attacker' | 'defender',
      requestingFactionId
    });
    
    logger.info('[Ground Routes] Orbital strike executed', {
      battleId,
      success: result.success,
      damage: result.damage,
      friendlyFire: result.friendlyFire
    });
    
    return res.json({
      success: true,
      data: {
        executed: result.success,
        damage: result.damage,
        friendlyFire: result.friendlyFire,
        message: result.friendlyFire 
          ? '⚠️ 궤도 폭격 오폭! 아군에게 피해 발생!'
          : `🔥 궤도 폭격 성공! ${result.damage} 데미지`
      }
    });
  } catch (error: any) {
    logger.error('[Ground Routes] Orbital strike error', { error: error.message });
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================
// Static Data
// ============================================================

/**
 * GET /api/gin7/ground/units/specs
 * 유닛 스펙 조회
 */
router.get('/units/specs', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    data: {
      units: Object.entries(GROUND_UNIT_SPECS).map(([type, spec]) => ({
        type,
        ...spec
      })),
      counterMatrix: COUNTER_MATRIX
    }
  });
});

export default router;

