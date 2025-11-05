/**
 * OAuth Service
 * 소셜 로그인 처리를 담당하는 서비스
 */

import axios from 'axios';
import { logger } from '../common/logger';

export interface OAuthResult {
  success: boolean;
  message: string;
  accessToken?: string;
  refreshToken?: string;
  userInfo?: any;
}

export class OAuthService {
  /**
   * 카카오 인증 URL 생성
   */
  static getKakaoAuthUrl(redirectUri: string): string {
    const clientId = process.env.KAKAO_CLIENT_ID;
    if (!clientId) {
      throw new Error('KAKAO_CLIENT_ID 환경 변수가 설정되지 않았습니다');
    }

    const state = require('crypto').randomBytes(16).toString('hex');
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state
    });

    return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
  }

  /**
   * 카카오 액세스 토큰 획득
   */
  static async getKakaoAccessToken(code: string): Promise<OAuthResult> {
    try {
      const clientId = process.env.KAKAO_CLIENT_ID;
      const clientSecret = process.env.KAKAO_CLIENT_SECRET;
      const redirectUri = process.env.KAKAO_REDIRECT_URI || 'http://localhost:8080/api/oauth/kakao/callback';

      if (!clientId) {
        return {
          success: false,
          message: 'KAKAO_CLIENT_ID 환경 변수가 설정되지 않았습니다'
        };
      }

      const response = await axios.post(
        'https://kauth.kakao.com/oauth/token',
        new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret || '',
          redirect_uri: redirectUri,
          code
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return {
        success: true,
        message: '액세스 토큰 획득 성공',
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token
      };
    } catch (error: any) {
      logger.error('카카오 액세스 토큰 획득 실패', {
        error: error.message,
        response: error.response?.data
      });

      return {
        success: false,
        message: `카카오 액세스 토큰 획득 실패: ${error.response?.data?.error_description || error.message}`
      };
    }
  }

  /**
   * 카카오 사용자 정보 조회
   */
  static async getKakaoUserInfo(accessToken: string): Promise<OAuthResult> {
    try {
      const response = await axios.get('https://kapi.kakao.com/v2/user/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      return {
        success: true,
        message: '사용자 정보 조회 성공',
        userInfo: response.data
      };
    } catch (error: any) {
      logger.error('카카오 사용자 정보 조회 실패', {
        error: error.message,
        response: error.response?.data
      });

      return {
        success: false,
        message: `카카오 사용자 정보 조회 실패: ${error.response?.data?.error_description || error.message}`
      };
    }
  }

  /**
   * 카카오 연결 해제
   */
  static async unlinkKakao(oauthId: string): Promise<OAuthResult> {
    try {
      // 관리자 키를 사용하여 연결 해제
      const adminKey = process.env.KAKAO_ADMIN_KEY;
      if (!adminKey) {
        return {
          success: false,
          message: 'KAKAO_ADMIN_KEY 환경 변수가 설정되지 않았습니다'
        };
      }

      const response = await axios.post(
        'https://kapi.kakao.com/v1/user/unlink',
        {
          target_id_type: 'user_id',
          target_id: oauthId
        },
        {
          headers: {
            Authorization: `KakaoAK ${adminKey}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return {
        success: true,
        message: '카카오 연결 해제 성공'
      };
    } catch (error: any) {
      logger.error('카카오 연결 해제 실패', {
        error: error.message,
        response: error.response?.data
      });

      return {
        success: false,
        message: `카카오 연결 해제 실패: ${error.response?.data?.error_description || error.message}`
      };
    }
  }

  /**
   * 사용 가능한 OAuth 제공자 목록
   */
  static getAvailableProviders(): Array<{ id: string; name: string; enabled: boolean }> {
    const providers = [
      {
        id: 'kakao',
        name: '카카오',
        enabled: !!process.env.KAKAO_CLIENT_ID
      }
      // 추후 다른 제공자 추가 가능
      // {
      //   id: 'google',
      //   name: 'Google',
      //   enabled: !!process.env.GOOGLE_CLIENT_ID
      // },
      // {
      //   id: 'naver',
      //   name: '네이버',
      //   enabled: !!process.env.NAVER_CLIENT_ID
      // }
    ];

    return providers;
  }
}


