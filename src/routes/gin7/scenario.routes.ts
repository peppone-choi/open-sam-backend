/**
 * GIN7 Scenario API Routes
 * 
 * 시나리오 관련 API 엔드포인트
 * - 시나리오 목록/조회
 * - 시나리오 시작/진행
 * - 이벤트 선택지 처리
 * 
 * @see agents/gin7-agents/gin7-scenario-script/CHECKLIST.md
 */

import { Router, Request, Response } from 'express';
import { ScenarioLoaderService } from '../../services/gin7/ScenarioLoaderService';
import { ScenarioEventEngine } from '../../services/gin7/ScenarioEventEngine';
import { Scenario } from '../../models/gin7/Scenario';
import { ScenarioSession } from '../../models/gin7/ScenarioSession';
import { logger } from '../../common/logger';

const router = Router();

// Service instances
const loaderService = ScenarioLoaderService.getInstance();
const eventEngine = ScenarioEventEngine.getInstance();

// ============================================================================
// Scenario List & Query
// ============================================================================

/**
 * GET /api/gin7/scenario/list
 * 공개된 시나리오 목록 조회
 */
router.get('/scenario/list', async (req: Request, res: Response) => {
  try {
    const { difficulty, tags, official, limit = '20', offset = '0' } = req.query;
    
    const scenarios = await loaderService.listPublishedScenarios({
      difficulty: difficulty as string,
      tags: tags ? (tags as string).split(',') : undefined,
      official: official ? official === 'true' : undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
    
    return res.json({
      scenarios,
      count: scenarios.length,
    });
  } catch (error) {
    logger.error('[ScenarioAPI] List failed', { error });
    return res.status(500).json({ error: 'Failed to list scenarios' });
  }
});

/**
 * GET /api/gin7/scenario/search
 * 시나리오 검색
 */
router.get('/scenario/search', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Query parameter q is required' });
    }
    
    const scenarios = await loaderService.searchScenarios(q as string);
    
    return res.json({
      scenarios,
      count: scenarios.length,
    });
  } catch (error) {
    logger.error('[ScenarioAPI] Search failed', { error });
    return res.status(500).json({ error: 'Failed to search scenarios' });
  }
});

/**
 * GET /api/gin7/scenario/:scenarioId
 * 시나리오 상세 조회
 */
router.get('/scenario/:scenarioId', async (req: Request, res: Response) => {
  try {
    const { scenarioId } = req.params;
    
    const scenario = await loaderService.getScenario(scenarioId);
    
    if (!scenario) {
      return res.status(404).json({ error: 'Scenario not found' });
    }
    
    return res.json({
      meta: scenario.meta,
      factions: scenario.factions,
      victoryConditions: scenario.victoryConditions.filter(c => !c.hidden),
      defeatConditions: scenario.defeatConditions.filter(c => !c.hidden),
      customData: scenario.customData,
    });
  } catch (error) {
    logger.error('[ScenarioAPI] Get scenario failed', { error });
    return res.status(500).json({ error: 'Failed to get scenario' });
  }
});

// ============================================================================
// Scenario Session Management
// ============================================================================

/**
 * POST /api/gin7/scenario/start
 * 시나리오 시작
 */
router.post('/scenario/start', async (req: Request, res: Response) => {
  try {
    const { scenarioId, playerId, playerFactionId } = req.body;
    
    if (!scenarioId || !playerId || !playerFactionId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await loaderService.startScenario({
      scenarioId,
      playerId,
      playerFactionId,
    });
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    return res.json({
      success: true,
      sessionId: result.sessionId,
    });
  } catch (error) {
    logger.error('[ScenarioAPI] Start scenario failed', { error });
    return res.status(500).json({ error: 'Failed to start scenario' });
  }
});

/**
 * GET /api/gin7/scenario/session/:sessionId
 * 세션 상태 조회
 */
router.get('/scenario/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    const session = await loaderService.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    return res.json({
      sessionId: session.sessionId,
      scenarioId: session.scenarioId,
      currentTurn: session.currentTurn,
      gameDate: session.gameDate,
      status: session.status,
      playerFactionId: session.playerFactionId,
      pendingChoices: session.pendingChoices,
      stats: session.stats,
    });
  } catch (error) {
    logger.error('[ScenarioAPI] Get session failed', { error });
    return res.status(500).json({ error: 'Failed to get session' });
  }
});

/**
 * GET /api/gin7/scenario/sessions
 * 플레이어의 활성 세션 목록
 */
router.get('/scenario/sessions', async (req: Request, res: Response) => {
  try {
    const { playerId } = req.query;
    
    if (!playerId) {
      return res.status(400).json({ error: 'playerId required' });
    }
    
    const sessions = await loaderService.getPlayerSessions(playerId as string);
    
    return res.json({
      sessions: sessions.map(s => ({
        sessionId: s.sessionId,
        scenarioId: s.scenarioId,
        currentTurn: s.currentTurn,
        status: s.status,
        lastPlayedAt: s.lastPlayedAt,
      })),
    });
  } catch (error) {
    logger.error('[ScenarioAPI] Get sessions failed', { error });
    return res.status(500).json({ error: 'Failed to get sessions' });
  }
});

/**
 * POST /api/gin7/scenario/session/:sessionId/pause
 * 세션 일시정지
 */
