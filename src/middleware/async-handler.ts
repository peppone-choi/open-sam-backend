import { Request, Response, NextFunction } from 'express';

/**
 * Async handler wrapper for Express routes
 * Automatically catches errors from async route handlers and passes them to error middleware
 * 
 * @example
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await getUsersFromDB();
 *   res.json({ success: true, data: users });
 * }));
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
