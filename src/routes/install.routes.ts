/**
 * Install API 라우트
 * 게임 서버 초기 설정을 위한 API
 */

import { Router } from 'express';
import { InstallService } from '../services/install.service';
import { User } from '../models/user.model';
import { Session } from '../models/session.model';
import { mongoConnection } from '../db/connection';

const router = Router();

/**
 * @swagger
 * /api/install/check:
 *   get:
 *     summary: 설치 상태 확인
 *     description: 서버가 이미 설치되어 있는지 확인합니다.
 *     tags: [Install]
 *     responses:
 *       200:
 *         description: 설치 상태 확인 성공
 */
router.get('/check', async (req, res) => {
  try {
    const isInstalled = await InstallService.checkInstallation();
    
    res.json({
      success: true,
      installed: isInstalled
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
 * /api/install/database:
 *   post:
 *     summary: 데이터베이스 연결 확인
 *     description: MongoDB 연결 상태를 확인합니다.
 *     tags: [Install]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mongodb_uri:
 *                 type: string
 *                 description: MongoDB 연결 URI
 */
router.post('/database', async (req, res) => {
  try {
    const { mongodb_uri } = req.body;
    
    if (!mongodb_uri) {
      return res.status(400).json({
        success: false,
        message: 'MongoDB 연결 주소가 필요합니다.'
      });
    }


    const result = await InstallService.testDatabaseConnection(mongodb_uri);
    
    res.json({
      success: result.success,
      message: result.message,
      details: result.details
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
 * /api/install/admin:
 *   post:
 *     summary: 관리자 계정 생성
 *     description: 최초 관리자 계정을 생성합니다.
 *     tags: [Install]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *               - name
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               name:
 *                 type: string
 */
router.post('/admin', async (req, res) => {
  try {
    const { username, password, name } = req.body;
    
    if (!username || !password || !name) {
      return res.status(400).json({
        success: false,
        message: '사용자명·비밀번호·이름을 모두 입력해야 합니다.'
      });
    }


    // 이미 설치되어 있는지 확인
    const isInstalled = await InstallService.checkInstallation();
    if (isInstalled) {
      return res.status(400).json({
        success: false,
        message: '이미 설치가 완료되었습니다'
      });
    }

    const result = await InstallService.createAdminUser(username, password, name);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    res.json({
      success: true,
      message: '관리자 계정이 생성되었습니다',
      userId: result.userId
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
 * /api/install/session:
 *   post:
 *     summary: 기본 세션 생성
 *     description: 기본 게임 세션을 생성합니다.
 *     tags: [Install]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               session_id:
 *                 type: string
 *                 default: sangokushi_default
 *               session_name:
 *                 type: string
 *                 default: 삼국지 일반
 *               scenario_id:
 *                 type: string
 *                 default: sangokushi
 */
router.post('/session', async (req, res) => {
  try {
    const {
      session_id = 'sangokushi_default',
      session_name = '삼국지 일반',
      scenario_id = 'sangokushi'
    } = req.body;

    // 이미 설치되어 있는지 확인
    const isInstalled = await InstallService.checkInstallation();
    if (isInstalled) {
      return res.status(400).json({
        success: false,
        message: '이미 설치가 완료되었습니다'
      });
    }

    const result = await InstallService.createDefaultSession(session_id, session_name, scenario_id);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    res.json({
      success: true,
      message: '기본 세션이 생성되었습니다',
      sessionId: result.sessionId
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
 * /api/install/complete:
 *   post:
 *     summary: 설치 완료
 *     description: 설치를 완료하고 설정을 저장합니다.
 *     tags: [Install]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               config:
 *                 type: object
 *                 description: 서버 설정
 */
router.post('/complete', async (req, res) => {
  try {
    const { config } = req.body;

    const result = await InstallService.completeInstallation(config);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    res.json({
      success: true,
      message: '설치가 완료되었습니다'
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
 * /api/install/file-install:
 *   post:
 *     summary: 파일 기반 설치
 *     description: 파일을 통한 설치를 수행합니다. 초기 설정 파일 업로드 등에 사용됩니다.
 *     tags: [Install]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *                 description: 수행할 액션 (check, install, verify)
 *               config:
 *                 type: object
 *                 description: 설치 설정
 *     responses:
 *       200:
 *         description: 파일 설치 성공
 *       400:
 *         description: 잘못된 요청
 */
router.post('/file-install', async (req, res) => {
  try {
    const { action = 'check', config } = req.body;

    switch (action) {
      case 'check':
        // 설치 상태 확인
        const isInstalled = await InstallService.checkInstallation();
        return res.json({
          result: true,
          installed: isInstalled,
          message: isInstalled ? '이미 설치되어 있습니다' : '설치가 필요합니다'
        });

      case 'install':
        // 이미 설치되어 있는지 확인
        const alreadyInstalled = await InstallService.checkInstallation();
        if (alreadyInstalled) {
          return res.json({
            result: false,
            reason: '이미 설치가 완료되었습니다'
          });
        }

        // 설치 수행
        const installResult = await InstallService.completeInstallation(config || {});
        return res.json({
          result: installResult.success,
          reason: installResult.message
        });

      case 'verify':
        // 설치 검증
        const verifyResult = await InstallService.checkInstallation();
        return res.json({
          result: true,
          verified: verifyResult,
          message: verifyResult ? '설치가 정상적으로 완료되었습니다' : '설치가 필요합니다'
        });

      default:
        return res.status(400).json({
          result: false,
          reason: `알 수 없는 액션입니다: ${action}`
        });
    }
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message || '서버 오류가 발생했습니다'
    });
  }
});

/**
 * @swagger
 * /api/install/status:
 *   post:
 *     summary: 설치 상태 확인 (POST)
 *     description: 서버의 설치 상태를 확인합니다. (POST 버전)
 *     tags: [Install]
 *     responses:
 *       200:
 *         description: 설치 상태 확인 성공
 */
router.post('/status', async (req, res) => {
  try {
    const isInstalled = await InstallService.checkInstallation();
    
    res.json({
      result: true,
      installed: isInstalled,
      status: isInstalled ? 'installed' : 'not_installed'
    });
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message
    });
  }
});

export default router;


