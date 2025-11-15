import { SessionData } from '../utils/Session';
import { JwtPayload } from '../middleware/auth';

declare global {
  namespace Express {
    interface Request {
      session?: SessionData;
      user?: JwtPayload;
    }
  }
}