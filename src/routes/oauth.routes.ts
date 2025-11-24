// @ts-nocheck - Type issues need investigation
/**
 * OAuth API 라우트
 * 카카오 등 소셜 로그인을 위한 API
 */

import { Router } from 'express';
import { OAuthService } from '../services/oauth.service';
import { User } from '../models/user.model';
import * as jwt from 'jsonwebtoken';
import { OAuthStateService } from '../services/oauth/OAuthState.service';
import { ApiError } from '../errors/ApiError';

const router = Router();

/**
 * @swagger
 * /api/oauth/kakao/authorize:
 *   get:
 *     summary: 카카오 OAuth 인증 URL 생성
 *     description: 카카오 로그인을 위한 인증 URL을 반환합니다.
 *     tags: [OAuth]
 *     responses:
 *       200:
 *         description: 인증 URL 생성 성공
 */
router.get('/kakao/authorize', async (req, res) => {
  try {
    const redirectUri = (req.query.redirect_uri as string) || process.env.KAKAO_REDIRECT_URI || 'http://localhost:3000/api/oauth/kakao/callback';
    const state = await OAuthStateService.issueState({ redirectUri });
    const authUrl = OAuthService.getKakaoAuthUrl(redirectUri, state);
    
    res.json({
      success: true,
      authUrl,
      state
    });
  } catch (error: any) {
    const status = error instanceof ApiError ? error.status : 500;
    res.status(status).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/oauth/kakao/callback:
 *   get:
 *     summary: 카카오 OAuth 콜백 처리
 *     description: 카카오 로그인 콜백을 처리하고 JWT 토큰을 발급합니다.
 *     tags: [OAuth]
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: 카카오 인증 코드
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: 상태 토큰
 */
router.get('/kakao/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        message: '인증 코드가 필요합니다'
      });
    }

    if (!state) {
      return res.status(400).json({
        success: false,
        message: '상태 토큰이 누락되었습니다'
      });
    }

    await OAuthStateService.consumeState(String(state));

    // 카카오 액세스 토큰 획득
    const tokenResult = await OAuthService.getKakaoAccessToken(code as string);
    if (!tokenResult.success) {
      return res.status(400).json({
        success: false,
        message: tokenResult.message
      });
    }

    // 카카오 사용자 정보 조회
    const userInfoResult = await OAuthService.getKakaoUserInfo(tokenResult.accessToken!);
    if (!userInfoResult.success) {
      return res.status(400).json({
        success: false,
        message: userInfoResult.message
      });
    }

    const kakaoUserInfo = userInfoResult.userInfo!;

    // 사용자 조회 또는 생성
    let user = await User.findOne({ 
      oauth_type: 'kakao',
      'oauth_id': String(kakaoUserInfo.id)
    }).select('-password');

    if (!user) {
      // 새 사용자 생성
      user = new User({
        username: `kakao_${kakaoUserInfo.id}`,
        name: kakaoUserInfo.properties?.nickname || kakaoUserInfo.kakao_account?.profile?.nickname || '카카오 사용자',
        oauth_type: 'kakao',
        oauth_id: String(kakaoUserInfo.id),
        picture: kakaoUserInfo.properties?.profile_image || kakaoUserInfo.kakao_account?.profile?.profile_image_url || '',
        grade: 1,
        global_salt: require('crypto').randomBytes(16).toString('hex')
      });

      await user.save();
    } else {
      // 사용자 정보 업데이트
      if (kakaoUserInfo.properties?.nickname) {
        user.name = kakaoUserInfo.properties.nickname;
      }
      if (kakaoUserInfo.properties?.profile_image) {
        user.picture = kakaoUserInfo.properties.profile_image;
      }
      await user.save();
    }

    // JWT 토큰 발급
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured');
    }
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        username: user.username,
        grade: user.grade || 1
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 프론트엔드로 리다이렉트 (토큰을 포함)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/callback?token=${token}&success=true`);
  } catch (error: any) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/callback?success=false&error=${encodeURIComponent(error.message)}`);
  }
});

/**
 * @swagger
 * /api/oauth/kakao/unlink:
 *   post:
 *     summary: 카카오 계정 연결 해제
 *     description: 카카오 계정 연결을 해제합니다.
 *     tags: [OAuth]
 *     security:
 *       - bearerAuth: []
 */
router.post('/kakao/unlink', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: '인증이 필요합니다'
      });
    }

    const token = authHeader.substring(7);
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: 'JWT_SECRET is not configured'
      });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as { userId: string };

    const user = await User.findById(decoded.userId).select('-password');
    if (!user || user.oauth_type !== 'kakao' || !user.oauth_id) {
      return res.status(400).json({
        success: false,
        message: '카카오 계정이 연결되어 있지 않습니다'
      });
    }

    // 카카오 연결 해제
    const result = await OAuthService.unlinkKakao(user.oauth_id);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    // 사용자 정보에서 OAuth 정보 제거
    user.oauth_type = null;
    user.oauth_id = null;
    await user.save();

    res.json({
      success: true,
      message: '카카오 계정 연결이 해제되었습니다'
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
 * /api/oauth/providers:
 *   get:
 *     summary: 지원하는 OAuth 제공자 목록
 *     description: 사용 가능한 OAuth 제공자 목록을 반환합니다.
 *     tags: [OAuth]
 */
router.get('/providers', async (req, res) => {
  try {
    const providers = OAuthService.getAvailableProviders();
    
    res.json({
      success: true,
      providers
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;


