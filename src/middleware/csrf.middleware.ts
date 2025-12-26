import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { configManager } from '../config/ConfigManager';

const { nodeEnv, disableCsrf, cookieSecure, cookieSameSite } = configManager.get().system;

/**
 * CSRF Protection Middleware
 * Implements Double Submit Cookie pattern
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF for specific paths if needed (e.g. webhooks)
  if (req.path.startsWith('/api/webhook')) {
    return next();
  }

  // 1. Get or create CSRF token
  let csrfToken = req.cookies['XSRF-TOKEN'];
  
  // If no token exists, or if it's a GET request, make sure we have a token set
  if (!csrfToken) {
    csrfToken = crypto.randomBytes(16).toString('hex');
    res.cookie('XSRF-TOKEN', csrfToken, {
      path: '/',
      secure: cookieSecure || nodeEnv === 'production',
      sameSite: (cookieSameSite as any) || 'lax',
      httpOnly: false // Frontend needs to read this to set the header
    });
  }

  // 2. Verify token on state-changing methods
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    // Ignore CSRF check for tests if explicitly disabled
    if (disableCsrf) {
      return next();
    }

    const headerToken = req.headers['x-xsrf-token'] || req.headers['x-csrf-token'];
    
    if (!csrfToken || csrfToken !== headerToken) {
      // Authorization 헤더가 있으면 CSRF 체크 건너뜀 (Bearer 토큰 방식 대응)
      if (req.headers.authorization) {
        return next();
      }

      return res.status(403).json({ 
        result: false,
        error: 'CSRF token validation failed',
        code: 'CSRF_ERROR' 
      });
    }
  }

  next();
};



