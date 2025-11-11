// @ts-nocheck - Type issues need investigation
import { Router } from 'express';
import { User } from '../models/user.model';
import { Session } from '../models/session.model';
import { authenticate } from '../middleware/auth';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

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

    const user = await User.findById(userId);
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
        maxnation: gameEnv.maxnation || 12
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
      // TODO: member_log 테이블에 로그 기록
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
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { password, newPassword, globalSalt } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        result: false,
        reason: '인증이 필요합니다'
      });
    }

    if (!password || !newPassword) {
      return res.status(400).json({
        result: false,
        reason: '현재 비밀번호와 새 비밀번호를 입력해주세요'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        result: false,
        reason: '새 비밀번호는 최소 6자 이상이어야 합니다'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        result: false,
        reason: '사용자를 찾을 수 없습니다'
      });
    }

    // 현재 비밀번호 확인
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({
        result: false,
        reason: '현재 비밀번호가 올바르지 않습니다'
      });
    }

    // 새 비밀번호 해시
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // 비밀번호 업데이트
    await User.findByIdAndUpdate(userId, {
      password: hashedNewPassword
    });

    res.json({
      result: true,
      reason: '비밀번호가 변경되었습니다'
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
 *               globalSalt:
 *                 type: string
 *                 description: 전역 솔트 (선택)
 *     responses:
 *       200:
 *         description: 계정 삭제 성공
 *       400:
 *         description: 잘못된 요청
 */
router.post('/delete-me', authenticate, async (req, res) => {
  try {
    const { password, globalSalt } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        result: false,
        reason: '인증이 필요합니다'
      });
    }

    if (!password) {
      return res.status(400).json({
        result: false,
        reason: '비밀번호를 입력해주세요'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        result: false,
        reason: '사용자를 찾을 수 없습니다'
      });
    }

    // 비밀번호 확인
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({
        result: false,
        reason: '비밀번호가 올바르지 않습니다'
      });
    }

    // 계정 소프트 삭제 (30일 후 삭제)
    const deleteAfter = new Date();
    deleteAfter.setDate(deleteAfter.getDate() + 30);
    
    await User.findByIdAndUpdate(userId, {
      delete_after: deleteAfter,
      deleted: true
    });
    
    // 관련 데이터 정리 (선택사항 - 소프트 삭제 시에는 유지)
    // TODO: 필요시 장수 데이터 anonymize 처리
    // const generals = await General.find({ owner: String(userId) });
    // for (const general of generals) {
    //   general.owner = null; // 또는 익명화
    //   await general.save();
    // }
    
    // 로그 기록
    // TODO: member_log 테이블에 삭제 로그 기록
    // await MemberLog.create({ member_no: userId, action_type: 'delete' });
    
    // 세션 종료
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const { tokenBlacklist } = await import('../utils/tokenBlacklist');
      tokenBlacklist.add(token, 7 * 24 * 60 * 60);
    }

    res.json({
      result: true,
      reason: '계정이 삭제되었습니다'
    });
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message || '서버 오류가 발생했습니다'
    });
  }
});

export default router;



