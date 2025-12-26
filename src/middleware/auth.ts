import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../models/user.model';
import { configManager } from '../config/ConfigManager';

const { jwtSecret } = configManager.get().system;

// JWT 토큰 페이로드 타입
export interface JwtPayload {
  userId: string;
  id?: string;
  username?: string;
  sessionId?: string;
  generalId?: number;
  acl?: string;
  grade?: number; // 사용자 등급 (5 이상이 어드민)
  role?: string; // 역할 추가
  // global_salt 기반 토큰 바인딩용 선택적 필드
  globalSaltHash?: string;
}

// global_salt 기반 해시 계산 함수
function computeGlobalSaltHash(globalSalt?: string | null): string | null {
  if (!globalSalt) {
    return null;
  }
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return crypto
    .createHmac('sha256', jwtSecret)
    .update(globalSalt)
    .digest('hex');
}

/**
 * JWT 인증 미들웨어
 * Authorization 헤더 또는 쿠키에서 토큰을 추출하고 검증
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    const cookieToken = (req as any).cookies?.authToken;

    let token: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (cookieToken) {
      token = String(cookieToken);
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '인증 토큰이 없습니다',
      });
    }

    // 토큰 블랙리스트 체크
    const { tokenBlacklist } = await import('../utils/tokenBlacklist');
    if (tokenBlacklist.has(token)) {
      return res.status(401).json({
        success: false,
        message: '로그아웃된 토큰입니다',
      });
    }

    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not configured');
    }

    const decoded = jwt.verify(token, jwtSecret) as JwtPayload & {
      iat?: number;
    };

    if (!decoded.userId) {
      return res.status(401).json({
        success: false,
        message: '유효하지 않은 토큰입니다 (사용자 정보 없음)',
      });
    }

    // 사용자 정보 로드 (토큰 무효화/글로벌 솔트 검증용)
    const user = await (User as any)
      .findById(decoded.userId)
      .select('token_valid_until global_salt deleted')
      .lean();

    if (!user || (user as any).deleted) {
      return res.status(401).json({
        success: false,
        message: '존재하지 않거나 삭제된 계정입니다',
      });
    }

    // 1) token_valid_until 기반 글로벌 로그아웃
    if (user.token_valid_until && decoded.iat) {
      const tokenIssuedAtMs = decoded.iat * 1000;
      const epochMs = new Date(user.token_valid_until as any).getTime();
      if (tokenIssuedAtMs < epochMs) {
        return res.status(401).json({
          success: false,
          message: '보안 설정이 변경되어 다시 로그인해야 합니다',
          reason: 'TOKEN_EPOCH_EXPIRED',
        });
      }
    }

    // 2) global_salt 기반 바인딩 (선택적)
    if (decoded.globalSaltHash) {
      const expectedHash = computeGlobalSaltHash((user as any).global_salt as string | undefined);
      if (!expectedHash || expectedHash !== decoded.globalSaltHash) {
        return res.status(401).json({
          success: false,
          message: '보안 토큰이 더 이상 유효하지 않습니다',
          reason: 'GLOBAL_SALT_MISMATCH',
        });
      }
    }

    (req as any).user = decoded;
    return next();
  } catch (error: any) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        message: '유효하지 않은 토큰입니다',
      });
    }
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        message: '토큰이 만료되었습니다',
      });
    }

    return res.status(500).json({
      success: false,
      message: '인증 처리 중 오류가 발생했습니다',
    });
  }
};

/**
 * 선택적 인증 미들웨어
 * 토큰이 있으면 검증하고, 없어도 다음으로 진행
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    const cookieToken = (req as any).cookies?.authToken;

    let token: string | null = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (cookieToken) {
      token = String(cookieToken);
    }

    if (token && jwtSecret) {
      const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
      (req as any).user = decoded;
    }
  } catch {
    // 토큰이 유효하지 않아도 계속 진행
  } finally {
    next();
  }
};

/**
 * 전역 JWT 토큰 자동 추출 미들웨어
 * 모든 요청에 대해 토큰이 있으면 자동으로 추출하여 req.user에 저장
 */
export const autoExtractToken = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    if ((req as any).user) {
      return next();
    }

    let token: string | null = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (!token) {
      try {
        const cookies = (req as any).cookies;
        const cookieToken = cookies?.token || cookies?.authToken;
        if (cookieToken) {
          token = String(cookieToken);
        }
      } catch {
        // 쿠키 파서가 없어도 계속 진행
      }
    }

    if (token && jwtSecret) {
      try {
        const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
        (req as any).user = decoded;
      } catch {
        // optionalAuth와 동일한 동작: 실패해도 진행
      }
    }
  } catch {
    // 에러가 발생해도 요청은 계속 진행
  } finally {
    next();
  }
};

/**
 * 세션 검증 미들웨어
 */
export const validateSession = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const userSessionId = (req as any).user?.sessionId;
  const requestSessionId =
    (req.body as any).sessionId ||
    (req.params as any).sessionId ||
    (req.query as any).sessionId;

  if (!userSessionId) {
    return res.status(400).json({
      success: false,
      message: '사용자 세션 정보가 없습니다',
    });
  }

  if (userSessionId !== requestSessionId) {
    return res.status(403).json({
      success: false,
      message: '세션이 일치하지 않습니다',
    });
  }

  next();
};
