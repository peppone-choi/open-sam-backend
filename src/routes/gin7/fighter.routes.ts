/**
 * Fighter Routes - 전투정(Fighter) API 라우트
 * 
 * 전투정 운용 관련 API 엔드포인트:
 * - 전투정 그룹 조회/초기화
 * - 사출(Launch) 및 귀환(Recovery)
 * - 공전(Dogfight) 및 대함 공격
 * - 보급 및 보충
 */

import { Router, Request, Response, NextFunction } from 'express';
import { FighterService } from '../../services/gin7/FighterService';
import { Fleet } from '../../models/gin7/Fleet';
import { FighterMission, FIGHTER_SPECS, FighterType } from '../../models/gin7/Fighter';
import { logger } from '../../common/logger';

const router = Router();

// ============================================================================
// 미들웨어
// ============================================================================

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    factionId: string;
    sessionId?: string;
  };
}

/**
 * 세션 ID 검증 미들웨어
 */
function validateSession(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const sessionId = req.params.sessionId || req.body.sessionId;
  if (!sessionId) {
    res.status(400).json({ success: false, message: '세션 ID가 필요합니다.' });
    return;
  }
  next();
}

// ============================================================================
// 조회 API
// ============================================================================

/**
 * GET /api/gin7/fighter/:sessionId/:fleetId
 * 함대의 전투정 현황 조회
 */
