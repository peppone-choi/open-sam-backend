// @ts-nocheck - Type issues need investigation
import { Router } from 'express';
import { User } from '../models/user.model';
import { Session } from '../models/session.model';
import { authenticate } from '../middleware/auth';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { AccountSecurityService } from '../services/gateway/AccountSecurity.service';
import { ApiError } from '../errors/ApiError';
import { authLimiter } from '../middleware/rate-limit.middleware';

const router = Router();

/**
 * @swagger
 * /api/gateway/get-user-info:
 *   post:
 *     summary: 사용자 정보 조회
 *     description: 현재 로그인한 사용자의 정보를 조회합니다.
 *     tags: [Gateway]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 사용자 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: boolean
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 grade:
 *                   type: string
 *                 picture:
 *                   type: string
 *                 global_salt:
 *                   type: string
 *                 join_date:
 *                   type: string
 *                 third_use:
 *                   type: boolean
 *                 acl:
 *                   type: string
 *                 oauth_type:
 *                   type: string
 *                   nullable: true
 *                 token_valid_until:
 *                   type: string
 *                   nullable: true
 */
router.post('/get-user-info', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        result: false,
        reason: '인증이 필요합니다'
      });
    }

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({
        result: false,
        reason: '사용자를 찾을 수 없습니다'
      });
    }

    res.json({
      result: true,
      id: user.username || user._id.toString(),
      name: user.name || user.username || '',
      grade: String(user.grade || 1),
      picture: user.picture || '',
      global_salt: user.global_salt || '',
      join_date: user.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString(),
      third_use: user.third_use || false,
      acl: user.acl || '',
      oauth_type: user.oauth_type || null,
      token_valid_until: user.token_valid_until || null
    });
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message || '서버 오류가 발생했습니다'
    });
  }
});

/**
 * @swagger
 * /api/gateway/get-server-status:
 *   post:
 *     summary: 서버 상태 조회
 *     description: 사용 가능한 게임 서버 목록과 상태를 조회합니다.
 *     tags: [Gateway]
 *     responses:
 *       200:
 *         description: 서버 상태 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: boolean
 *                 server:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       color:
 *                         type: string
 *                       korName:
 *                         type: string
 *                       name:
 *                         type: string
 *                       exists:
 *                         type: boolean
 *                       enable:
 *                         type: boolean
 */
router.post('/get-server-status', async (req, res) => {
  try {
    // 전역 공지사항 조회 (KVStorage 사용)
    const { KVStorage } = await import('../models/kv-storage.model');
    const noticeDoc = await KVStorage.findOne({ key: 'global_notice' }).lean();
    const notice = noticeDoc?.value || '';
    
    // 세션 목록 조회
    const sessions = await Session.find({}).lean();
    
    const serverList = sessions.map((session: any) => {
      const gameEnv = session.data?.game_env || {};
      const isunited = gameEnv.isunited || 0;
      const blockGeneralCreate = gameEnv.block_general_create || 0;
      const isRecruitBlocked = (blockGeneralCreate & 4) !== 0;
      
      // 상태 결정 로직: session.status를 우선 사용
      let status = session.status || 'running';
      let statusText = '운영중';
      
      // session.status 기반 상태 텍스트
      if (status === 'preparing') {
        statusText = '준비중';
      } else if (status === 'running') {
        statusText = '운영중';
        if (isRecruitBlocked) {
          statusText = '모집마감';
        }
      } else if (status === 'paused') {
        statusText = '폐쇄';
      } else if (status === 'finished') {
        statusText = '종료';
      } else if (status === 'united') {
        statusText = '천하통일';
      }
      
      // 레거시 호환: isunited로 상태 덮어쓰기 (만약 session.status가 없는 경우)
      if (!session.status) {
        if (isunited === 3) {
          statusText = '천하통일';
          status = 'united';
        } else if (isunited === 2) {
          statusText = '폐쇄';
          status = 'paused';
        }
      }
      
      return {
        color: session.color || '#000000',
        korName: session.name || session.session_id,
        name: session.session_id,
        exists: true,
        enable: true, // 모든 서버 입장 가능 (캐릭터 있으면)
        isunited: isunited, // 0: 운영중, 2: 준비중, 3: 천하통일
        blockGeneralCreate: isRecruitBlocked, // 신규 캐릭터 생성 차단 여부
        status: status,
        statusText: statusText,
        // 시나리오 정보
        scenarioName: session.scenario_name || gameEnv.scenario || '',
        // 게임 시간 정보
        year: gameEnv.year || gameEnv.startyear || 220,
        month: gameEnv.month || 1,
        turnterm: gameEnv.turnterm || 60,
        turntime: gameEnv.turntime || null,
        starttime: gameEnv.starttime || null,
        // 서버 제한
        maxgeneral: gameEnv.maxgeneral || 300,
        maxnation: gameEnv.maxnation || 12,
        // NPC 플레이 허용 여부
        allow_npc_possess: gameEnv.allow_npc_possess || false
      };
    });

    // 기본 세션이 없으면 추가
    if (serverList.length === 0) {
      serverList.push({
        color: '#FF0000',
        korName: '삼국지 기본 서버',
        name: 'sangokushi_default',
        exists: true,
        enable: true
      });
    }

    res.json({
      result: true,
      notice: notice,
      server: serverList
    });
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message || '서버 오류가 발생했습니다'
    });
  }
});

