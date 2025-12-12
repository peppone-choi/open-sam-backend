/**
 * GIN7 Bureaucracy Routes
 * 
 * 관료제적 작전 승인 및 평가 시스템 API
 * 
 * @see agents/gin7-agents/gin7-bureaucracy/CHECKLIST.md
 */

import { Router, Request, Response } from 'express';
import { BureaucracyService } from '../../services/gin7/BureaucracyService';
import { OperationPlan, OperationObjective, OperationStatus } from '../../models/gin7/OperationPlan';
import { logger } from '../../common/logger';

const router = Router();
const bureaucracyService = BureaucracyService.getInstance();

// ============================================================================
// Operation Plan CRUD
// ============================================================================

/**
 * GET /api/gin7/bureaucracy/operations
 * 작전 목록 조회
 */
router.get('/operations', async (req: Request, res: Response) => {
  try {
    const { sessionId, factionId, status } = req.query;
    
    if (!sessionId || !factionId) {
      return res.status(400).json({ error: 'sessionId and factionId are required' });
    }
    
    const statusFilter = status 
      ? (typeof status === 'string' ? status.split(',') as OperationStatus[] : undefined)
      : undefined;
    
    const operations = await bureaucracyService.getOperations(
      sessionId as string,
      factionId as string,
      statusFilter
    );
    
    res.json({
      success: true,
      data: operations,
      count: operations.length,
    });
  } catch (error) {
    logger.error('[BureaucracyRoutes] Failed to get operations', { error });
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

/**
 * GET /api/gin7/bureaucracy/operations/:operationId
 * 특정 작전 조회
 */
router.get('/operations/:operationId', async (req: Request, res: Response) => {
  try {
    const { operationId } = req.params;
    const { sessionId } = req.query;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }
    
    const operation = await bureaucracyService.getOperation(
      sessionId as string,
      operationId
    );
    
    if (!operation) {
      return res.status(404).json({ success: false, error: 'Operation not found' });
    }
    
    res.json({
      success: true,
      data: operation,
    });
  } catch (error) {
    logger.error('[BureaucracyRoutes] Failed to get operation', { error });
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

// ============================================================================
// Operation Proposal (PROPOSE_OPERATION)
// ============================================================================

/**
 * POST /api/gin7/bureaucracy/operations/propose
 * 작전 입안 (Draft)
 */
router.post('/operations/propose', async (req: Request, res: Response) => {
  try {
    const {
      sessionId,
      factionId,
      drafterId,
      drafterName,
      operationName,
      description,
      objective,
      targetSystems,
      targetPlanets,
      operationZone,
      requiredResources,
      scheduledStartAt,
      deadline,
    } = req.body;
    
    // Validation
    if (!sessionId || !factionId || !drafterId || !drafterName) {
      return res.status(400).json({ 
        success: false, 
        error: 'sessionId, factionId, drafterId, and drafterName are required' 
      });
    }
    
    if (!operationName || !objective || !targetSystems || targetSystems.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'operationName, objective, and targetSystems are required' 
      });
    }
    
    if (!operationZone || (!operationZone.systemIds?.length && !operationZone.planetIds?.length)) {
      return res.status(400).json({ 
        success: false, 
        error: 'operationZone with at least one systemId or planetId is required' 
      });
    }
    
    const operation = await bureaucracyService.proposeOperation({
      sessionId,
      factionId,
      drafterId,
      drafterName,
      operationName,
      description,
      objective: objective as OperationObjective,
      targetSystems,
      targetPlanets,
      operationZone,
      requiredResources,
      scheduledStartAt: scheduledStartAt ? new Date(scheduledStartAt) : undefined,
      deadline: deadline ? new Date(deadline) : undefined,
    });
    
    res.status(201).json({
      success: true,
      data: operation,
      message: `Operation "${operation.operationName}" (${operation.operationCode}) drafted successfully`,
    });
  } catch (error) {
    logger.error('[BureaucracyRoutes] Failed to propose operation', { error });
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

/**
 * POST /api/gin7/bureaucracy/operations/:operationId/submit
 * 결재 요청 (Draft -> Pending)
 */
router.post('/operations/:operationId/submit', async (req: Request, res: Response) => {
  try {
    const { operationId } = req.params;
    const { sessionId, submitterId } = req.body;
    
    if (!sessionId || !submitterId) {
      return res.status(400).json({ 
        success: false, 
        error: 'sessionId and submitterId are required' 
      });
    }
    
    const operation = await bureaucracyService.submitForApproval(
      sessionId,
      operationId,
      submitterId
    );
    
    res.json({
      success: true,
      data: operation,
      message: 'Operation submitted for approval',
    });
  } catch (error) {
    logger.error('[BureaucracyRoutes] Failed to submit operation', { error });
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to submit operation' 
    });
  }
});

// ============================================================================
// Approval Process (APPROVE_OPERATION)
// ============================================================================

/**
 * GET /api/gin7/bureaucracy/pending-approvals
 * 결재 대기 목록 조회
 */
router.get('/pending-approvals', async (req: Request, res: Response) => {
  try {
    const { sessionId, factionId, approverId } = req.query;
    
    if (!sessionId || !factionId || !approverId) {
      return res.status(400).json({ 
        success: false, 
        error: 'sessionId, factionId, and approverId are required' 
      });
    }
    
    const operations = await bureaucracyService.getPendingApprovals(
      sessionId as string,
      factionId as string,
      approverId as string
    );
    
    res.json({
      success: true,
      data: operations,
      count: operations.length,
    });
  } catch (error) {
    logger.error('[BureaucracyRoutes] Failed to get pending approvals', { error });
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

/**
 * POST /api/gin7/bureaucracy/operations/:operationId/approve
 * 결재 처리 (승인/반려)
 */
router.post('/operations/:operationId/approve', async (req: Request, res: Response) => {
  try {
    const { operationId } = req.params;
    const { sessionId, approverId, approverName, approved, comment } = req.body;
    
    if (!sessionId || !approverId || !approverName || typeof approved !== 'boolean') {
      return res.status(400).json({ 
        success: false, 
        error: 'sessionId, approverId, approverName, and approved (boolean) are required' 
      });
    }
    
    const operation = await bureaucracyService.processApproval({
      sessionId,
      operationId,
      approverId,
      approverName,
      approved,
      comment,
    });
    
    res.json({
      success: true,
      data: operation,
      message: approved ? 'Operation approved' : 'Operation rejected',
    });
  } catch (error) {
    logger.error('[BureaucracyRoutes] Failed to process approval', { error });
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to process approval' 
    });
  }
});

// ============================================================================
// Order Issuance (ISSUE_ORDER)
// ============================================================================

/**
 * POST /api/gin7/bureaucracy/operations/:operationId/issue
 * 작전 발령 (부대 할당 및 활성화)
 */
router.post('/operations/:operationId/issue', async (req: Request, res: Response) => {
  try {
    const { operationId } = req.params;
    const { sessionId, issuerId, fleetIds } = req.body;
    
    if (!sessionId || !issuerId || !fleetIds || !Array.isArray(fleetIds)) {
      return res.status(400).json({ 
        success: false, 
        error: 'sessionId, issuerId, and fleetIds (array) are required' 
      });
    }
    
    if (fleetIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'At least one fleet must be assigned' 
      });
    }
    
    const operation = await bureaucracyService.issueOrder({
      sessionId,
      operationId,
      issuerId,
      fleetIds,
    });
    
    res.json({
      success: true,
      data: operation,
      message: `Order issued. ${fleetIds.length} fleet(s) assigned to operation "${operation.operationName}"`,
    });
  } catch (error) {
    logger.error('[BureaucracyRoutes] Failed to issue order', { error });
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to issue order' 
    });
  }
});

// ============================================================================
// Operation Completion
// ============================================================================

/**
 * POST /api/gin7/bureaucracy/operations/:operationId/complete
 * 작전 완료 처리
 */
router.post('/operations/:operationId/complete', async (req: Request, res: Response) => {
  try {
    const { operationId } = req.params;
    const { 
      sessionId, 
      completedBy, 
      success, 
      objectiveAchieved, 
      casualties, 
      capturedSystems, 
      capturedPlanets 
    } = req.body;
    
    if (!sessionId || !completedBy || typeof success !== 'boolean' || typeof objectiveAchieved !== 'boolean') {
      return res.status(400).json({ 
        success: false, 
        error: 'sessionId, completedBy, success, and objectiveAchieved are required' 
      });
    }
    
    const operation = await bureaucracyService.completeOperation(
      sessionId,
      operationId,
      completedBy,
      {
        success,
        objectiveAchieved,
        casualties: casualties || {
          shipsLost: 0,
          shipsDestroyed: 0,
          personnelLost: 0,
          enemyKilled: 0,
        },
        capturedSystems: capturedSystems || [],
        capturedPlanets: capturedPlanets || [],
      }
    );
    
    res.json({
      success: true,
      data: operation,
      message: success 
        ? `Operation "${operation.operationName}" completed successfully (Rating: ${operation.result?.evaluation?.rating})` 
        : `Operation "${operation.operationName}" failed`,
    });
  } catch (error) {
    logger.error('[BureaucracyRoutes] Failed to complete operation', { error });
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to complete operation' 
    });
  }
});

