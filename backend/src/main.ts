import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { ValidationError } from 'class-validator';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './core/http/api-exception.filter';
import { buildValidationException } from './core/http/validation-exception.factory';
import { API_DOCS } from './core/messages/api-docs.messages';
import { buildCorsOptions } from './core/config/cors.config';

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
