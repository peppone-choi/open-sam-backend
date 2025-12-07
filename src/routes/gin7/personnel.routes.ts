/**
 * GIN7 Personnel API Routes
 * 
 * 인사 시스템 관련 API 엔드포인트
 * - 계급 라더 조회
 * - 임명/해임
 * - 승진/강등
 * - 퇴역/사망/후계자
 * 
 * @see agents/gin7-agents/gin7-personnel/CHECKLIST.md
 */

import { Router, Request, Response } from 'express';
import { RankLadderService } from '../../services/gin7/RankLadderService';
import { PromotionService } from '../../services/gin7/PromotionService';
import { AppointmentService, PositionCode } from '../../services/gin7/AppointmentService';
import { StatsGrowthService } from '../../services/gin7/StatsGrowthService';
import { LifeCycleService, RetirementType, DeathType } from '../../services/gin7/LifeCycleService';
import { RankCode, getAllRanks, getRankDefinition } from '../../config/gin7/ranks';
import { logger } from '../../common/logger';

const router = Router();

// Service instances
const ladderService = RankLadderService.getInstance();
const promotionService = PromotionService.getInstance();
const appointmentService = AppointmentService.getInstance();
const growthService = StatsGrowthService.getInstance();
const lifeCycleService = LifeCycleService.getInstance();

// ============================================================================
// Rank Ladder APIs
// ============================================================================

/**
 * GET /api/gin7/rank/ladder/:rank
 * 계급별 라더 조회
 */
router.get('/rank/ladder/:rank', async (req: Request, res: Response) => {
  try {
    const { rank } = req.params;
    const { sessionId, factionId, start = '0', limit = '100' } = req.query;
    
    if (!sessionId || !factionId) {
      return res.status(400).json({ error: 'sessionId and factionId required' });
    }
    
    // 계급 유효성 검증
    const rankDef = getRankDefinition(rank as RankCode);
    if (!rankDef) {
      return res.status(400).json({ error: 'Invalid rank code' });
    }
    
    const ladder = await ladderService.getLadder(
      sessionId as string,
      factionId as string,
      rank as RankCode,
      parseInt(start as string),
      parseInt(start as string) + parseInt(limit as string) - 1
    );
    
    return res.json({
      rank,
      rankName: rankDef.name,
      entries: ladder,
      count: ladder.length,
    });
  } catch (error) {
    logger.error('[PersonnelAPI] Ladder query failed', { error });
    return res.status(500).json({ error: 'Failed to get ladder' });
  }
});

/**
 * GET /api/gin7/rank/position/:characterId
 * 캐릭터 순위 조회
 */
router.get('/rank/position/:characterId', async (req: Request, res: Response) => {
  try {
    const { characterId } = req.params;
    const { sessionId, factionId, rank } = req.query;
    
    if (!sessionId || !factionId || !rank) {
      return res.status(400).json({ error: 'sessionId, factionId, and rank required' });
    }
    
    const position = await ladderService.getPosition(
      sessionId as string,
      factionId as string,
      characterId,
      rank as RankCode
    );
    
    return res.json({ characterId, rank, position });
  } catch (error) {
    logger.error('[PersonnelAPI] Position query failed', { error });
    return res.status(500).json({ error: 'Failed to get position' });
  }
});

/**
 * GET /api/gin7/rank/all
 * 전체 계급 정보 조회
 */
router.get('/rank/all', async (req: Request, res: Response) => {
  try {
    const ranks = getAllRanks();
    return res.json({ ranks });
  } catch (error) {
    logger.error('[PersonnelAPI] Rank list failed', { error });
    return res.status(500).json({ error: 'Failed to get ranks' });
  }
});

/**
 * GET /api/gin7/rank/counts
 * 계급별 인원수 조회
 */
router.get('/rank/counts', async (req: Request, res: Response) => {
  try {
    const { sessionId, factionId } = req.query;
    
    if (!sessionId || !factionId) {
      return res.status(400).json({ error: 'sessionId and factionId required' });
    }
    
    const counts = await ladderService.getRankCounts(
      sessionId as string,
      factionId as string
    );
    
    return res.json({ 
      counts: Object.fromEntries(counts),
    });
  } catch (error) {
    logger.error('[PersonnelAPI] Rank counts failed', { error });
    return res.status(500).json({ error: 'Failed to get counts' });
  }
});

// ============================================================================
// Promotion APIs
// ============================================================================

/**
 * POST /api/gin7/personnel/promote
 * 수동 승진
 */
