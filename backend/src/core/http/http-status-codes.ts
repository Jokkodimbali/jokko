import { HttpStatus } from '@nestjs/common';

export const HTTP_STATUS_CODES = {
  SUCCESS: {
    OK: HttpStatus.OK,
    CREATED: HttpStatus.CREATED,
  },
  CLIENT_ERROR: {
    BAD_REQUEST: HttpStatus.BAD_REQUEST,
    UNAUTHORIZED: HttpStatus.UNAUTHORIZED,
    FORBIDDEN: HttpStatus.FORBIDDEN,
    NOT_FOUND: HttpStatus.NOT_FOUND,
    CONFLICT: HttpStatus.CONFLICT,
    TOO_MANY_REQUESTS: HttpStatus.TOO_MANY_REQUESTS,
  },
  SERVER_ERROR: {
    INTERNAL_SERVER_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
  },
} as const;

export { HttpStatus } from '@nestjs/common';
