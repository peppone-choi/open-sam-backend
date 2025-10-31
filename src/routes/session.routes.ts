import { Router, Request, Response } from 'express';
import { SessionService } from '../services/session.service';

const router = Router();

/**
 * @swagger
 * /api/session/templates:
 *   get:
 *     summary: 사용 가능한 세션 템플릿 목록
 *     tags: [Session]
 *     responses:
 *       200:
 *         description: 템플릿 목록
 */
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const templates = SessionService.getAvailableTemplates();
    res.json({ templates });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/session/list:
 *   get:
 *     summary: 모든 세션 목록 조회
 *     tags: [Session]
 *     responses:
 *       200:
 *         description: 세션 목록
 */
router.get('/list', async (req: Request, res: Response) => {
  try {
    const sessions = await SessionService.getAllSessions();
    res.json({ 
      sessions: sessions.map(s => ({
        session_id: s.session_id,
        name: s.name,
        template_id: s.template_id,
        game_mode: s.game_mode,
        status: s.status,
        started_at: s.started_at
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/session/{sessionId}:
 *   get:
 *     summary: 특정 세션 조회
 *     tags: [Session]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 세션 정보
 */
router.get('/:sessionId', async (req: Request, res: Response) => {
  try {
    const session = await SessionService.getSession(req.params.sessionId);
    
    if (!session) {
      return res.status(404).json({ error: '세션을 찾을 수 없습니다' });
    }
    
    res.json({ session });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/session/create:
 *   post:
 *     summary: 템플릿 기반 세션 생성
 *     tags: [Session]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - templateId
 *               - sessionId
 *               - sessionName
 *             properties:
 *               templateId:
 *                 type: string
 *                 description: 템플릿 ID (예 - sangokushi)
 *               sessionId:
 *                 type: string
 *                 description: 새 세션 ID (예 - sangokushi_room1)
 *               sessionName:
 *                 type: string
 *                 description: 세션 이름 (예 - 삼국지 방 1)
 *               autoInit:
 *                 type: boolean
 *                 description: 자동 초기화 여부 (기본값 - true)
 *     responses:
 *       201:
 *         description: 세션 생성 성공
 */
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { templateId, sessionId, sessionName, autoInit = true } = req.body;
    
    if (!templateId || !sessionId || !sessionName) {
      return res.status(400).json({ 
        error: 'templateId, sessionId, sessionName은 필수입니다' 
      });
    }
    
    const session = await SessionService.createSessionFromTemplate(
      templateId,
      sessionId,
      sessionName,
      autoInit
    );
    
    res.status(201).json({ 
      message: '세션 생성 완료',
      session: {
        session_id: session.session_id,
        name: session.name,
        template_id: session.template_id,
        game_mode: session.game_mode,
        status: session.status
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/session/{sessionId}/reset:
 *   post:
 *     summary: 세션 초기화 (게임 데이터 리셋)
 *     tags: [Session]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 초기화 성공
 */
router.post('/:sessionId/reset', async (req: Request, res: Response) => {
  try {
    await SessionService.resetSession(req.params.sessionId);
    
    res.json({ 
      message: '세션 초기화 완료',
      session_id: req.params.sessionId
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/session/{sessionId}:
 *   delete:
 *     summary: 세션 삭제
 *     tags: [Session]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 삭제 성공
 */
router.delete('/:sessionId', async (req: Request, res: Response) => {
  try {
    await SessionService.deleteSession(req.params.sessionId);
    
    res.json({ 
      message: '세션 삭제 완료',
      session_id: req.params.sessionId
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/session/{sessionId}/update:
 *   patch:
 *     summary: 세션 설정 부분 업데이트
 *     tags: [Session]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               game_mode:
 *                 type: string
 *                 enum: [turn, realtime]
 *               turn_config:
 *                 type: object
 *               realtime_config:
 *                 type: object
 *               resources:
 *                 type: object
 *               attributes:
 *                 type: object
 *               commands:
 *                 type: object
 *               game_constants:
 *                 type: object
 *               cities:
 *                 type: object
 *               status:
 *                 type: string
 *                 enum: [waiting, running, finished]
 *     responses:
 *       200:
 *         description: 업데이트 성공
 */
router.patch('/:sessionId/update', async (req: Request, res: Response) => {
  try {
    const session = await SessionService.updateSession(
      req.params.sessionId,
      req.body
    );
    
    res.json({ 
      message: '세션 설정 업데이트 완료',
      session: {
        session_id: session?.session_id,
        name: session?.name,
        game_mode: session?.game_mode,
        status: session?.status
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/session/{sessionId}/reload:
 *   post:
 *     summary: 템플릿으로부터 세션 설정 리로드
 *     tags: [Session]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               templateId:
 *                 type: string
 *                 description: "템플릿 ID (생략시 기존 template_id 사용)"
 *     responses:
 *       200:
 *         description: 리로드 성공
 */
router.post('/:sessionId/reload', async (req: Request, res: Response) => {
  try {
    const { templateId } = req.body;
    
    const session = await SessionService.reloadSessionConfig(
      req.params.sessionId,
      templateId
    );
    
    res.json({ 
      message: '세션 설정 리로드 완료',
      session: {
        session_id: session?.session_id,
        name: session?.name,
        template_id: session?.template_id,
        game_mode: session?.game_mode
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/session/{sessionId}/command/{commandId}:
 *   patch:
 *     summary: 특정 커맨드 설정 업데이트
 *     tags: [Session]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: commandId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled:
 *                 type: boolean
 *               duration:
 *                 type: number
 *               cost:
 *                 type: object
 *               effects:
 *                 type: object
 *     responses:
 *       200:
 *         description: 업데이트 성공
 */
router.patch('/:sessionId/command/:commandId', async (req: Request, res: Response) => {
  try {
    await SessionService.updateCommand(
      req.params.sessionId,
      req.params.commandId,
      req.body
    );
    
    res.json({ 
      message: '커맨드 설정 업데이트 완료',
      session_id: req.params.sessionId,
      command_id: req.params.commandId
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
