import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// JWT 토큰 페이로드 타입
export interface JwtPayload {
  userId: string;
  username: string;
  sessionId?: string;
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
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false,
        message: '인증 토큰이 없습니다' 
      });
    }

    // 토큰 추출
    const token = authHeader.substring(7); // 'Bearer ' 이후
    
    // JWT 검증
    const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const decoded = jwt.verify(token, secret) as unknown as JwtPayload;
    
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
