import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import type { ConfigService } from '@nestjs/config';

export type CorsRuntimeConfig = {
  nodeEnv: string;
  corsOrigins: string;
};

export function parseCorsOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export function buildCorsOptionsFromValues(
  config: CorsRuntimeConfig,
): CorsOptions {
  const configuredOrigins = parseCorsOrigins(config.corsOrigins);

  if (configuredOrigins.includes('*')) {
    return {
      origin: true,
      credentials: true,
    };
  }

  if (configuredOrigins.length > 0) {
    return {
      origin: configuredOrigins,
      credentials: true,
    };
  }

  if (config.nodeEnv === 'production') {
    return { origin: false };
  }

  return { origin: true, credentials: true };
}

export function buildCorsOptions(configService: ConfigService): CorsOptions {
  return buildCorsOptionsFromValues({
    nodeEnv: configService.get<string>('NODE_ENV', 'development'),
    corsOrigins: configService.get<string>('CORS_ORIGINS', ''),
  });
}

export function buildSocketCorsOptionsFromProcessEnv(): CorsOptions {
  return buildCorsOptionsFromValues({
    nodeEnv: process.env.NODE_ENV ?? 'development',
    corsOrigins: process.env.CORS_ORIGINS ?? '',
  });
}
