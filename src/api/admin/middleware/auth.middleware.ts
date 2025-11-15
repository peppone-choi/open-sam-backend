import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AdminPermission } from '../@types/admin.types';
import { JwtPayload } from '../../../middleware/auth';

/**
 * Admin 인증 미들웨어
 * JWT 토큰에서 사용자 등급 확인 (grade >= 5)
 */
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Authorization 헤더에서 토큰 추출
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Admin access required' });
    }

    // 토큰 검증
    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET || 'secret';
    const decoded = jwt.verify(token, secret) as unknown as JwtPayload;
    
    // 등급 확인 (5 이상이 어드민)
    const grade = decoded.grade || 1;
    if (grade < 5) {
      return res.status(403).json({ 
        error: 'Forbidden: Admin access required (grade >= 5)',
        currentGrade: grade
      });
    }
    
    // 어드민 정보를 req.admin에 저장
    req.admin = {
      id: decoded.userId,
      username: decoded.username,
      grade: grade,
      role: grade >= 9 ? 'SUPER_ADMIN' : grade >= 7 ? 'ADMIN' : 'MODERATOR',
      permissions: Object.values(AdminPermission), // FUTURE: 실제 권한 체계 구현 시 수정
    };
    
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(500).json({ error: 'Authentication error' });
  }
};

/**
 * 특정 권한 필요
 */
export const requirePermission = (permission: AdminPermission) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const admin = req.admin;
    
    if (!admin) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (!admin.permissions.includes(permission)) {
      return res.status(403).json({ 
        error: 'Forbidden: Insufficient permissions',
        required: permission 
      });
    }
    
    next();
  };
};

/**
 * 슈퍼 관리자만
 */
export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  const admin = req.admin;
  
  if (!admin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  if (admin.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Forbidden: Super admin access required' });
  }
  
  next();
};
