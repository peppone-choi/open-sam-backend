import { Request, Response, NextFunction } from 'express';
import { Gin7User, IGin7User } from '../models/gin7/User';

/**
 * Admin 권한 등급
 */
export type AdminRole = 'root' | 'gm' | 'observer';

export interface Gin7AdminPayload {
  userId: string;
  username: string;
  role: AdminRole;
}

/**
 * Gin7 Admin 인증 미들웨어
 * gin7User 테이블의 role 필드로 권한 확인
 */
export const requireGin7Admin = (minRole: AdminRole = 'observer') => {
  const roleHierarchy: Record<AdminRole, number> = {
    observer: 1,
    gm: 2,
    root: 3
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 기존 인증 미들웨어에서 추출한 사용자 정보
      const user = (req as any).user;
      
      if (!user?.userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다'
        });
      }

      // Gin7User에서 권한 정보 조회
      const gin7User = await Gin7User.findOne({ userId: user.userId })
        .select('userId username role isBanned')
        .lean() as unknown as IGin7User | null;

      if (!gin7User) {
        return res.status(403).json({
          success: false,
          message: 'Gin7 관리자 권한이 없습니다'
        });
      }

      if (gin7User.isBanned) {
        return res.status(403).json({
          success: false,
          message: '정지된 계정입니다'
        });
      }

      // role 검증 - 'admin' role을 가진 사용자만 허용
      if (gin7User.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: '관리자 권한이 필요합니다'
        });
      }

      // 세부 권한은 preferences에서 조회 (없으면 observer)
      const adminRole = (gin7User.preferences?.adminRole as AdminRole) || 'observer';
      const userLevel = roleHierarchy[adminRole] || 0;
      const requiredLevel = roleHierarchy[minRole];

      if (userLevel < requiredLevel) {
        return res.status(403).json({
          success: false,
          message: `${minRole} 이상의 권한이 필요합니다`
        });
      }

      // Admin 정보를 request에 저장
      (req as any).gin7Admin = {
        userId: gin7User.userId,
        username: gin7User.username,
        role: adminRole
      } as Gin7AdminPayload;

      next();
    } catch (error: any) {
      console.error('[Gin7Admin] 권한 검증 오류:', error?.message || error);
      return res.status(500).json({
        success: false,
        message: '권한 검증 중 오류가 발생했습니다'
      });
    }
  };
};

/**
 * Root 권한 필수 미들웨어 (단축형)
 */
export const requireRoot = requireGin7Admin('root');

/**
 * GM 권한 필수 미들웨어 (단축형)
 */
export const requireGM = requireGin7Admin('gm');

/**
 * Observer 권한 필수 미들웨어 (단축형)
 */
export const requireObserver = requireGin7Admin('observer');

