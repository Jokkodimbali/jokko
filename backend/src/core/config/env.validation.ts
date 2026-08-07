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
  GOOGLE_MAPS_API_KEY?: string;
  GOOGLE_MAPS_BROWSER_API_KEY?: string;
  GOOGLE_MAPS_MAP_ID?: string;
  THROTTLE_SHORT_TTL: number;
  THROTTLE_SHORT_LIMIT: number;
  THROTTLE_MEDIUM_TTL: number;
  THROTTLE_MEDIUM_LIMIT: number;
  THROTTLE_LONG_TTL: number;
  THROTTLE_LONG_LIMIT: number;
  RESEND_API_KEY?: string;
  EMAIL_FROM_ADDRESS?: string;
  EMAIL_FROM_NAME?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_PHONE_NUMBER?: string;
  PAYMENT_GATEWAY_MODE?: string;
  PAYMENT_WEBHOOK_SECRET?: string;
  WAVE_API_BASE_URL?: string;
  WAVE_API_KEY?: string;
  ORANGE_MONEY_API_BASE_URL?: string;
  ORANGE_MONEY_API_KEY?: string;
  CARD_PAYMENT_API_BASE_URL?: string;
  CARD_PAYMENT_API_KEY?: string;
  REDIS_ENABLED?: boolean;
  REDIS_URL?: string;
  REDIS_HOST?: string;
  REDIS_PORT?: number;
  REDIS_PASSWORD?: string;
  REDIS_TLS?: boolean;
  CLOUDINARY_URL?: string;
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
  LIVEKIT_URL?: string;
  LIVEKIT_API_KEY?: string;
  LIVEKIT_API_SECRET?: string;
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

function isPlaceholderSecret(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.includes('tu m') ||
    normalized.includes('option 2') ||
    normalized.includes('renseigner sur render') ||
    normalized.includes('generate-a-strong') ||
    normalized.includes('change-me') ||
    normalized.includes('replace-me')
  );
}

function requiredSecret(name: string, value: unknown): string {
  const secret = asString(value).trim();
  if (isPlaceholderSecret(secret)) {
    throw new Error(ENV_MESSAGES.INVALID_SECRET_PLACEHOLDER(name));
  }
  if (secret.length < 16 && name !== 'GOOGLE_CLIENT_ID') {
    throw new Error(ENV_MESSAGES.INVALID_SECRET_MIN_LENGTH(name));
  }
  return secret;
}

