import { object, string, number, boolean, array, mixed, Schema } from 'yup';

/**
 * DTO 스키마 타입
 * 
 * Yup 스키마를 사용하여 요청 데이터의 유효성을 검증합니다.
 */
export interface DtoSchema {
  body?: Schema;
  params?: Schema;
  query?: Schema;
}

/**
 * 페이지네이션 쿼리 스키마
 * 
 * @example
 * GET /api/items?page=1&limit=20
 */
export const PaginationQuerySchema = object({
  page: number().min(1).default(1),
  limit: number().min(1).max(100).default(20),
});

/**
 * ID 파라미터 스키마
 * 
 * @example
 * GET /api/items/:id
 */
export const IdParamSchema = object({
  id: string().required(),
});

/**
 * Session ID 파라미터 스키마
 */
export const SessionIdParamSchema = object({
  sessionId: string().required(),
});

/**
 * 정렬 쿼리 스키마
 */
export const SortQuerySchema = object({
  sortBy: string().optional(),
  sortOrder: string().oneOf(['asc', 'desc']).default('asc'),
});

/**
 * 검색 쿼리 스키마
 */
export const SearchQuerySchema = object({
  search: string().optional(),
});

/**
 * 공통 생성/수정 타임스탬프
 */
export const TimestampSchema = object({
  createdAt: string().optional(),
  updatedAt: string().optional(),
});
