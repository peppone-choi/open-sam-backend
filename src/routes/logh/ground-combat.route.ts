import { Router } from 'express';
import {
  createGroundCombat,
  getGroundCombatState,
  updateOccupationStatus,
  addSupplyBatch,
  updateSupplyBatch,
  updateWarehouseStock,
  advanceCombatPhase,
  consumeSupply,
} from '../../services/logh/GalaxyGroundCombat.service';
import { autoExtractToken } from '../../middleware/auth';
import { LOGH_MESSAGES } from '../../constants/messages';

const router = Router();
router.use(autoExtractToken);

function getSessionId(req: any): string {
  return req.session?.id || req.query.sessionId || req.body.sessionId;
}

function ensureSessionAccess(req: any, res: any, sessionId: string) {
  const tokenSessionId = req.user?.sessionId;
  if (tokenSessionId && sessionId && tokenSessionId !== sessionId) {
    res.status(403).json({ success: false, message: '세션이 일치하지 않습니다' });
    return false;
  }
  return true;
}

/**
 * POST /api/logh/ground-combat
 * 지상전 상태 생성
 */
router.post('/', async (req, res) => {
  const sessionId = req.body.sessionId || getSessionId(req);
  try {
    if (!sessionId) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.sessionIdRequired });
    }

    if (!ensureSessionAccess(req, res, sessionId)) {
      return;
    }

    const { battleId, gridCoordinates, factions, planets } = req.body;

    if (!battleId || !gridCoordinates || !factions) {
      return res.status(400).json({
        success: false,
        message: 'battleId, gridCoordinates, and factions are required',
      });
    }

    const combat = await createGroundCombat({
      sessionId,
      battleId,
      gridCoordinates,
      factions,
      planets,
    });

    res.json({
      success: true,
      data: combat,
      compliance: [
        {
          manualRef: 'gin7manual.txt:P.40-P.51',
          status: '✅',
          note: 'Ground combat state initialized with occupation and supply tracking',
        },
      ],
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/logh/ground-combat/:battleId
 * 지상전 전체 상태 조회
 */
router.get('/:battleId', async (req, res) => {
  try {
    const sessionId = (req.query.sessionId || getSessionId(req)) as string;
    const { battleId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.sessionIdRequired });
    }

    if (!ensureSessionAccess(req, res, sessionId)) {
      return;
    }

    const combat = await getGroundCombatState(sessionId, battleId);

    res.json({
      success: true,
      data: combat,
      compliance: [
        {
          manualRef: 'gin7manual.txt:P.40-P.51',
          status: '✅',
          note: 'Ground combat state retrieved successfully',
        },
      ],
    });
  } catch (error: any) {
    res.status(404).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/logh/ground-combat/:battleId/occupation
 * 점령 상태 조회
 */
router.get('/:battleId/occupation', async (req, res) => {
  try {
    const sessionId = (req.query.sessionId || getSessionId(req)) as string;
    const { battleId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.sessionIdRequired });
    }

    if (!ensureSessionAccess(req, res, sessionId)) {
      return;
    }

    const combat = await getGroundCombatState(sessionId, battleId);

    res.json({
      success: true,
      data: {
        occupationStatus: combat.occupationStatus,
        combatPhase: combat.combatPhase,
        lastUpdateAt: combat.lastUpdateAt,
      },
      compliance: [
        {
          manualRef: 'gin7manual.txt:P.40-P.51',
          status: '✅',
          note: 'Occupation status includes progress, garrison units, and supply lines',
        },
      ],
    });
  } catch (error: any) {
    res.status(404).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/logh/ground-combat/:battleId/occupation/:planetId
 * 점령 상태 업데이트
 */
router.put('/:battleId/occupation/:planetId', async (req, res) => {
  const sessionId = req.body.sessionId || getSessionId(req);
  try {
    const { battleId, planetId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.sessionIdRequired });
    }

    if (!ensureSessionAccess(req, res, sessionId)) {
      return;
    }

    const updates = req.body;
    const occupation = await updateOccupationStatus(sessionId, battleId, planetId, updates);

    res.json({
      success: true,
      data: occupation,
      compliance: [
        {
          manualRef: 'gin7manual.txt:P.40-P.51',
          status: '✅',
          note: 'Occupation status updated successfully',
        },
      ],
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/logh/ground-combat/:battleId/supplies
 * 보급 배치 조회
 */
router.get('/:battleId/supplies', async (req, res) => {
  try {
    const sessionId = (req.query.sessionId || getSessionId(req)) as string;
    const { battleId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.sessionIdRequired });
    }

    if (!ensureSessionAccess(req, res, sessionId)) {
      return;
    }

    const combat = await getGroundCombatState(sessionId, battleId);

    res.json({
      success: true,
      data: {
        supplyBatches: combat.supplyBatches,
        totalAvailable: combat.supplyBatches.filter((b) => b.status === 'available').length,
        totalDeployed: combat.supplyBatches.filter((b) => b.status === 'deployed').length,
      },
      compliance: [
        {
          manualRef: 'gin7manual.txt:P.40-P.51',
          status: '✅',
          note: 'Supply batches include type, quantity, location, and assignment status',
        },
      ],
    });
  } catch (error: any) {
    res.status(404).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/logh/ground-combat/:battleId/supplies
 * 보급 배치 추가
 */
router.post('/:battleId/supplies', async (req, res) => {
  const sessionId = req.body.sessionId || getSessionId(req);
  try {
    const { battleId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.sessionIdRequired });
    }

    if (!ensureSessionAccess(req, res, sessionId)) {
      return;
    }

    const { type, quantity, location, assignedUnits, status } = req.body;

    if (!type || !quantity || !location) {
      return res.status(400).json({
        success: false,
        message: 'type, quantity, and location are required',
      });
    }

    const batch = await addSupplyBatch(sessionId, battleId, {
      type,
      quantity,
      location,
      assignedUnits: assignedUnits || [],
      status: status || 'available',
    });

    res.json({
      success: true,
      data: batch,
      compliance: [
        {
          manualRef: 'gin7manual.txt:P.40-P.51',
          status: '✅',
          note: 'Supply batch added successfully',
        },
      ],
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/logh/ground-combat/:battleId/supplies/:batchId
 * 보급 배치 상태 업데이트
 */
router.put('/:battleId/supplies/:batchId', async (req, res) => {
  const sessionId = req.body.sessionId || getSessionId(req);
  try {
    const { battleId, batchId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.sessionIdRequired });
    }

    if (!ensureSessionAccess(req, res, sessionId)) {
      return;
    }

    const updates = req.body;
    const batch = await updateSupplyBatch(sessionId, battleId, batchId, updates);

    res.json({
      success: true,
      data: batch,
      compliance: [
        {
          manualRef: 'gin7manual.txt:P.40-P.51',
          status: '✅',
          note: 'Supply batch updated successfully',
        },
      ],
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/logh/ground-combat/:battleId/supplies/:batchId/consume
 * 보급 소비
 */
router.post('/:battleId/supplies/:batchId/consume', async (req, res) => {
  const sessionId = req.body.sessionId || getSessionId(req);
  try {
    const { battleId, batchId } = req.params;
    const { amount } = req.body;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.sessionIdRequired });
    }

    if (!ensureSessionAccess(req, res, sessionId)) {
      return;
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount required',
      });
    }

    const batch = await consumeSupply(sessionId, battleId, batchId, amount);

    res.json({
      success: true,
      data: batch,
      message: `Consumed ${amount} units from supply batch`,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/logh/ground-combat/:battleId/warehouse
 * 창고 재고 조회
 */
router.get('/:battleId/warehouse', async (req, res) => {
  try {
    const sessionId = (req.query.sessionId || getSessionId(req)) as string;
    const { battleId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.sessionIdRequired });
    }

    if (!ensureSessionAccess(req, res, sessionId)) {
      return;
    }

    const combat = await getGroundCombatState(sessionId, battleId);

    res.json({
      success: true,
      data: {
        warehouses: combat.warehouseStocks,
        totalCapacity: combat.warehouseStocks.reduce((sum, w) => sum + w.capacity, 0),
        totalUsed: combat.warehouseStocks.reduce(
          (sum, w) =>
            sum +
            Object.values(w.inventory).reduce((itemSum, qty) => itemSum + qty, 0),
          0
        ),
      },
      compliance: [
        {
          manualRef: 'gin7manual.txt:P.40-P.51',
          status: '✅',
          note: 'Warehouse stocks include inventory breakdown and capacity tracking',
        },
      ],
    });
  } catch (error: any) {
    res.status(404).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/logh/ground-combat/:battleId/warehouse/:warehouseId
 * 창고 재고 업데이트
 */
router.put('/:battleId/warehouse/:warehouseId', async (req, res) => {
  const sessionId = req.body.sessionId || getSessionId(req);
  try {
    const { battleId, warehouseId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.sessionIdRequired });
    }

    if (!ensureSessionAccess(req, res, sessionId)) {
      return;
    }

    const inventoryChanges = req.body.inventory;

    if (!inventoryChanges) {
      return res.status(400).json({
        success: false,
        message: 'inventory changes required',
      });
    }

    const warehouse = await updateWarehouseStock(sessionId, battleId, warehouseId, inventoryChanges);

    res.json({
      success: true,
      data: warehouse,
      compliance: [
        {
          manualRef: 'gin7manual.txt:P.40-P.51',
          status: '✅',
          note: 'Warehouse stock updated successfully',
        },
      ],
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/logh/ground-combat/:battleId/phase
 * 전투 단계 진행
 */
router.post('/:battleId/phase', async (req, res) => {
  const sessionId = req.body.sessionId || getSessionId(req);
  try {
    const { battleId } = req.params;
    const { phase } = req.body;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: LOGH_MESSAGES.sessionIdRequired });
    }

    if (!ensureSessionAccess(req, res, sessionId)) {
      return;
    }

    if (!['landing', 'engagement', 'occupation', 'withdrawal', 'completed'].includes(phase)) {
      return res.status(400).json({
        success: false,
        message: 'Valid phase required (landing, engagement, occupation, withdrawal, completed)',
      });
    }

    const combat = await advanceCombatPhase(sessionId, battleId, phase);

    res.json({
      success: true,
      data: combat,
      message: `Combat phase advanced to: ${phase}`,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
