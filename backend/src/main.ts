import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { ValidationError } from 'class-validator';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './core/http/api-exception.filter';
import { buildValidationException } from './core/http/validation-exception.factory';
import { AuditLoggerMiddleware } from './core/audit/audit-logger.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const auditMiddleware = app.get(AuditLoggerMiddleware);

  app.use(helmet());
  app.enableCors({ origin: true, credentials: true });

  app.use((req: Request, res: Response, next: NextFunction) =>
    auditMiddleware.use(req, res, next),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      exceptionFactory: (errors: ValidationError[]) =>
        buildValidationException(errors),
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  const port = configService.get<number>('PORT') ?? 3000;
  await app.listen(port);
}
void bootstrap();