router.get('/:sessionId/:fleetId', validateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId, fleetId } = req.params;
    
    const status = await FighterService.getFleetFighterStatus(sessionId, fleetId);
    
    if (!status) {
      res.status(404).json({ 
        success: false, 
        message: '전투정 그룹을 찾을 수 없습니다.',
      });
      return;
    }
    
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error('[Fighter Routes] Error getting fighter status', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

/**
 * GET /api/gin7/fighter/:sessionId/:fleetId/specs
 * 전투정 스펙 정보 조회
 */
router.get('/:sessionId/:fleetId/specs', async (req: Request, res: Response) => {
  try {
    const specs = Object.values(FIGHTER_SPECS).map(spec => ({
      type: spec.type,
      name: spec.name,
      nameKo: spec.nameKo,
      faction: spec.faction,
      stats: {
        speed: spec.speed,
        maneuverability: spec.maneuverability,
        antiShip: spec.antiShip,
        antiAir: spec.antiAir,
        accuracy: spec.accuracy,
        hp: spec.hp,
        armor: spec.armor,
      },
      resources: {
        fuelCapacity: spec.fuelCapacity,
        ammoCapacity: spec.ammoCapacity,
      },
      pilotCount: spec.pilotCount,
    }));
    
    res.json({
      success: true,
      data: specs,
    });
  } catch (error) {
    logger.error('[Fighter Routes] Error getting fighter specs', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// ============================================================================
// 초기화 API
// ============================================================================

/**
 * POST /api/gin7/fighter/:sessionId/:fleetId/initialize
 * 함대에 전투정 그룹 초기화
 */
router.post('/:sessionId/:fleetId/initialize', validateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId, fleetId } = req.params;
    const { isEmpire } = req.body;
    
    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet) {
      res.status(404).json({ success: false, message: '함대를 찾을 수 없습니다.' });
      return;
    }
    
    const group = await FighterService.initializeFighterGroup(sessionId, fleet, isEmpire ?? false);
    
    res.json({
      success: true,
      message: '전투정 그룹이 초기화되었습니다.',
      data: {
        groupId: group.groupId,
        totalFighters: group.totalFighters,
        squadronCount: group.squadrons.length,
      },
    });
  } catch (error) {
    logger.error('[Fighter Routes] Error initializing fighter group', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// ============================================================================
// 사출/귀환 API
// ============================================================================

/**
 * POST /api/gin7/fighter/:sessionId/:fleetId/launch
 * 전투정 사출 (空戦 명령)
 * 단축키: w
 */
router.post('/:sessionId/:fleetId/launch', validateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId, fleetId } = req.params;
    const { squadronId, mission, targetId, count, currentTick } = req.body;
    
    if (!squadronId) {
      res.status(400).json({ success: false, message: '편대 ID가 필요합니다.' });
      return;
    }
    
    if (!mission) {
      res.status(400).json({ success: false, message: '임무 타입이 필요합니다.' });
      return;
    }
    
    const result = await FighterService.launchFighters({
      sessionId,
      fleetId,
      squadronId,
      mission: mission as FighterMission,
      targetId,
      count,
      currentTick: currentTick ?? Date.now(),
    });
    
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    
    logger.info('[Fighter Routes] Fighters launched', {
      sessionId,
      fleetId,
      squadronId,
      mission,
    });
    
    res.json(result);
  } catch (error) {
    logger.error('[Fighter Routes] Error launching fighters', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

/**
 * POST /api/gin7/fighter/:sessionId/:fleetId/recover
 * 전투정 귀환 명령
 */
router.post('/:sessionId/:fleetId/recover', validateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId, fleetId } = req.params;
    const { squadronId, currentTick } = req.body;
    
    if (!squadronId) {
      res.status(400).json({ success: false, message: '편대 ID가 필요합니다.' });
      return;
    }
    
    const result = await FighterService.recoverFighters({
      sessionId,
      fleetId,
      squadronId,
      currentTick: currentTick ?? Date.now(),
    });
    
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    
    logger.info('[Fighter Routes] Fighters recovering', {
      sessionId,
      fleetId,
      squadronId,
    });
    
    res.json(result);
  } catch (error) {
    logger.error('[Fighter Routes] Error recovering fighters', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// ============================================================================
// 전투 API
// ============================================================================

/**
 * POST /api/gin7/fighter/:sessionId/dogfight
 * 공전(Dogfight) 실행 - 전투정 vs 전투정
 */
router.post('/:sessionId/dogfight', validateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    const {
      attackerFleetId,
      attackerSquadronId,
      defenderFleetId,
      defenderSquadronId,
      currentTick,
    } = req.body;
    
    if (!attackerFleetId || !attackerSquadronId || !defenderFleetId || !defenderSquadronId) {
      res.status(400).json({ 
        success: false, 
        message: '공격측/방어측 함대 ID와 편대 ID가 필요합니다.' 
      });
      return;
    }
    
    const result = await FighterService.executeDogfight({
      sessionId,
      attackerFleetId,
      attackerSquadronId,
      defenderFleetId,
      defenderSquadronId,
      currentTick: currentTick ?? Date.now(),
    });
    
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    
    logger.info('[Fighter Routes] Dogfight executed', {
      sessionId,
      attackerFleetId,
      defenderFleetId,
      ...result.data,
    });
    
    res.json(result);
  } catch (error) {
    logger.error('[Fighter Routes] Error executing dogfight', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

/**
 * POST /api/gin7/fighter/:sessionId/anti-ship-attack
 * 대함 공격 실행
 */
router.post('/:sessionId/anti-ship-attack', validateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    const {
      attackerFleetId,
      squadronId,
      targetFleetId,
      targetUnitId,
      currentTick,
    } = req.body;
    
    if (!attackerFleetId || !squadronId || !targetFleetId || !targetUnitId) {
      res.status(400).json({ 
        success: false, 
        message: '공격 함대, 편대, 목표 함대, 목표 유닛 ID가 필요합니다.' 
      });
      return;
    }
    
    const result = await FighterService.executeAntiShipAttack({
      sessionId,
      attackerFleetId,
      squadronId,
      targetFleetId,
      targetUnitId,
      currentTick: currentTick ?? Date.now(),
    });
    
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    
    logger.info('[Fighter Routes] Anti-ship attack executed', {
      sessionId,
      attackerFleetId,
      targetFleetId,
      targetUnitId,
      ...result.data,
    });
    
    res.json(result);
  } catch (error) {
    logger.error('[Fighter Routes] Error executing anti-ship attack', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// ============================================================================
// 보급/보충 API
// ============================================================================

/**
 * POST /api/gin7/fighter/:sessionId/:fleetId/resupply
 * 전투정 보급 (연료/탄약)
 */
router.post('/:sessionId/:fleetId/resupply', validateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId, fleetId } = req.params;
    const { squadronId } = req.body;
    
    if (!squadronId) {
      res.status(400).json({ success: false, message: '편대 ID가 필요합니다.' });
      return;
    }
    
    const result = await FighterService.resupplySquadron(sessionId, fleetId, squadronId);
    
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    
    res.json(result);
  } catch (error) {
    logger.error('[Fighter Routes] Error resupplying fighters', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

/**
 * POST /api/gin7/fighter/:sessionId/:fleetId/reinforce
 * 전투정 보충 (신규 배치)
 */
router.post('/:sessionId/:fleetId/reinforce', validateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId, fleetId } = req.params;
    const { squadronId, count } = req.body;
    
    if (!squadronId || !count) {
      res.status(400).json({ success: false, message: '편대 ID와 보충 수량이 필요합니다.' });
      return;
    }
    
    const result = await FighterService.reinforceSquadron(sessionId, fleetId, squadronId, count);
    
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    
    res.json(result);
  } catch (error) {
    logger.error('[Fighter Routes] Error reinforcing fighters', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// ============================================================================
// 이벤트 처리 API (내부용)
// ============================================================================

/**
 * POST /api/gin7/fighter/:sessionId/:fleetId/mother-ship-destroyed
 * 모함 격추 시 전투정 손실 처리 (내부 API)
 */
router.post('/:sessionId/:fleetId/mother-ship-destroyed', validateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId, fleetId } = req.params;
    const { motherShipId } = req.body;
    
    if (!motherShipId) {
      res.status(400).json({ success: false, message: '모함 ID가 필요합니다.' });
      return;
    }
    
    await FighterService.handleMotherShipDestroyed(sessionId, fleetId, motherShipId);
    
    logger.warn('[Fighter Routes] Mother ship destroyed, fighters affected', {
      sessionId,
      fleetId,
      motherShipId,
    });
    
    res.json({
      success: true,
      message: '모함 격추 처리가 완료되었습니다.',
    });
  } catch (error) {
    logger.error('[Fighter Routes] Error handling mother ship destruction', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

export default router;