/**
 * POST /api/gin7/bureaucracy/operations/:operationId/cancel
 * 작전 취소
 */
router.post('/operations/:operationId/cancel', async (req: Request, res: Response) => {
  try {
    const { operationId } = req.params;
    const { sessionId, cancelledBy, reason } = req.body;
    
    if (!sessionId || !cancelledBy || !reason) {
      return res.status(400).json({ 
        success: false, 
        error: 'sessionId, cancelledBy, and reason are required' 
      });
    }
    
    const operation = await bureaucracyService.cancelOperation(
      sessionId,
      operationId,
      cancelledBy,
      reason
    );
    
    res.json({
      success: true,
      data: operation,
      message: `Operation "${operation.operationName}" cancelled`,
    });
  } catch (error) {
    logger.error('[BureaucracyRoutes] Failed to cancel operation', { error });
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to cancel operation' 
    });
  }
});

// ============================================================================
// Merit Calculation
// ============================================================================

/**
 * POST /api/gin7/bureaucracy/calculate-merit
 * 공적치 계산 (작전 구역 보정 적용)
 */
router.post('/calculate-merit', async (req: Request, res: Response) => {
  try {
    const { sessionId, characterId, factionId, rawMerit, systemId, planetId } = req.body;
    
    if (!sessionId || !characterId || !factionId || typeof rawMerit !== 'number') {
      return res.status(400).json({ 
        success: false, 
        error: 'sessionId, characterId, factionId, and rawMerit are required' 
      });
    }
    
    const result = await bureaucracyService.calculateMerit(
      sessionId,
      characterId,
      factionId,
      rawMerit,
      systemId,
      planetId
    );
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('[BureaucracyRoutes] Failed to calculate merit', { error });
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

// ============================================================================
// Statistics
// ============================================================================

/**
 * GET /api/gin7/bureaucracy/stats
 * 작전 통계 조회
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { sessionId, factionId } = req.query;
    
    if (!sessionId || !factionId) {
      return res.status(400).json({ 
        success: false, 
        error: 'sessionId and factionId are required' 
      });
    }
    
    const stats = await OperationPlan.aggregate([
      { $match: { sessionId, factionId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);
    
    const statsByObjective = await OperationPlan.aggregate([
      { $match: { sessionId, factionId, status: 'completed' } },
      {
        $group: {
          _id: '$objective',
          count: { $sum: 1 },
          avgRating: { 
            $avg: { 
              $switch: {
                branches: [
                  { case: { $eq: ['$result.evaluation.rating', 'S'] }, then: 5 },
                  { case: { $eq: ['$result.evaluation.rating', 'A'] }, then: 4 },
                  { case: { $eq: ['$result.evaluation.rating', 'B'] }, then: 3 },
                  { case: { $eq: ['$result.evaluation.rating', 'C'] }, then: 2 },
                  { case: { $eq: ['$result.evaluation.rating', 'D'] }, then: 1 },
                  { case: { $eq: ['$result.evaluation.rating', 'F'] }, then: 0 },
                ],
                default: 0,
              }
            }
          },
        },
      },
    ]);
    
    const statusMap: Record<string, number> = {};
    for (const s of stats) {
      statusMap[s._id] = s.count;
    }
    
    res.json({
      success: true,
      data: {
        byStatus: statusMap,
        byObjective: statsByObjective,
        total: Object.values(statusMap).reduce((a, b) => a + b, 0),
      },
    });
  } catch (error) {
    logger.error('[BureaucracyRoutes] Failed to get stats', { error });
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

export default router;