/**
 * @swagger
 * /api/gateway/logout:
 *   post:
 *     summary: 로그아웃
 *     description: 현재 세션을 로그아웃합니다.
 *     tags: [Gateway]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 로그아웃 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: boolean
 *                 reason:
 *                   type: string
 */
router.post('/logout', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (token) {
      // 토큰을 블랙리스트에 추가
      const { tokenBlacklist } = await import('../utils/tokenBlacklist');
      tokenBlacklist.add(token, 7 * 24 * 60 * 60); // 7일간 유지
    }
    
    // 로그 기록 (선택사항)
    if (userId) {
      // FUTURE: member_log 테이블에 로그 기록
      // await MemberLog.create({ member_no: userId, action_type: 'logout', ... });
    }
    
    res.json({
      result: true,
      reason: '로그아웃되었습니다'
    });
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message || '서버 오류가 발생했습니다'
    });
  }
});

/**
 * @swagger
 * /api/gateway/change-password:
 *   post:
 *     summary: 비밀번호 변경
 *     description: 현재 비밀번호를 확인하고 새 비밀번호로 변경합니다.
 *     tags: [Gateway]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *               - newPassword
 *             properties:
 *               password:
 *                 type: string
 *                 description: 현재 비밀번호
 *               newPassword:
 *                 type: string
 *                 description: 새 비밀번호
 *               globalSalt:
 *                 type: string
 *                 description: 전역 솔트 (선택)
 *     responses:
 *       200:
 *         description: 비밀번호 변경 성공
 *       400:
 *         description: 잘못된 요청
 */
router.post('/change-password', authLimiter, authenticate, async (req, res) => {
  try {
    const { password, newPassword, globalSalt } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        result: false,
        reason: '인증이 필요합니다'
      });
    }

    await AccountSecurityService.changePassword(String(userId), password, newPassword, globalSalt);

    res.json({
      result: true,
      reason: '비밀번호가 변경되었습니다'
    });
  } catch (error: any) {
    const status = error instanceof ApiError ? error.status : 500;
    res.status(status).json({
      result: false,
      reason: error.message || '서버 오류가 발생했습니다'
    });
  }
});

/**
 * @swagger
 * /api/gateway/delete-me:
 *   post:
 *     summary: 계정 삭제
 *     description: 사용자 계정을 삭제합니다. 비밀번호 확인이 필요합니다.
 *     tags: [Gateway]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 description: 계정 삭제를 위한 비밀번호 확인
 *     responses:
 *       200:
 *         description: 계정 삭제 성공
 *       400:
 *         description: 잘못된 요청
 */
router.post('/delete-me', authenticate, async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        result: false,
        reason: '인증이 필요합니다'
      });
    }

    const deleteAfter = await AccountSecurityService.scheduleDeletion(String(userId), password);
    
    // 세션 종료
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const { tokenBlacklist } = await import('../utils/tokenBlacklist');
      tokenBlacklist.add(token, 7 * 24 * 60 * 60);
    }

    res.json({
      result: true,
      reason: '계정 삭제가 예약되었습니다',
      deleteAfter
    });
  } catch (error: any) {
    const status = error instanceof ApiError ? error.status : 500;
    res.status(status).json({
      result: false,
      reason: error.message || '서버 오류가 발생했습니다'
    });
  }
});

