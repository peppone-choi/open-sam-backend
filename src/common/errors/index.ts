/**
 * Central error class exports
 * 
 * Usage:
 * import { NotFoundError, ValidationError, UnauthorizedError } from '@/common/errors';
 * 
 * throw new NotFoundError('User not found', { userId: 123 });
 */

export {
  AppError,
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  ValidationError,
  InternalServerError
} from './app-error';

export { HttpException } from './HttpException';
