import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { ValidationError } from 'class-validator';
import { join } from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './core/http/api-exception.filter';
import { buildValidationException } from './core/http/validation-exception.factory';
import { API_DOCS } from './core/messages/api-docs.messages';
import { buildCorsOptions } from './core/config/cors.config';

function applyCorsHeaders(
  request: Request,
  response: Response,
  configuredOrigins: string,
): boolean {
  const requestOrigin = request.headers.origin;

  if (!requestOrigin) {
    return false;
  }

  const allowedOrigins = configuredOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowsEveryOrigin = allowedOrigins.includes('*');
  const isAllowedOrigin =
    allowsEveryOrigin || allowedOrigins.includes(requestOrigin);

  if (!isAllowedOrigin) {
    return false;
  }

  response.setHeader('Access-Control-Allow-Origin', requestOrigin);
  response.setHeader('Vary', 'Origin');
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader(
    'Access-Control-Allow-Methods',
    'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  );
  response.setHeader(
    'Access-Control-Allow-Headers',
    request.headers['access-control-request-headers'] ||
      'Authorization,Content-Type,Accept,Origin,X-Requested-With',
  );
  response.setHeader('Access-Control-Max-Age', '86400');
  return true;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const configuredCorsOrigins = configService.get<string>('CORS_ORIGINS', '');

  app.set('trust proxy', configService.get<boolean>('TRUST_PROXY', true));
  app.use((request: Request, response: Response, next: NextFunction) => {
    const hasCorsHeaders = applyCorsHeaders(
      request,
      response,
      configuredCorsOrigins,
    );

    if (hasCorsHeaders && request.method === 'OPTIONS') {
      response.status(204).send();
      return;
    }

    next();
  });
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });
  app.enableCors(buildCorsOptions(configService));

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

  const swaggerConfig = new DocumentBuilder()
    .setTitle(API_DOCS.swagger.title)
    .setDescription(API_DOCS.swagger.description)
    .setVersion(API_DOCS.swagger.version)
    .addServer(
      API_DOCS.swagger.localServerUrl,
      API_DOCS.swagger.localServerDescription,
    )
    .addServer(
      API_DOCS.swagger.renderServerUrl,
      API_DOCS.swagger.renderServerDescription,
    )
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: API_DOCS.swagger.bearerDescription,
    })
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(API_DOCS.swagger.docsPath, app, swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  const port = configService.get<number>('PORT') ?? 3000;
  await app.listen(port);
}
void bootstrap();
