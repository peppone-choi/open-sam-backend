import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// JWT 토큰 페이로드 타입
export interface JwtPayload {
  userId: string;
  id?: string;
  username?: string;
  sessionId?: string;
  generalId?: number;
  acl?: string;
  grade?: number; // 사용자 등급 (5 이상이 어드민)
}

// Express Request에 user 속성 추가
declare module 'express-serve-static-core' {
  interface Request {
    user?: JwtPayload;
  }
}

/**
 * JWT 인증 미들웨어
 * Authorization 헤더에서 토큰을 추출하고 검증
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Authorization 헤더 확인
    const authHeader = req.headers.authorization;
    
    console.log('========================================');
    console.log('[Auth] 인증 시도!');
    console.log('Path:', req.path);
    console.log('Authorization Header:', authHeader ? authHeader.substring(0, 30) + '...' : 'NONE');
    console.log('========================================');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[Auth] ❌ 인증 실패 - Authorization 헤더 없음');
      return res.status(401).json({ 
        success: false,
        message: '인증 토큰이 없습니다' 
      });
    }

    // 토큰 추출
    const token = authHeader.substring(7); // 'Bearer ' 이후
    
    // 토큰 블랙리스트 체크
    const { tokenBlacklist } = await import('../utils/tokenBlacklist');
    if (tokenBlacklist.has(token)) {
      return res.status(401).json({ 
        success: false,
        message: '로그아웃된 토큰입니다' 
      });
    }
    
    // JWT 검증
    const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const decoded = jwt.verify(token, secret) as unknown as JwtPayload;
    
    console.log('[Auth] ✅ 인증 성공!');
    console.log('Decoded Token:', JSON.stringify(decoded, null, 2));
    console.log('userId:', decoded.userId);
    console.log('generalId:', decoded.generalId);
    console.log('sessionId:', decoded.sessionId);
    
    // req.user에 사용자 정보 저장
    req.user = decoded;
    
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ 
        success: false,
        message: '유효하지 않은 토큰입니다' 
      });
    }
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ 
        success: false,
        message: '토큰이 만료되었습니다' 
      });
    }
    
    return res.status(500).json({ 
      success: false,
      message: '인증 처리 중 오류가 발생했습니다' 
    });
  }
};

/**
 * 선택적 인증 미들웨어
 * 토큰이 있으면 검증하고, 없어도 다음으로 진행
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
      const decoded = jwt.verify(token, secret) as unknown as JwtPayload;
      req.user = decoded;
    }
    next();
  } catch (error) {
    // 토큰이 유효하지 않아도 계속 진행
    next();
  }
};

/**
 * 전역 JWT 토큰 자동 추출 미들웨어
 * 모든 요청에 대해 토큰이 있으면 자동으로 추출하여 req.user에 저장
 * Authorization 헤더 또는 쿠키에서 토큰을 찾습니다
 */
export const autoExtractToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 이미 user가 설정되어 있으면 스킵
    if (req.user) {
      return next();
    }

    let token: string | null = null;

    // 1. Authorization 헤더에서 토큰 추출
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // 2. 쿠키에서 토큰 추출 (Authorization 헤더에 없을 경우)
    if (!token) {
      // req.cookies는 cookie-parser가 있어야 사용 가능
      // 없어도 에러가 나지 않도록 안전하게 처리
      try {
        const cookieToken = req.cookies?.token || req.cookies?.authToken;
        if (cookieToken) {
          token = cookieToken;
        }
      } catch {
        // 쿠키 파서가 없어도 계속 진행
      }
    }

    // 3. 토큰이 있으면 검증하고 req.user에 저장
    if (token) {
      try {
        const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
        const decoded = jwt.verify(token, secret) as unknown as JwtPayload;
        req.user = decoded;
      } catch (error) {
        // 토큰이 유효하지 않아도 에러를 던지지 않고 계속 진행
        // (optionalAuth와 동일한 동작)
      }
    }

    next();
  } catch (error) {
    // 에러가 발생해도 요청은 계속 진행
    next();
  }
};

/**
 * 세션 검증 미들웨어
 * req.user.sessionId가 req.body.sessionId 또는 req.params.sessionId와 일치하는지 확인
 */
export const validateSession = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const userSessionId = req.user?.sessionId;
  const requestSessionId = req.body.sessionId || req.params.sessionId || req.query.sessionId;
  
  if (!userSessionId) {
    return res.status(400).json({
      success: false,
      message: '사용자 세션 정보가 없습니다'
    });
  }
  
  if (userSessionId !== requestSessionId) {
    return res.status(403).json({
      success: false,
      message: '세션이 일치하지 않습니다'
    });
  }
  
  next();
};
