export class ApiResponse<T> {
  success!: boolean;
  data?: T;
  message?: string;
  meta?: Record<string, unknown>;

  constructor(data: T, message?: string, meta?: Record<string, unknown>) {
    this.success = true;
    this.data = data;
    this.message = message;
    this.meta = meta;
  }
}

export class ApiError {
  success!: boolean;
  statusCode!: number;
  errorCode!: string;
  message!: string;
  timestamp!: string;
  path?: string;

  constructor(
    statusCode: number,
    errorCode: string,
    message: string,
    path?: string,
  ) {
    this.success = false;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.message = message;
    this.timestamp = new Date().toISOString();
    this.path = path;
  }
}

export function createApiResponse<T>(
  data: T,
  message?: string,
): ApiResponse<T> {
  return new ApiResponse<T>(data, message);
}

export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): ApiResponse<T[]> {
  return new ApiResponse(data, undefined, {
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrevious: page > 1,
    },
  });
}
