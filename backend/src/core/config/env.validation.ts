import { ENV_MESSAGES } from '../http/message-catalog';

type EnvValide = {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  TRUST_PROXY: boolean;
  CORS_ORIGINS: string;
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_TTL: string;
  JWT_REFRESH_TTL: string;
  GOOGLE_CLIENT_ID: string;
  THROTTLE_SHORT_TTL: number;
  THROTTLE_SHORT_LIMIT: number;
  THROTTLE_MEDIUM_TTL: number;
  THROTTLE_MEDIUM_LIMIT: number;
  THROTTLE_LONG_TTL: number;
  THROTTLE_LONG_LIMIT: number;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_PHONE_NUMBER?: string;
  PAYDUNYA_API_KEY?: string;
  PAYDUNYA_SECRET_KEY?: string;
  PAYDUNYA_MODE?: string;
  REDIS_ENABLED?: boolean;
  REDIS_URL?: string;
  REDIS_HOST?: string;
  REDIS_PORT?: number;
  REDIS_PASSWORD?: string;
  REDIS_TLS?: boolean;
  FCM_PROJECT_ID?: string;
  FCM_PRIVATE_KEY?: string;
  FCM_CLIENT_EMAIL?: string;
  AWS_S3_BUCKET?: string;
  AWS_REGION?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  SENTRY_DSN?: string;
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

function asPrintable(value: unknown): string {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }
  return '';
}

function asNombre(value: unknown, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(ENV_MESSAGES.INVALID_PORT(asPrintable(value)));
  }
  return parsed;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
      return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no') {
      return false;
    }
  }

  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return fallback;
}

function requiredSecret(name: string, value: unknown): string {
  const secret = asString(value).trim();
  if (secret.length < 16 && name !== 'GOOGLE_CLIENT_ID') {
    throw new Error(ENV_MESSAGES.INVALID_SECRET_MIN_LENGTH(name));
  }
  return secret;
}

export function validerEnv(env: Record<string, unknown>): EnvValide {
  const nodeEnv = asString(env.NODE_ENV, 'development');
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error(ENV_MESSAGES.INVALID_NODE_ENV(nodeEnv));
  }

  const databaseUrl = asString(env.DATABASE_URL).trim();
  if (!databaseUrl.startsWith('postgresql://')) {
    throw new Error(ENV_MESSAGES.INVALID_DATABASE_URL);
  }

  return {
    NODE_ENV: nodeEnv as EnvValide['NODE_ENV'],
    PORT: asNombre(typeof env.PORT === 'string' ? env.PORT : undefined, 3000),
    TRUST_PROXY: asBoolean(env.TRUST_PROXY, nodeEnv === 'production'),
    CORS_ORIGINS: asString(env.CORS_ORIGINS),
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
    THROTTLE_SHORT_TTL: asNombre(env.THROTTLE_SHORT_TTL, 1000),
    THROTTLE_SHORT_LIMIT: asNombre(env.THROTTLE_SHORT_LIMIT, 10),
    THROTTLE_MEDIUM_TTL: asNombre(env.THROTTLE_MEDIUM_TTL, 60000),
    THROTTLE_MEDIUM_LIMIT: asNombre(env.THROTTLE_MEDIUM_LIMIT, 60),
    THROTTLE_LONG_TTL: asNombre(env.THROTTLE_LONG_TTL, 600000),
    THROTTLE_LONG_LIMIT: asNombre(env.THROTTLE_LONG_LIMIT, 200),
    TWILIO_ACCOUNT_SID: asString(env.TWILIO_ACCOUNT_SID),
    TWILIO_AUTH_TOKEN: asString(env.TWILIO_AUTH_TOKEN),
    TWILIO_PHONE_NUMBER: asString(env.TWILIO_PHONE_NUMBER),
    PAYDUNYA_API_KEY: asString(env.PAYDUNYA_API_KEY),
    PAYDUNYA_SECRET_KEY: asString(env.PAYDUNYA_SECRET_KEY),
    PAYDUNYA_MODE: asString(env.PAYDUNYA_MODE, 'test'),
    REDIS_ENABLED: asBoolean(env.REDIS_ENABLED, false),
    REDIS_URL: asString(env.REDIS_URL),
    REDIS_HOST: asString(env.REDIS_HOST, '127.0.0.1'),
    REDIS_PORT: asNombre(env.REDIS_PORT, 6379),
    REDIS_PASSWORD: asString(env.REDIS_PASSWORD),
    REDIS_TLS: asBoolean(env.REDIS_TLS, false),
    FCM_PROJECT_ID: asString(env.FCM_PROJECT_ID),
    FCM_PRIVATE_KEY: asString(env.FCM_PRIVATE_KEY),
    FCM_CLIENT_EMAIL: asString(env.FCM_CLIENT_EMAIL),
    AWS_S3_BUCKET: asString(env.AWS_S3_BUCKET),
    AWS_REGION: asString(env.AWS_REGION, 'eu-west-1'),
    AWS_ACCESS_KEY_ID: asString(env.AWS_ACCESS_KEY_ID),
    AWS_SECRET_ACCESS_KEY: asString(env.AWS_SECRET_ACCESS_KEY),
    SENTRY_DSN: asString(env.SENTRY_DSN),
  };
}
