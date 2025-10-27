/**
 * 공통 HTTP 타입 정의
 */

export type ApiResponse<T> = {
  data: T;
};

export type Paginated<T> = {
  data: T[];
  count: number;
  limit: number;
  skip: number;
};

export type ErrorResponse = {
  error: {
    message: string;
    code: string;
    details?: any;
  };
};
