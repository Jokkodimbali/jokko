import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { ValidationError } from 'class-validator';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './core/http/api-exception.filter';
import { buildValidationException } from './core/http/validation-exception.factory';

function parseCorsOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function buildCorsOptions(configService: ConfigService): CorsOptions {
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const configuredOrigins = parseCorsOrigins(
    configService.get<string>('CORS_ORIGINS', ''),
  );

  if (configuredOrigins.length > 0) {
    return {
      origin: configuredOrigins,
      credentials: true,
    };
  }

  if (nodeEnv === 'production') {
    // En production, n'autoriser aucun origin par defaut.
    return { origin: false };
  }

  return { origin: true, credentials: true };
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  app.use(helmet());
  app.enableCors(buildCorsOptions(configService));
  app.set('trust proxy', configService.get<boolean>('TRUST_PROXY', false));

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
