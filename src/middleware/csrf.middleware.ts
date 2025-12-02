import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * CSRF Protection Middleware
 * Implements Double Submit Cookie pattern
 * 
 * 1. Sets 'XSRF-TOKEN' cookie on GET requests if not present
 * 2. Verifies 'X-XSRF-TOKEN' header matches cookie on state-changing methods
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
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // Must be Lax or Strict
      httpOnly: false // Frontend needs to read this to set the header
    });
  }

  // 2. Verify token on state-changing methods
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    // Ignore CSRF check for tests if explicitly disabled
    if (process.env.DISABLE_CSRF === 'true') {
      return next();
    }

    const headerToken = req.headers['x-xsrf-token'] || req.headers['x-csrf-token'];
    
    // If the cookie wasn't present in the request (we just generated it), 
    // the user couldn't have sent a matching header.
    // Unless it's a public endpoint that doesn't require session? 
    // Even then, CSRF prevents specialized attacks.
    // However, for 'Login', the user might not have a token yet if they hit POST /login directly?
    // Usually SPA loads index.html (GET) first, which sets the cookie.
    
    if (!csrfToken || csrfToken !== headerToken) {
      // Allow if Authorization Bearer header is present?
      // Bearer tokens are generally not susceptible to CSRF if not stored in cookies.
      // BUT our API accepts tokens from Cookies too.
      // If the user sends a Bearer token in HEADER, they are proving they have the token (not using cookie auth).
      // So if Authorization header exists, we can skip CSRF check?
      // YES, this is a common pattern. If you manually attach the token, you are safe from CSRF (which relies on automatic cookie sending).
      
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



