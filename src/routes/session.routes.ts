import { Router } from 'express';
import { Session } from '../models/session.model';
import { SessionStateService } from '../services/sessionState.service';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * /api/session/state:
 *   get:
 *     summary: 세션 상태 조회
 *     tags: [Session]
 *     parameters:
 *       - in: query
 *         name: session_id
 *         schema:
 *           type: string
 *         required: false
 *         description: 세션 ID
 */
router.get('/state', async (req, res) => {
  try {
    const sessionId = req.query.session_id as string || 'sangokushi_default';
    
    const state = await SessionStateService.getSessionState(sessionId);
    
    if (!state) {
      return res.status(404).json({
        success: false,
        message: '세션을 찾을 수 없습니다'
      });
    }

    res.json({
      success: true,
      state
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/session/status:
 *   get:
 *     summary: 세션 상태 확인 (간단)
 *     tags: [Session]
 */
router.get('/status', async (req, res) => {
  try {
    const sessionId = req.query.session_id as string || 'sangokushi_default';
    
    const status = await SessionStateService.checkSessionStatus(sessionId);
    
    res.json({
      success: true,
      status
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/session/pause:
 *   post:
 *     summary: 세션 일시정지 (관리자)
 *     tags: [Session]
 *     security:
 *       - bearerAuth: []
 */
router.post('/pause', authenticate, async (req, res) => {
  try {
    const grade = req.user?.grade || 0;
    if (grade < 5 && (req.user as any)?.acl !== '*') {
      return res.status(403).json({
        success: false,
        message: '관리자 권한이 필요합니다'
      });
    }

    const sessionId = req.body.session_id || req.query.session_id || 'sangokushi_default';
    
    const success = await SessionStateService.pauseSession(sessionId);
    
    if (!success) {
      return res.status(400).json({
        success: false,
        message: '세션 일시정지 실패'
      });
    }

    res.json({
      success: true,
      message: '세션이 일시정지되었습니다'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/session/resume:
 *   post:
 *     summary: 세션 재개 (관리자)
 *     tags: [Session]
 *     security:
 *       - bearerAuth: []
 */
router.post('/resume', authenticate, async (req, res) => {
  try {
    const grade = req.user?.grade || 0;
    if (grade < 5 && (req.user as any)?.acl !== '*') {
      return res.status(403).json({
        success: false,
        message: '관리자 권한이 필요합니다'
      });
    }

    const sessionId = req.body.session_id || req.query.session_id || 'sangokushi_default';
    
    const success = await SessionStateService.resumeSession(sessionId);
    
    if (!success) {
      return res.status(400).json({
        success: false,
        message: '세션 재개 실패'
      });
    }

    res.json({
      success: true,
      message: '세션이 재개되었습니다'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/session/list:
 *   get:
 *     summary: 모든 세션 상태 조회 (관리자)
 *     tags: [Session]
 *     security:
 *       - bearerAuth: []
 */
router.get('/list', authenticate, async (req, res) => {
  try {
    const grade = req.user?.grade || 0;
    if (grade < 5 && (req.user as any)?.acl !== '*') {
      return res.status(403).json({
        success: false,
        message: '관리자 권한이 필요합니다'
      });
    }

    const states = await SessionStateService.getAllSessionStates();
    
    res.json({
      success: true,
      sessions: states
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;