router.post('/personnel/promote', async (req: Request, res: Response) => {
  try {
    const { sessionId, appointerId, targetId, targetRank } = req.body;
    
    if (!sessionId || !appointerId || !targetId || !targetRank) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await promotionService.manualPromotion(
      sessionId,
      appointerId,
      targetId,
      targetRank as RankCode
    );
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    return res.json(result);
  } catch (error) {
    logger.error('[PersonnelAPI] Promotion failed', { error });
    return res.status(500).json({ error: 'Promotion failed' });
  }
});

/**
 * POST /api/gin7/personnel/demote
 * 강등
 */
router.post('/personnel/demote', async (req: Request, res: Response) => {
  try {
    const { sessionId, appointerId, targetId, reason } = req.body;
    
    if (!sessionId || !appointerId || !targetId || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await promotionService.demote(
      sessionId,
      appointerId,
      targetId,
      reason
    );
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    return res.json(result);
  } catch (error) {
    logger.error('[PersonnelAPI] Demotion failed', { error });
    return res.status(500).json({ error: 'Demotion failed' });
  }
});

// ============================================================================
// Appointment APIs
// ============================================================================

/**
 * POST /api/gin7/personnel/appoint
 * 직위 임명
 */
router.post('/personnel/appoint', async (req: Request, res: Response) => {
  try {
    const { sessionId, appointerId, targetId, positionCode, scopeId } = req.body;
    
    if (!sessionId || !appointerId || !targetId || !positionCode) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await appointmentService.appoint(
      sessionId,
      appointerId,
      targetId,
      positionCode as PositionCode,
      scopeId
    );
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    return res.json(result);
  } catch (error) {
    logger.error('[PersonnelAPI] Appointment failed', { error });
    return res.status(500).json({ error: 'Appointment failed' });
  }
});

/**
 * POST /api/gin7/personnel/dismiss
 * 직위 해임
 */
router.post('/personnel/dismiss', async (req: Request, res: Response) => {
  try {
    const { sessionId, appointerId, targetId, reason } = req.body;
    
    if (!sessionId || !appointerId || !targetId || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await appointmentService.dismiss(
      sessionId,
      appointerId,
      targetId,
      reason
    );
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    return res.json(result);
  } catch (error) {
    logger.error('[PersonnelAPI] Dismissal failed', { error });
    return res.status(500).json({ error: 'Dismissal failed' });
  }
});

/**
 * GET /api/gin7/personnel/positions
 * 세력 직위 현황 조회
 */
router.get('/personnel/positions', async (req: Request, res: Response) => {
  try {
    const { sessionId, factionId } = req.query;
    
    if (!sessionId || !factionId) {
      return res.status(400).json({ error: 'sessionId and factionId required' });
    }
    
    const positions = await appointmentService.getFactionPositions(
      sessionId as string,
      factionId as string
    );
    
    return res.json({ positions });
  } catch (error) {
    logger.error('[PersonnelAPI] Positions query failed', { error });
    return res.status(500).json({ error: 'Failed to get positions' });
  }
});

/**
 * GET /api/gin7/personnel/appointable
 * 임명 가능 직위 목록
 */
router.get('/personnel/appointable', async (req: Request, res: Response) => {
  try {
    const { sessionId, appointerId } = req.query;
    
    if (!sessionId || !appointerId) {
      return res.status(400).json({ error: 'sessionId and appointerId required' });
    }
    
    const positions = await appointmentService.getAppointablePositions(
      sessionId as string,
      appointerId as string
    );
    
    return res.json({ positions });
  } catch (error) {
    logger.error('[PersonnelAPI] Appointable positions query failed', { error });
    return res.status(500).json({ error: 'Failed to get appointable positions' });
  }
});

// ============================================================================
// Stats Growth APIs
// ============================================================================

/**
 * GET /api/gin7/personnel/growth/:characterId
 * 캐릭터 성장 정보 조회
 */
router.get('/personnel/growth/:characterId', async (req: Request, res: Response) => {
  try {
    const { characterId } = req.params;
    const { sessionId } = req.query;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId required' });
    }
    
    const growthInfo = await growthService.getCharacterGrowthInfo(
      sessionId as string,
      characterId
    );
    
    return res.json(growthInfo);
  } catch (error) {
    logger.error('[PersonnelAPI] Growth info query failed', { error });
    return res.status(500).json({ error: 'Failed to get growth info' });
  }
});

/**
 * POST /api/gin7/personnel/merit
 * 공적치 추가
 */
router.post('/personnel/merit', async (req: Request, res: Response) => {
  try {
    const { sessionId, characterId, amount } = req.body;
    
    if (!sessionId || !characterId || amount === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await ladderService.addMerit(sessionId, characterId, amount);
    
    return res.json(result);
  } catch (error) {
    logger.error('[PersonnelAPI] Merit add failed', { error });
    return res.status(500).json({ error: 'Failed to add merit' });
  }
});

// ============================================================================
// Life Cycle APIs
// ============================================================================

/**
 * POST /api/gin7/personnel/retire
 * 퇴역 신청
 */
router.post('/personnel/retire', async (req: Request, res: Response) => {
  try {
    const { sessionId, characterId, reason } = req.body;
    
    if (!sessionId || !characterId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await lifeCycleService.requestRetirement(
      sessionId,
      characterId,
      reason
    );
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    return res.json(result);
  } catch (error) {
    logger.error('[PersonnelAPI] Retirement failed', { error });
    return res.status(500).json({ error: 'Retirement failed' });
  }
});

/**
 * GET /api/gin7/personnel/life/:characterId
 * 캐릭터 생애 정보 조회
 */
router.get('/personnel/life/:characterId', async (req: Request, res: Response) => {
  try {
    const { characterId } = req.params;
    const { sessionId } = req.query;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId required' });
    }
    
    const lifeInfo = await lifeCycleService.getLifeInfo(
      sessionId as string,
      characterId
    );
    
    if (!lifeInfo) {
      return res.status(404).json({ error: 'Character not found' });
    }
    
    return res.json(lifeInfo);
  } catch (error) {
    logger.error('[PersonnelAPI] Life info query failed', { error });
    return res.status(500).json({ error: 'Failed to get life info' });
  }
});

/**
 * GET /api/gin7/personnel/inheritances
 * 상속 대기 중인 캐릭터 조회
 */
router.get('/personnel/inheritances', async (req: Request, res: Response) => {
  try {
    const { sessionId, ownerId } = req.query;
    
    if (!sessionId || !ownerId) {
      return res.status(400).json({ error: 'sessionId and ownerId required' });
    }
    
    const inheritances = await lifeCycleService.getPendingInheritances(
      sessionId as string,
      ownerId as string
    );
    
    return res.json({ inheritances });
  } catch (error) {
    logger.error('[PersonnelAPI] Inheritances query failed', { error });
    return res.status(500).json({ error: 'Failed to get inheritances' });
  }
});

/**
 * POST /api/gin7/personnel/successor
 * 후계자 생성
 */
router.post('/personnel/successor', async (req: Request, res: Response) => {
  try {
    const { sessionId, deceasedCharacterId, successorName, ownerId } = req.body;
    
    if (!sessionId || !deceasedCharacterId || !successorName || !ownerId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await lifeCycleService.createSuccessor({
      sessionId,
      deceasedCharacterId,
      successorName,
      ownerId,
    });
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    return res.json(result);
  } catch (error) {
    logger.error('[PersonnelAPI] Successor creation failed', { error });
    return res.status(500).json({ error: 'Successor creation failed' });
  }
});

// ============================================================================
// Admin APIs
// ============================================================================

/**
 * POST /api/gin7/personnel/admin/sync-ladder
 * Redis 라더 동기화 (관리자용)
 */
router.post('/personnel/admin/sync-ladder', async (req: Request, res: Response) => {
  try {
    const { sessionId, factionId } = req.body;
    
    if (!sessionId || !factionId) {
      return res.status(400).json({ error: 'sessionId and factionId required' });
    }
    
    await ladderService.syncLadderToRedis(sessionId, factionId);
    
    return res.json({ success: true, message: 'Ladder synced to Redis' });
  } catch (error) {
    logger.error('[PersonnelAPI] Ladder sync failed', { error });
    return res.status(500).json({ error: 'Ladder sync failed' });
  }
});

/**
 * POST /api/gin7/personnel/admin/register
 * 신규 등록 (관리자/테스트용)
 */
router.post('/personnel/admin/register', async (req: Request, res: Response) => {
  try {
    const { 
      sessionId, 
      characterId, 
      factionId, 
      characterName, 
      enlistmentDate, 
      birthDate,
      initialRank 
    } = req.body;
    
    if (!sessionId || !characterId || !factionId || !characterName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const entry = await ladderService.registerNewRecruit({
      sessionId,
      characterId,
      factionId,
      characterName,
      enlistmentDate: enlistmentDate ? new Date(enlistmentDate) : new Date(),
      birthDate: birthDate ? new Date(birthDate) : new Date(),
      initialRank: initialRank as RankCode,
    });
    
    return res.json({ success: true, entry });
  } catch (error) {
    logger.error('[PersonnelAPI] Registration failed', { error });
    return res.status(500).json({ error: 'Registration failed' });
  }
});

export default router;

