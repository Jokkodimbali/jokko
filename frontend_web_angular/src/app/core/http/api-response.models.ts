export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  meta?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  errorCode: string;
  message: string | string[];
  timestamp: string;
  path?: string;
}

export interface PaginatedApiMeta {
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}
