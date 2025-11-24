/**
 * 애플리케이션 에러 기본 클래스
 * 
 * 모든 비즈니스 로직 에러는 이 클래스를 상속하여 사용합니다.
 * HTTP 상태 코드, 에러 코드, 원인 에러를 포함할 수 있습니다.
 * 
 * @example
 * throw new AppError('세션을 찾을 수 없습니다', {
 *   status: 404,
 *   code: 'SESSION_NOT_FOUND',
 *   cause: originalError
 * });
 */
export class AppError extends Error {
  /** HTTP 상태 코드 */
  public readonly status: number;
  
  /** 애플리케이션 에러 코드 */
  public readonly code: string;
  
  /** 원인이 되는 에러 */
  public readonly cause?: Error;
  
  /** 추가 메타데이터 */
  public readonly meta?: Record<string, any>;

  constructor(
    message: string,
    options: {
      status?: number;
      code?: string;
      cause?: Error;
      meta?: Record<string, any>;
    } = {}
  ) {
    super(message);
    this.name = 'AppError';
    this.status = options.status || 400;
    this.code = options.code || 'BAD_REQUEST';
    this.cause = options.cause;
    this.meta = options.meta;

    // V8 엔진에서 스택 트레이스 캡처
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * JSON 직렬화
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      status: this.status,
      meta: this.meta
    };
  }
}

/**
 * 404 Not Found 에러
 */
export class NotFoundError extends AppError {
  constructor(message: string, meta?: Record<string, any>) {
    super(message, { status: 404, code: 'NOT_FOUND', meta });
    this.name = 'NotFoundError';
  }
}

/**
 * 400 Bad Request 에러
 */
export class BadRequestError extends AppError {
  constructor(message: string, meta?: Record<string, any>) {
    super(message, { status: 400, code: 'BAD_REQUEST', meta });
    this.name = 'BadRequestError';
  }
}

/**
 * 401 Unauthorized 에러
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = '인증이 필요합니다', meta?: Record<string, any>) {
    super(message, { status: 401, code: 'UNAUTHORIZED', meta });
    this.name = 'UnauthorizedError';
  }
}

/**
 * 403 Forbidden 에러
 */
export class ForbiddenError extends AppError {
  constructor(message: string = '접근 권한이 없습니다', meta?: Record<string, any>) {
    super(message, { status: 403, code: 'FORBIDDEN', meta });
    this.name = 'ForbiddenError';
  }
}

/**
 * 409 Conflict 에러
 */
export class ConflictError extends AppError {
  constructor(message: string, meta?: Record<string, any>) {
    super(message, { status: 409, code: 'CONFLICT', meta });
    this.name = 'ConflictError';
  }
}

/**
 * 422 Validation Error
 */
export class ValidationError extends AppError {
  constructor(message: string, meta?: Record<string, any>) {
    super(message, { status: 422, code: 'VALIDATION_ERROR', meta });
    this.name = 'ValidationError';
  }
}

/**
 * 500 Internal Server Error
 */
export class InternalServerError extends AppError {
  constructor(message: string = '서버 내부 오류가 발생했습니다', cause?: Error, meta?: Record<string, any>) {
    super(message, { status: 500, code: 'INTERNAL_SERVER_ERROR', cause, meta });
    this.name = 'InternalServerError';
  }
}
