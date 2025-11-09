import { JwtPayload } from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId?: string;
        id?: string;
        generalId?: number;
        acl?: string;
      } & JwtPayload;
      admin?: {
        id: string;
        username: string;
        grade: number;
        role: string;
        permissions: string[];
      };
      sessionInstance?: any;
      requestId?: string;
    }
  }
}

export {};
