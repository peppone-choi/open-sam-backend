import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const router = Router();

/**
 * 관리자 권한 체크 미들웨어
 */
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: '인증이 필요합니다' });
  }
  
  if ((req.user.grade || 0) < 5) {
    return res.status(403).json({ success: false, message: '관리자 권한이 필요합니다' });
  }
  
  next();
};

/**
 * @swagger
 * /api/system/update:
 *   post:
 *     summary: 시스템 업데이트 (Git Pull)
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               session_id:
 *                 type: string
 *                 description: 특정 세션만 업데이트 (선택)
 *               rebuild:
 *                 type: boolean
 *                 description: Docker 재빌드 여부
 *     responses:
 *       200:
 *         description: 업데이트 성공
 */
router.post('/update', authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { session_id, rebuild } = req.body;
    
    const results: any = {
      success: true,
      timestamp: new Date().toISOString(),
      updates: [],
    };
    
    // 백엔드 업데이트
    try {
      const { stdout: backendOut } = await execAsync('cd /app && git pull origin $(git branch --show-current) 2>&1');
      results.updates.push({
        service: 'backend',
        status: 'success',
        output: backendOut.trim(),
      });
    } catch (error: any) {
      results.updates.push({
        service: 'backend',
        status: 'error',
        error: error.message,
      });
    }
    
    // Docker 재빌드 (옵션)
    if (rebuild && process.env.NODE_ENV === 'production') {
      results.updates.push({
        service: 'docker',
        status: 'info',
        message: '도커 재빌드는 직접 명령(docker-compose restart)으로 실행해주세요.',
      });
    }
    
    res.json(results);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/system/version:
 *   get:
 *     summary: 현재 버전 정보 조회
 *     tags: [System]
 *     responses:
 *       200:
 *         description: 버전 정보
 */
router.get('/version', async (req: Request, res: Response, next: NextFunction) => {
  try {
    let backendVersion = 'unknown';
    let frontendVersion = 'unknown';
    
    try {
      const { stdout } = await execAsync('cd /app && git rev-parse --short HEAD 2>&1');
      backendVersion = stdout.trim();
    } catch (error) {
      // Git 정보 없음
    }
    
    res.json({
      success: true,
      version: {
        backend: backendVersion,
        frontend: frontendVersion,
        nodeVersion: process.version,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/system/health:
 *   get:
 *     summary: 시스템 헬스체크
 *     tags: [System]
 *     responses:
 *       200:
 *         description: 시스템 상태
 */
router.get('/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mongoose = require('mongoose');
    
    const health: any = {
      success: true,
      timestamp: new Date().toISOString(),
      services: {
        api: 'ok',
        mongodb: mongoose.connection.readyState === 1 ? 'ok' : 'error',
        redis: process.env.REDIS_URL ? 'connected' : 'not_configured'
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
    
    res.json(health);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/system/sessions:
 *   get:
 *     summary: 세션 목록 조회
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 세션 목록
 */
router.get('/sessions', authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { Session } = require('../models/session.model');
    
    const sessions = await Session.find({}, {
      session_id: 1,
      'data.scenario': 1,
      'data.year': 1,
      'data.month': 1,
      'data.turntime': 1,
      _id: 0,
    }).lean();
    
    res.json({
      success: true,
      sessions: sessions.map((s: any) => ({
        sessionId: s.session_id,
        scenario: s.data?.scenario || '시나리오 없음',
        year: s.data?.year,
        month: s.data?.month,
        turntime: s.data?.turntime,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/system/restart-daemon:
 *   post:
 *     summary: 데몬 재시작 요청
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 재시작 요청 성공
 */
router.post('/restart-daemon', authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Docker 환경에서만 지원
    if (process.env.NODE_ENV === 'production') {
      res.json({
        success: true,
        message: '도커 컨테이너 재시작은 docker-compose restart daemon 명령으로 진행해주세요.',
      });
    } else {
      res.json({
        success: false,
        message: '개발 환경에서는 npm run dev:daemon 명령으로 직접 재시작하세요.',
      });
    }
  } catch (error) {
    next(error);
  }
});

export default router;
