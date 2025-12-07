import { Router } from 'express';
import { autoExtractToken } from '../../middleware/auth';
import { FacilityService } from '../../services/gin7/FacilityService';
import { 
  FACILITY_DEFINITIONS, 
  ExtendedFacilityType,
  calculateFacilityCost,
  getFacilityEffect 
} from '../../models/gin7/Facility';
import { Planet } from '../../models/gin7/Planet';

const router = Router();

// ==================== PUBLIC ENDPOINTS ====================

/**
 * GET /api/gin7/facility/definitions
 * 시설 정의 테이블 조회 (공개)
 */
router.get('/definitions', (_req, res) => {
  res.json({
    success: true,
    schemaVersion: '2025-12-02.gin7.facility.definitions.1',
    data: Object.values(FACILITY_DEFINITIONS).map(def => ({
      type: def.type,
      name: def.name,
      description: def.description,
      maxLevel: def.maxLevel,
      baseCost: def.baseCost,
      levelUpMultiplier: def.levelUpMultiplier,
      baseHp: def.baseHp,
      hpPerLevel: def.hpPerLevel,
      isUnique: def.isUnique,
      isFortressOnly: def.isFortressOnly,
      prerequisite: def.prerequisite
    }))
  });
});

/**
 * GET /api/gin7/facility/cost/:type/:level
 * 특정 시설의 비용 계산 (공개)
 */
router.get('/cost/:type/:level', (req, res) => {
  try {
    const { type } = req.params;
    const level = parseInt(req.params.level, 10) || 1;
    
    if (!FACILITY_DEFINITIONS[type as ExtendedFacilityType]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid facility type',
        errorCode: 'INVALID_FACILITY_TYPE'
      });
    }
    
    const cost = calculateFacilityCost(type as ExtendedFacilityType, level);
    const effect = getFacilityEffect(type as ExtendedFacilityType, level);
    
    res.json({
      success: true,
      schemaVersion: '2025-12-02.gin7.facility.cost.1',
      data: {
        type,
        level,
        cost,
        effect
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ==================== AUTHENTICATED ENDPOINTS ====================
router.use(autoExtractToken);

/**
 * GET /api/gin7/facility/:planetId
 * 행성의 시설 목록 조회
 */
router.get('/:planetId', async (req, res) => {
  try {
    const { sessionId } = await ensureSession(req);
    const { planetId } = req.params;
    
    const facilities = await FacilityService.getPlanetFacilities(sessionId, planetId);
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
      schemaVersion: '2025-12-02.gin7.facility.list.1',
      data: {
        planetId,
        planetName: planet.name,
        facilities,
        maxSlots: planet.maxFacilitySlots,
        usedSlots: facilities.length,
        isFortress: planet.data?.isFortress || false,
        fortressCannonState: planet.data?.fortressCannonState || null
      }
    });
  } catch (error: any) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/gin7/facility/:planetId/queue
 * 건설 대기열 조회
 */
router.get('/:planetId/queue', async (req, res) => {
  try {
    const { sessionId } = await ensureSession(req);
    const { planetId } = req.params;
    
    const queue = await FacilityService.getConstructionQueue(sessionId, planetId);
    
    res.json({
      success: true,
      schemaVersion: '2025-12-02.gin7.facility.queue.1',
      data: queue.map(item => ({
        queueId: item.queueId,
        constructionType: item.constructionType,
        facilityType: item.facilityType,
        targetLevel: item.targetLevel,
        turnsRemaining: item.turnsRemaining,
        turnsRequired: item.turnsRequired,
        progress: Math.round(((item.turnsRequired - item.turnsRemaining) / item.turnsRequired) * 100),
        startTime: item.startTime,
        estimatedEnd: item.endTime,
        priority: item.priority,
        status: item.status
      }))
    });
  } catch (error: any) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/gin7/facility/:planetId/can-build/:type
 * 시설 건설 가능 여부 확인
 */
router.get('/:planetId/can-build/:type', async (req, res) => {
  try {
    const { sessionId } = await ensureSession(req);
    const { planetId, type } = req.params;
    
    const result = await FacilityService.canBuildFacility(
      sessionId, 
      planetId, 
      type as ExtendedFacilityType
    );
    
    res.json({
      success: true,
      schemaVersion: '2025-12-02.gin7.facility.canBuild.1',
      data: {
        canBuild: result.canBuild,
        reason: result.reason,
        cost: result.canBuild ? calculateFacilityCost(type as ExtendedFacilityType, 1) : null
      }
    });
  } catch (error: any) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/gin7/facility/build
 * 시설 건설 시작
 */
router.post('/build', async (req, res) => {
  try {
    const { sessionId, characterId } = await ensureSession(req);
    const { planetId, facilityType, priority } = req.body;
    
    if (!planetId || !facilityType) {
      return res.status(400).json({
        success: false,
        message: 'planetId and facilityType are required',
        errorCode: 'MISSING_PARAMETERS'
      });
    }
    
    const result = await FacilityService.buildFacility(
      sessionId,
      planetId,
      facilityType as ExtendedFacilityType,
      characterId || 'SYSTEM',
      priority || 0
    );
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error,
        errorCode: 'BUILD_FAILED'
      });
    }
    
    res.json({
      success: true,
      schemaVersion: '2025-12-02.gin7.facility.build.1',
      data: {
        queueId: result.queueId,
        estimatedCompletion: result.estimatedCompletion
      }
    });
  } catch (error: any) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/gin7/facility/upgrade
 * 시설 업그레이드
 */
router.post('/upgrade', async (req, res) => {
  try {
    const { sessionId, characterId } = await ensureSession(req);
    const { planetId, facilityId, priority } = req.body;
    
    if (!planetId || !facilityId) {
      return res.status(400).json({
        success: false,
        message: 'planetId and facilityId are required',
        errorCode: 'MISSING_PARAMETERS'
      });
    }
    
    const result = await FacilityService.upgradeFacility(
      sessionId,
      planetId,
      facilityId,
      characterId || 'SYSTEM',
      priority || 0
    );
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error,
        errorCode: 'UPGRADE_FAILED'
      });
    }
    
    res.json({
      success: true,
      schemaVersion: '2025-12-02.gin7.facility.upgrade.1',
      data: {
        queueId: result.queueId,
        estimatedCompletion: result.estimatedCompletion
      }
    });
  } catch (error: any) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/gin7/facility/repair
 * 시설 수리
 */
router.post('/repair', async (req, res) => {
  try {
    const { sessionId, characterId } = await ensureSession(req);
    const { planetId, facilityId, priority } = req.body;
    
    if (!planetId || !facilityId) {
      return res.status(400).json({
        success: false,
        message: 'planetId and facilityId are required',
        errorCode: 'MISSING_PARAMETERS'
      });
    }
    
    const result = await FacilityService.repairFacility(
      sessionId,
      planetId,
      facilityId,
      characterId || 'SYSTEM',
      priority || 0
    );
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error,
        errorCode: 'REPAIR_FAILED'
      });
    }
    
    res.json({
      success: true,
      schemaVersion: '2025-12-02.gin7.facility.repair.1',
      data: {
        queueId: result.queueId,
        estimatedCompletion: result.estimatedCompletion
      }
    });
  } catch (error: any) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * DELETE /api/gin7/facility/queue/:queueId
 * 건설 취소
 */
router.delete('/queue/:queueId', async (req, res) => {
  try {
    const { sessionId } = await ensureSession(req);
    const { queueId } = req.params;
    
    const result = await FacilityService.cancelConstruction(sessionId, queueId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error,
        errorCode: 'CANCEL_FAILED'
      });
    }
    
    res.json({
      success: true,
      schemaVersion: '2025-12-02.gin7.facility.cancel.1',
      data: {
        cancelled: true,
        refunded: result.refunded
      }
    });
  } catch (error: any) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/gin7/facility/auto-repair
 * 자동 수리 설정
 */
router.post('/auto-repair', async (req, res) => {
  try {
    const { sessionId } = await ensureSession(req);
    const { planetId, enabled } = req.body;
    
    if (!planetId || typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'planetId and enabled (boolean) are required',
        errorCode: 'MISSING_PARAMETERS'
      });
    }
    
    const result = await FacilityService.setAutoRepair(sessionId, planetId, enabled);
    
    res.json({
      success: true,
      schemaVersion: '2025-12-02.gin7.facility.autoRepair.1',
      data: { success: result.success, enabled }
    });
  } catch (error: any) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message
    });
  }
});

