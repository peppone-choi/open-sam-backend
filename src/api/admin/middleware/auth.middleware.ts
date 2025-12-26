import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AdminPermission } from '../@types/admin.types';
import { JwtPayload } from '../../../middleware/auth';
import { configManager } from '../../../config/ConfigManager';

const { jwtSecret } = configManager.get().system;

/**
 * Admin 인증 미들웨어
 * JWT 토큰에서 사용자 등급 확인 (grade >= 5)
 */
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Admin access required' });
    }

    const token = authHeader.substring(7);
    if (!jwtSecret) {
      return res.status(500).json({ error: 'JWT_SECRET is not configured' });
    }
    const decoded = jwt.verify(token, jwtSecret) as unknown as JwtPayload;
    
    const grade = decoded.grade || 1;
    if (grade < 5) {
      return res.status(403).json({ 
        error: 'Forbidden: Admin access required (grade >= 5)',
        currentGrade: grade
      });
    }
    
    req.admin = {
      id: decoded.userId,
      username: decoded.username,
      grade: grade,
      role: grade >= 9 ? 'SUPER_ADMIN' : grade >= 7 ? 'ADMIN' : 'MODERATOR',
      permissions: Object.values(AdminPermission),
    };
    
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) return res.status(401).json({ error: 'Invalid token' });
    if (error instanceof jwt.TokenExpiredError) return res.status(401).json({ error: 'Token expired' });
    return res.status(500).json({ error: 'Authentication error' });
  }
};

export const requirePermission = (permission: AdminPermission) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const admin = req.admin;
    if (!admin) return res.status(401).json({ error: 'Unauthorized' });
    if (!admin.permissions.includes(permission)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions', required: permission });
    }
    next();
  };
};

export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  const admin = req.admin;
  if (!admin) return res.status(401).json({ error: 'Unauthorized' });
  if (admin.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Forbidden: Super admin access required' });
  next();
};
