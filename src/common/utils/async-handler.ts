import { Request, Response, NextFunction } from 'express';

/**
 * 비동기 라우트 핸들러의 try/catch를 자동화
 * 
 * 사용 예시:
 * router.get('/:id', asyncHandler(controller.getById))
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