// ==================== FORTRESS CANNON ENDPOINTS ====================

/**
 * GET /api/gin7/facility/:planetId/fortress-cannon
 * 요새포 상태 조회
 */
router.get('/:planetId/fortress-cannon', async (req, res) => {
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
    
    const cannonState = planet.data?.fortressCannonState;
    
    if (!cannonState) {
      return res.status(404).json({
        success: false,
        message: 'No fortress cannon on this planet',
        errorCode: 'NO_FORTRESS_CANNON'
      });
    }
    
    res.json({
      success: true,
      schemaVersion: '2025-12-02.gin7.facility.fortressCannon.1',
      data: cannonState
    });
  } catch (error: any) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/gin7/facility/:planetId/fortress-cannon/fire
 * 요새포 발사
 */
router.post('/:planetId/fortress-cannon/fire', async (req, res) => {
  try {
    const { sessionId } = await ensureSession(req);
    const { planetId } = req.params;
    const { targetFleetId } = req.body;
    
    if (!targetFleetId) {
      return res.status(400).json({
        success: false,
        message: 'targetFleetId is required',
        errorCode: 'MISSING_TARGET'
      });
    }
    
    const result = await FacilityService.fireFortressCannon(sessionId, planetId, targetFleetId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error,
        errorCode: 'FIRE_FAILED'
      });
    }
    
    res.json({
      success: true,
      schemaVersion: '2025-12-02.gin7.facility.fortressCannon.fire.1',
      data: {
        fired: true,
        damage: result.damage,
        targetFleetId
      }
    });
  } catch (error: any) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message
    });
  }
});

// ==================== HELPER FUNCTIONS ====================

interface SessionContext {
  sessionId: string;
  userId?: string;
  characterId?: string;
  factionId?: string;
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
    characterId: req.user?.characterId || req.body?.characterId,
    factionId: req.user?.factionId || req.body?.factionId,
  };
}

export default router;

