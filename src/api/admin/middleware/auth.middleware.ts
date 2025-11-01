import { Request, Response, NextFunction } from 'express';
import { AdminPermission } from '../@types/admin.types';

/**
 * Admin 인증 미들웨어
 * TODO: JWT 토큰 검증 구현
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  // TODO: JWT 토큰에서 사용자 정보 추출
  const adminId = req.headers['x-admin-id'] as string;
  
  if (!adminId) {
    return res.status(401).json({ error: 'Unauthorized: Admin access required' });
  }
  
  // TODO: Admin 사용자 DB 조회 및 검증
  (req as any).admin = {
    id: adminId,
    username: 'admin', // TODO: DB에서 조회
    role: 'SUPER_ADMIN',
    permissions: Object.values(AdminPermission),
  };
  
  next();
};

/**
 * 특정 권한 필요
 */
export const requirePermission = (permission: AdminPermission) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const admin = (req as any).admin;
    
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
  const admin = (req as any).admin;
  
  if (!admin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  if (admin.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Forbidden: Super admin access required' });
  }
  
  next();
};
