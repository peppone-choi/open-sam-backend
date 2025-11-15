// @ts-nocheck - Type issues need investigation
import { Router } from 'express';
import { User } from '../models/user.model';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

const router = Router();

// Nonce 저장소 (실제로는 Redis나 DB에 저장해야 함)
const nonceStore = new Map<string, { nonce: string; expiresAt: Date }>();

/**
 * @swagger
 * /api/login/req-nonce:
 *   post:
 *     summary: 로그인 Nonce 요청
 *     description: 로그인을 위한 nonce를 요청합니다.
 *     tags: [Login]
 *     responses:
 *       200:
 *         description: Nonce 요청 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: boolean
 *                   example: true
 *                 nonce:
 *                   type: string
 *                   description: 로그인에 사용할 nonce
 */
router.post('/req-nonce', async (req, res) => {
  try {
    // Nonce 생성
    const nonce = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5분 유효
    
    // 클라이언트 IP 기반으로 저장 (실제로는 세션 ID 등을 사용)
    const ipHeader = req.headers['x-forwarded-for'];
    const clientId = typeof req.ip === 'string' 
      ? req.ip 
      : (Array.isArray(ipHeader) ? ipHeader[0] : (typeof ipHeader === 'string' ? ipHeader : 'unknown'));
    nonceStore.set(clientId, { nonce, expiresAt });
    
    // 5분 후 자동 삭제
    setTimeout(() => {
      nonceStore.delete(clientId);
    }, 5 * 60 * 1000);
    
    res.json({
      result: true,
      nonce
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
 * /api/login/by-token:
 *   post:
 *     summary: 토큰 기반 로그인
 *     description: 저장된 토큰을 사용하여 자동 로그인합니다.
 *     tags: [Login]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tokenID
 *               - token
 *             properties:
 *               tokenID:
 *                 type: number
 *                 description: 토큰 ID
 *               token:
 *                 type: string
 *                 description: 토큰 값
 *     responses:
 *       200:
 *         description: 로그인 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: boolean
 *                   example: true
 *                 reason:
 *                   type: string
 *                   example: 로그인 성공
 *       401:
 *         description: 인증 실패
 */
router.post('/by-token', async (req, res) => {
  try {
    const { tokenID, token } = req.body;
    
    if (!tokenID || !token) {
      return res.status(400).json({
        result: false,
        reason: 'tokenID와 token이 필요합니다'
      });
    }
    
    // FUTURE: 실제로는 login_token 테이블에서 조회해야 함
    // 현재는 JWT 토큰으로 간단히 처리
    try {
      const secret = process.env.JWT_SECRET || 'secret';
      const decoded = jwt.verify(token, secret);
      
      if (typeof decoded === 'string' || !decoded || typeof decoded !== 'object') {
        return res.status(401).json({
          result: false,
          reason: '유효하지 않은 토큰입니다'
        });
      }
      
      const payload = decoded as { userId?: string; username?: string; grade?: number };
      
      if (!payload.userId) {
        return res.status(401).json({
          result: false,
          reason: '토큰에 사용자 정보가 없습니다'
        });
      }
      
      // 사용자 확인
      const user = await User.findById(payload.userId);
      if (!user) {
        return res.status(401).json({
          result: false,
          reason: '사용자를 찾을 수 없습니다'
        });
      }
      
      // 새로운 JWT 토큰 발급
      const newToken = jwt.sign(
        {
          userId: user._id,
          username: user.username,
          grade: user.grade || 1
        },
        secret,
        { expiresIn: '7d' }
      );
      
      res.json({
        result: true,
        reason: '로그인 성공',
        token: newToken,
        userId: user._id
      });
    } catch (jwtError) {
      return res.status(401).json({
        result: false,
        reason: '유효하지 않은 토큰입니다'
      });
    }
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message || '서버 오류가 발생했습니다'
    });
  }
});

export default router;