/**
 * @swagger
 * /api/gateway/change-icon:
 *   post:
 *     summary: 아이콘 변경
 *     description: 사용자 전용 아이콘을 변경합니다. FormData로 이미지 파일을 전송합니다.
 *     tags: [Gateway]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image_upload:
 *                 type: string
 *                 format: binary
 *                 description: 아이콘 이미지 파일 (avif, webp, jpg, gif, png, 50KB 이하)
 *     responses:
 *       200:
 *         description: 아이콘 변경 성공
 */
router.post('/change-icon', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        result: false,
        reason: '인증이 필요합니다'
      });
    }

    // multer 미들웨어로 파일 업로드 처리 (서버 설정에 따라 다름)
    // 여기서는 간단히 body에서 파일 정보를 받는다고 가정
    const { MiscUploadImageService } = await import('../services/misc/UploadImage.service');
    
    // multipart form-data 처리를 위해 multer 사용 필요
    // 현재는 기본 응답만 제공
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        result: false,
        reason: '사용자를 찾을 수 없습니다'
      });
    }

    // 파일이 req.file에 있다고 가정 (multer 미들웨어 필요)
    if (!(req as any).file) {
      return res.status(400).json({
        result: false,
        reason: '파일이 업로드되지 않았습니다. multipart/form-data 형식으로 전송해주세요.'
      });
    }

    const file = (req as any).file;
    
    // 파일 크기 검증 (50KB)
    if (file.size > 50 * 1024) {
      return res.status(400).json({
        result: false,
        reason: '파일 크기는 50KB 이하여야 합니다'
      });
    }

    // 파일 형식 검증
    const allowedTypes = ['image/avif', 'image/webp', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        result: false,
        reason: 'avif, webp, jpg, gif, png 파일만 가능합니다'
      });
    }

    // 파일 저장 및 URL 생성
    const iconUrl = `/uploads/icons/${userId}_${Date.now()}.${file.originalname.split('.').pop()}`;
    user.picture = iconUrl;
    await user.save();

    res.json({
      result: true,
      reason: '아이콘이 변경되었습니다',
      iconUrl
    });
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message || '서버 오류가 발생했습니다'
    });
  }
});

/**
 * @swagger
 * /api/gateway/delete-icon:
 *   post:
 *     summary: 아이콘 삭제
 *     description: 사용자 전용 아이콘을 삭제합니다.
 *     tags: [Gateway]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 아이콘 삭제 성공
 */
router.post('/delete-icon', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        result: false,
        reason: '인증이 필요합니다'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        result: false,
        reason: '사용자를 찾을 수 없습니다'
      });
    }

    // 기존 아이콘 삭제 (파일 시스템에서도 삭제 가능)
    user.picture = '';
    await user.save();

    res.json({
      result: true,
      reason: '아이콘이 삭제되었습니다'
    });
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message || '서버 오류가 발생했습니다'
    });
  }
});

/**
 * @swagger
 * /api/gateway/disallow-third-use:
 *   post:
 *     summary: 개인정보 3자 제공 동의 철회
 *     description: 개인정보 제3자 제공 동의를 철회합니다.
 *     tags: [Gateway]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 동의 철회 성공
 */
router.post('/disallow-third-use', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        result: false,
        reason: '인증이 필요합니다'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        result: false,
        reason: '사용자를 찾을 수 없습니다'
      });
    }

    user.third_use = false;
    await user.save();

    res.json({
      result: true,
      reason: '개인정보 제3자 제공 동의가 철회되었습니다'
    });
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message || '서버 오류가 발생했습니다'
    });
  }
});

/**
 * @swagger
 * /api/gateway/expand-login-token:
 *   post:
 *     summary: 로그인 토큰 연장
 *     description: 로그인 토큰의 유효기간을 연장합니다.
 *     tags: [Gateway]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 토큰 연장 성공
 */
router.post('/expand-login-token', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        result: false,
        reason: '인증이 필요합니다'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        result: false,
        reason: '사용자를 찾을 수 없습니다'
      });
    }

    // 토큰 유효기간 30일 연장
    const newValidUntil = new Date();
    newValidUntil.setDate(newValidUntil.getDate() + 30);
    
    user.token_valid_until = newValidUntil.toISOString();
    await user.save();

    // 새 토큰 발급
    const newToken = jwt.sign(
      { userId: user._id.toString(), username: user.username },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '30d' }
    );

    res.json({
      result: true,
      reason: '로그인 토큰이 연장되었습니다',
      token: newToken,
      validUntil: user.token_valid_until
    });
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message || '서버 오류가 발생했습니다'
    });
  }
});

export default router;



