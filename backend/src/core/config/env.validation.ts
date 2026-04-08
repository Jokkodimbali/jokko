import { ENV_MESSAGES } from '../http/message-catalog';

type EnvValide = {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_TTL: string;
  JWT_REFRESH_TTL: string;
  GOOGLE_CLIENT_ID: string;
};

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
}

function asNombre(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(ENV_MESSAGES.INVALID_PORT(value));
  }
  return parsed;
}

function requiredSecret(name: string, value: unknown): string {
  const secret = asString(value).trim();
  if (secret.length < 16) {
    throw new Error(ENV_MESSAGES.INVALID_SECRET_MIN_LENGTH(name));
  }
  return secret;
}

export function validerEnv(env: Record<string, unknown>): EnvValide {
  const nodeEnv = asString(env.NODE_ENV, 'development');
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error(ENV_MESSAGES.INVALID_NODE_ENV(env.NODE_ENV));
  }

  const databaseUrl = asString(env.DATABASE_URL).trim();
  if (!databaseUrl.startsWith('postgresql://')) {
    throw new Error(ENV_MESSAGES.INVALID_DATABASE_URL);
  }

  return {
    NODE_ENV: nodeEnv as EnvValide['NODE_ENV'],
    PORT: asNombre(typeof env.PORT === 'string' ? env.PORT : undefined, 3000),
    DATABASE_URL: databaseUrl,
    JWT_ACCESS_SECRET: requiredSecret(
      'JWT_ACCESS_SECRET',
      env.JWT_ACCESS_SECRET,
    ),
    JWT_REFRESH_SECRET: requiredSecret(
      'JWT_REFRESH_SECRET',
      env.JWT_REFRESH_SECRET,
    ),
    JWT_ACCESS_TTL: asString(env.JWT_ACCESS_TTL, '15m'),
    JWT_REFRESH_TTL: asString(env.JWT_REFRESH_TTL, '30d'),
    GOOGLE_CLIENT_ID: asString(env.GOOGLE_CLIENT_ID).trim(),
  };
}
