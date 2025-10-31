export interface ApiResponse<T = any> {
  data: T;
  message?: string;
}

export interface Paginated<T = any> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