router.post('/scenario/session/:sessionId/pause', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    await loaderService.updateSessionStatus(sessionId, 'paused');
    
    return res.json({ success: true });
  } catch (error) {
    logger.error('[ScenarioAPI] Pause session failed', { error });
    return res.status(500).json({ error: 'Failed to pause session' });
  }
});

/**
 * POST /api/gin7/scenario/session/:sessionId/resume
 * 세션 재개
 */
router.post('/scenario/session/:sessionId/resume', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    await loaderService.updateSessionStatus(sessionId, 'active');
    
    return res.json({ success: true });
  } catch (error) {
    logger.error('[ScenarioAPI] Resume session failed', { error });
    return res.status(500).json({ error: 'Failed to resume session' });
  }
});

/**
 * POST /api/gin7/scenario/session/:sessionId/abandon
 * 세션 포기
 */
router.post('/scenario/session/:sessionId/abandon', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    await loaderService.updateSessionStatus(sessionId, 'abandoned');
    
    return res.json({ success: true });
  } catch (error) {
    logger.error('[ScenarioAPI] Abandon session failed', { error });
    return res.status(500).json({ error: 'Failed to abandon session' });
  }
});

/**
 * DELETE /api/gin7/scenario/session/:sessionId
 * 세션 삭제
 */
router.delete('/scenario/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    await loaderService.deleteSession(sessionId);
    
    return res.json({ success: true });
  } catch (error) {
    logger.error('[ScenarioAPI] Delete session failed', { error });
    return res.status(500).json({ error: 'Failed to delete session' });
  }
});

// ============================================================================
// Event System
// ============================================================================

/**
 * POST /api/gin7/scenario/event/choice
 * 이벤트 선택지 처리
 */
router.post('/scenario/event/choice', async (req: Request, res: Response) => {
  try {
    const { sessionId, eventId, choiceId } = req.body;
    
    if (!sessionId || !eventId || !choiceId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await eventEngine.processChoice(sessionId, eventId, choiceId);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    return res.json(result);
  } catch (error) {
    logger.error('[ScenarioAPI] Process choice failed', { error });
    return res.status(500).json({ error: 'Failed to process choice' });
  }
});

/**
 * GET /api/gin7/scenario/session/:sessionId/conditions
 * 승리/패배 조건 체크
 */
router.get('/scenario/session/:sessionId/conditions', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    const result = await eventEngine.checkGameConditions(sessionId);
    
    return res.json(result);
  } catch (error) {
    logger.error('[ScenarioAPI] Check conditions failed', { error });
    return res.status(500).json({ error: 'Failed to check conditions' });
  }
});

// ============================================================================
// Admin APIs
// ============================================================================

/**
 * POST /api/gin7/scenario/admin/load
 * 시나리오 파일 로드 (관리자용)
 */
router.post('/scenario/admin/load', async (req: Request, res: Response) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: 'filePath required' });
    }
    
    const result = await loaderService.loadFromFile(filePath);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    return res.json(result);
  } catch (error) {
    logger.error('[ScenarioAPI] Load from file failed', { error });
    return res.status(500).json({ error: 'Failed to load scenario' });
  }
});

/**
 * POST /api/gin7/scenario/admin/load-all
 * 디렉토리의 모든 시나리오 로드 (관리자용)
 */
router.post('/scenario/admin/load-all', async (req: Request, res: Response) => {
  try {
    const { dirPath } = req.body;
    
    const result = await loaderService.loadAllFromDirectory(dirPath);
    
    return res.json(result);
  } catch (error) {
    logger.error('[ScenarioAPI] Load all failed', { error });
    return res.status(500).json({ error: 'Failed to load scenarios' });
  }
});

/**
 * POST /api/gin7/scenario/admin/create
 * 시나리오 직접 생성/업데이트 (관리자용)
 */
router.post('/scenario/admin/create', async (req: Request, res: Response) => {
  try {
    const scenarioData = req.body;
    
    const result = await loaderService.saveScenario(scenarioData);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    return res.json(result);
  } catch (error) {
    logger.error('[ScenarioAPI] Create scenario failed', { error });
    return res.status(500).json({ error: 'Failed to create scenario' });
  }
});

/**
 * DELETE /api/gin7/scenario/admin/:scenarioId
 * 시나리오 삭제 (관리자용)
 */
router.delete('/scenario/admin/:scenarioId', async (req: Request, res: Response) => {
  try {
    const { scenarioId } = req.params;
    
    await Scenario.deleteOne({ 'meta.id': scenarioId });
    loaderService.clearCache(scenarioId);
    
    return res.json({ success: true });
  } catch (error) {
    logger.error('[ScenarioAPI] Delete scenario failed', { error });
    return res.status(500).json({ error: 'Failed to delete scenario' });
  }
});

/**
 * POST /api/gin7/scenario/admin/publish/:scenarioId
 * 시나리오 공개/비공개 토글 (관리자용)
 */
router.post('/scenario/admin/publish/:scenarioId', async (req: Request, res: Response) => {
  try {
    const { scenarioId } = req.params;
    const { publish } = req.body;
    
    await Scenario.updateOne(
      { 'meta.id': scenarioId },
      { $set: { isPublished: publish } }
    );
    
    loaderService.clearCache(scenarioId);
    
    return res.json({ success: true, isPublished: publish });
  } catch (error) {
    logger.error('[ScenarioAPI] Publish toggle failed', { error });
    return res.status(500).json({ error: 'Failed to toggle publish' });
  }
});

export default router;















