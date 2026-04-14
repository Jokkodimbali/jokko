import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { appMessage } from './app-http.exception';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    const fallback = appMessage('SYSTEM_INTERNAL_SERVER_ERROR');
    const responseObject =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as {
            message?: string | string[];
            errorCode?: string;
          })
        : null;

    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (responseObject?.message ?? fallback.message);

    // Normalize message to always return as string for consistency
    const normalizedMessage = Array.isArray(message)
      ? message.join('. ')
      : message;

    const errorCode = responseObject?.errorCode ?? fallback.code;

    response.status(statusCode).json({
      success: false,
      statusCode,
      errorCode,
      message: normalizedMessage,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
