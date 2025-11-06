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
    }
  }
}

export {};