function requiredProductionSecret(name: string, value: unknown): string {
  const secret = requiredSecret(name, value);
  if (secret.length < 32) {
    throw new Error(ENV_MESSAGES.INVALID_PRODUCTION_SECRET_MIN_LENGTH(name));
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

  const corsOrigins = asString(env.CORS_ORIGINS);
  const paymentGatewayMode = asString(
    env.PAYMENT_GATEWAY_MODE,
    nodeEnv === 'production' ? 'external' : 'mock',
  );
  const paymentWebhookSecret = asString(env.PAYMENT_WEBHOOK_SECRET).trim();
  const jwtAccessSecret =
    nodeEnv === 'production'
      ? requiredProductionSecret('JWT_ACCESS_SECRET', env.JWT_ACCESS_SECRET)
      : requiredSecret('JWT_ACCESS_SECRET', env.JWT_ACCESS_SECRET);
  const jwtRefreshSecret =
    nodeEnv === 'production'
      ? requiredProductionSecret('JWT_REFRESH_SECRET', env.JWT_REFRESH_SECRET)
      : requiredSecret('JWT_REFRESH_SECRET', env.JWT_REFRESH_SECRET);
  const liveKitUrl = asString(env.LIVEKIT_URL).trim();
  const liveKitApiKey = asString(env.LIVEKIT_API_KEY).trim();
  const liveKitApiSecret = asString(env.LIVEKIT_API_SECRET).trim();
  const configuredLiveKitValues = [
    liveKitUrl,
    liveKitApiKey,
    liveKitApiSecret,
  ].filter(Boolean).length;

  if (nodeEnv === 'production' && configuredLiveKitValues !== 3) {
    throw new Error(
      'LIVEKIT_URL, LIVEKIT_API_KEY et LIVEKIT_API_SECRET sont obligatoires en production.',
    );
  }

  if (configuredLiveKitValues > 0 && configuredLiveKitValues < 3) {
    throw new Error(
      'LIVEKIT_URL, LIVEKIT_API_KEY et LIVEKIT_API_SECRET doivent etre configures ensemble.',
    );
  }

  if (liveKitUrl && !/^wss?:\/\//i.test(liveKitUrl)) {
    throw new Error('LIVEKIT_URL doit commencer par ws:// ou wss://.');
  }

  if (nodeEnv === 'production' && corsOrigins.trim().length === 0) {
    throw new Error(ENV_MESSAGES.PRODUCTION_CORS_ORIGINS_REQUIRED);
  }

  if (
    nodeEnv === 'production' &&
    paymentGatewayMode === 'external' &&
    paymentWebhookSecret.length < 32
  ) {
    throw new Error(ENV_MESSAGES.PRODUCTION_PAYMENT_WEBHOOK_SECRET_REQUIRED);
  }

  return {
    NODE_ENV: nodeEnv as EnvValide['NODE_ENV'],
    PORT: asNombre(typeof env.PORT === 'string' ? env.PORT : undefined, 3000),
    TRUST_PROXY: asBoolean(env.TRUST_PROXY, nodeEnv === 'production'),
    CORS_ORIGINS: corsOrigins,
    DATABASE_URL: databaseUrl,
    JWT_ACCESS_SECRET: jwtAccessSecret,
    JWT_REFRESH_SECRET: jwtRefreshSecret,
    JWT_ACCESS_TTL: asString(env.JWT_ACCESS_TTL, '15m'),
    JWT_REFRESH_TTL: asString(env.JWT_REFRESH_TTL, '30d'),
    GOOGLE_CLIENT_ID: asString(env.GOOGLE_CLIENT_ID).trim(),
    GOOGLE_MAPS_API_KEY: asString(env.GOOGLE_MAPS_API_KEY).trim(),
    GOOGLE_MAPS_BROWSER_API_KEY: asString(
      env.GOOGLE_MAPS_BROWSER_API_KEY,
    ).trim(),
    GOOGLE_MAPS_MAP_ID: asString(env.GOOGLE_MAPS_MAP_ID).trim(),
    THROTTLE_SHORT_TTL: asNombre(env.THROTTLE_SHORT_TTL, 1000),
    THROTTLE_SHORT_LIMIT: asNombre(env.THROTTLE_SHORT_LIMIT, 100),
    THROTTLE_MEDIUM_TTL: asNombre(env.THROTTLE_MEDIUM_TTL, 60000),
    THROTTLE_MEDIUM_LIMIT: asNombre(env.THROTTLE_MEDIUM_LIMIT, 1200),
    THROTTLE_LONG_TTL: asNombre(env.THROTTLE_LONG_TTL, 600000),
    THROTTLE_LONG_LIMIT: asNombre(env.THROTTLE_LONG_LIMIT, 10000),
    RESEND_API_KEY: asString(env.RESEND_API_KEY),
    EMAIL_FROM_ADDRESS: asString(env.EMAIL_FROM_ADDRESS),
    EMAIL_FROM_NAME: asString(env.EMAIL_FROM_NAME, 'Jokko'),
    TWILIO_ACCOUNT_SID: asString(env.TWILIO_ACCOUNT_SID),
    TWILIO_AUTH_TOKEN: asString(env.TWILIO_AUTH_TOKEN),
    TWILIO_PHONE_NUMBER: asString(env.TWILIO_PHONE_NUMBER),
    PAYMENT_GATEWAY_MODE: paymentGatewayMode,
    PAYMENT_WEBHOOK_SECRET: paymentWebhookSecret,
    WAVE_API_BASE_URL: asString(env.WAVE_API_BASE_URL),
    WAVE_API_KEY: asString(env.WAVE_API_KEY),
    ORANGE_MONEY_API_BASE_URL: asString(env.ORANGE_MONEY_API_BASE_URL),
    ORANGE_MONEY_API_KEY: asString(env.ORANGE_MONEY_API_KEY),
    CARD_PAYMENT_API_BASE_URL: asString(env.CARD_PAYMENT_API_BASE_URL),
    CARD_PAYMENT_API_KEY: asString(env.CARD_PAYMENT_API_KEY),
    REDIS_ENABLED: asBoolean(env.REDIS_ENABLED, false),
    REDIS_URL: asString(env.REDIS_URL),
    REDIS_HOST: asString(env.REDIS_HOST, '127.0.0.1'),
    REDIS_PORT: asNombre(env.REDIS_PORT, 6379),
    REDIS_PASSWORD: asString(env.REDIS_PASSWORD),
    REDIS_TLS: asBoolean(env.REDIS_TLS, false),
    CLOUDINARY_URL: asString(env.CLOUDINARY_URL),
    CLOUDINARY_CLOUD_NAME: asString(env.CLOUDINARY_CLOUD_NAME),
    CLOUDINARY_API_KEY: asString(env.CLOUDINARY_API_KEY),
    CLOUDINARY_API_SECRET: asString(env.CLOUDINARY_API_SECRET),
    LIVEKIT_URL: liveKitUrl,
    LIVEKIT_API_KEY: liveKitApiKey,
    LIVEKIT_API_SECRET: liveKitApiSecret,
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
