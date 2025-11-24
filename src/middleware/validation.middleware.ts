/**
 * Input Validation Middleware
 * 
 * NoSQL Injection 방지를 위한 입력 검증 미들웨어
 * yup 스키마 기반 검증을 제공합니다.
 */

import * as yup from 'yup';
import { Request, Response, NextFunction } from 'express';

/**
 * 안전한 정수 파싱 헬퍼
 * parseInt 결과가 유효한 숫자인지 검증합니다.
 * 
 * @param value - 파싱할 값
 * @param fieldName - 필드 이름 (에러 메시지용)
 * @returns 유효한 정수 또는 에러
 */
export function safeParseInt(value: any, fieldName: string = 'value'): number {
  const parsed = parseInt(value, 10);
  
  if (isNaN(parsed)) {
    throw new Error(`${fieldName} must be a valid number`);
  }
  
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} must be a finite number`);
  }
  
  return parsed;
}

/**
 * 안전한 양의 정수 파싱 헬퍼
 * 
 * @param value - 파싱할 값
 * @param fieldName - 필드 이름 (에러 메시지용)
 * @returns 유효한 양의 정수 또는 에러
 */
export function safeParsePositiveInt(value: any, fieldName: string = 'value'): number {
  const parsed = safeParseInt(value, fieldName);
  
  if (parsed < 0) {
    throw new Error(`${fieldName} must be a positive number`);
  }
  
  return parsed;
}

/**
 * Validation Schemas
 */

// Admin Routes - General ID 검증
export const adminGeneralSchema = yup.object({
  generalID: yup.number()
    .integer('generalID must be an integer')
    .min(0, 'generalID must be >= 0')
    .required('generalID is required'),
  generalNo: yup.number()
    .integer('generalNo must be an integer')
    .min(0, 'generalNo must be >= 0')
    .optional(),
});

// Admin Routes - Penalty Level 검증
export const adminPenaltySchema = yup.object({
  generalNo: yup.number()
    .integer('generalNo must be an integer')
    .min(0, 'generalNo must be >= 0')
    .required('generalNo is required'),
  penaltyLevel: yup.number()
    .integer('penaltyLevel must be an integer')
    .min(0, 'penaltyLevel must be >= 0')
    .max(10, 'penaltyLevel must be <= 10')
    .required('penaltyLevel is required'),
});

// LOGH Routes - Commander Number 검증
export const loghCommanderSchema = yup.object({
  commanderNo: yup.number()
    .integer('commanderNo must be an integer')
    .min(0, 'commanderNo must be >= 0')
    .required('commanderNo is required'),
});

// Battle Routes - Battle ID 검증
export const battleIdSchema = yup.object({
  battleId: yup.string()
    .required('battleId is required')
    .matches(/^[a-f0-9-]+$/i, 'battleId must be a valid UUID or ID'),
});

// Battle Routes - General ID 검증
export const battleGeneralIdSchema = yup.object({
  generalId: yup.number()
    .integer('generalId must be an integer')
    .min(0, 'generalId must be >= 0')
    .required('generalId is required'),
});

// Nation ID 검증
export const nationIdSchema = yup.object({
  nationId: yup.number()
    .integer('nationId must be an integer')
    .min(0, 'nationId must be >= 0')
    .required('nationId is required'),
});

// City ID 검증
export const cityIdSchema = yup.object({
  cityId: yup.number()
    .integer('cityId must be an integer')
    .min(0, 'cityId must be >= 0')
    .required('cityId is required'),
});

// User ID 검증 (MongoDB ObjectId 또는 숫자)
export const userIdSchema = yup.object({
  userID: yup.mixed()
    .test('is-valid-id', 'userID must be a valid ObjectId or number', (value) => {
      if (typeof value === 'string') {
        return /^[a-f0-9]{24}$/i.test(value);
      }
      if (typeof value === 'number') {
        return Number.isInteger(value) && value >= 0;
      }
      return false;
    })
    .required('userID is required'),
});

// Pagination 검증
export const paginationSchema = yup.object({
  from: yup.number()
    .integer('from must be an integer')
    .min(0, 'from must be >= 0')
    .default(0),
  limit: yup.number()
    .integer('limit must be an integer')
    .min(1, 'limit must be >= 1')
    .max(500, 'limit must be <= 500')
    .default(100),
});

// Session ID 검증
export const sessionIdSchema = yup.object({
  session_id: yup.string()
    .matches(/^[a-zA-Z0-9_-]+$/, 'session_id must contain only alphanumeric characters, underscores, and hyphens')
    .max(100, 'session_id must be <= 100 characters')
    .default('sangokushi_default'),
});

/**
 * Validation Middleware Factory
 * 
 * @param schema - Yup validation schema
 * @param source - 검증할 데이터 소스 ('body' | 'params' | 'query')
 * @returns Express middleware
 */
export function validate(
  schema: yup.AnyObjectSchema,
  source: 'body' | 'params' | 'query' = 'body'
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 스키마 검증
      const validated = await schema.validate(req[source], {
        abortEarly: false,
        stripUnknown: true,
      });

      // 검증된 데이터로 교체
      req[source] = validated;

      next();
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        return res.status(400).json({
          result: false,
          success: false,
          reason: 'Validation failed',
          errors: error.errors,
        });
      }

      // 예상치 못한 에러
      console.error('Validation middleware error:', error);
      return res.status(500).json({
        result: false,
        success: false,
        reason: 'Internal validation error',
      });
    }
  };
}

/**
 * Combined Validation Middleware Factory
 * 여러 소스를 한 번에 검증합니다.
 * 
 * @param schemas - 소스별 스키마 맵
 * @returns Express middleware
 */
export function validateMultiple(schemas: {
  body?: yup.AnyObjectSchema;
  params?: yup.AnyObjectSchema;
  query?: yup.AnyObjectSchema;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validationPromises: Promise<any>[] = [];

      if (schemas.body) {
        validationPromises.push(
          schemas.body.validate(req.body, { abortEarly: false, stripUnknown: true })
            .then(validated => { req.body = validated; })
        );
      }

      if (schemas.params) {
        validationPromises.push(
          schemas.params.validate(req.params, { abortEarly: false, stripUnknown: true })
            .then(validated => { req.params = validated; })
        );
      }

      if (schemas.query) {
        validationPromises.push(
          schemas.query.validate(req.query, { abortEarly: false, stripUnknown: true })
            .then(validated => { req.query = validated as any; })
        );
      }

      await Promise.all(validationPromises);
      next();
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        return res.status(400).json({
          result: false,
          success: false,
          reason: 'Validation failed',
          errors: error.errors,
        });
      }

      console.error('Validation middleware error:', error);
      return res.status(500).json({
        result: false,
        success: false,
        reason: 'Internal validation error',
      });
    }
  };
}

/**
 * 특정 필드를 안전하게 파싱하는 미들웨어
 */
export function sanitizeFields(fields: string[], source: 'body' | 'params' | 'query' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req[source] as any;

      for (const field of fields) {
        if (data[field] !== undefined && data[field] !== null) {
          // 숫자로 파싱 시도
          const parsed = safeParseInt(data[field], field);
          data[field] = parsed;
        }
      }

      next();
    } catch (error: any) {
      return res.status(400).json({
        result: false,
        success: false,
        reason: error.message || 'Field sanitization failed',
      });
    }
  };
}

/**
 * MongoDB Operator Injection 방지
 * $, . 문자를 포함한 키를 거부합니다.
 */
export function preventMongoInjection(source: 'body' | 'params' | 'query' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    const data = req[source] as any;

    function checkObject(obj: any, path: string = ''): string | null {
      if (obj === null || obj === undefined) return null;

      if (typeof obj !== 'object') return null;

      for (const key in obj) {
        // $로 시작하는 키 거부
        if (key.startsWith('$')) {
          return `${path}${key}`;
        }

        // .를 포함한 키 거부
        if (key.includes('.')) {
          return `${path}${key}`;
        }

        // 재귀적으로 검사
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          const result = checkObject(obj[key], `${path}${key}.`);
          if (result) return result;
        }
      }

      return null;
    }

    const dangerousKey = checkObject(data);
    if (dangerousKey) {
      return res.status(400).json({
        result: false,
        success: false,
        reason: `Potentially dangerous key detected: ${dangerousKey}`,
      });
    }

    next();
  };
}
