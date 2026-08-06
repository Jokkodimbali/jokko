import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { appMessage } from './app-http.exception';
import {
  ValidationError,
  NotFoundError,
  ConflictError,
} from '../../shared/domain/errors/domain-error';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const fallback = appMessage('SYSTEM_INTERNAL_SERVER_ERROR');

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = fallback.code;
    let message: string | string[] = fallback.message;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse() as Record<string, unknown>;
      errorCode = (res?.errorCode as string) ?? fallback.code;
      message = (res?.message as string | string[]) ?? exception.message;
      if (process.env.NODE_ENV !== 'production' && res?.details !== undefined) {
        response.locals = {
          ...response.locals,
          errorDetails: res.details,
        };
      }
    } else if (exception instanceof NotFoundError) {
      statusCode = HttpStatus.NOT_FOUND;
      errorCode = exception.code;
      message = exception.message;
    } else if (exception instanceof ConflictError) {
      statusCode = HttpStatus.CONFLICT;
      errorCode = exception.code;
      message = exception.message;
    } else if (exception instanceof ValidationError) {
      statusCode = HttpStatus.BAD_REQUEST;
      errorCode = exception.code;
      message = exception.message;
    }

    // Normalize message to always return as string for consistency
    const normalizedMessage = Array.isArray(message)
      ? message.join('. ')
      : message;
    const errorDetails = (response.locals as Record<string, unknown>)[
      'errorDetails'
    ];

    response.status(statusCode).json({
      success: false,
      statusCode,
      errorCode,
      message: normalizedMessage,
      ...(process.env.NODE_ENV !== 'production' && errorDetails
        ? { details: errorDetails }
        : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
