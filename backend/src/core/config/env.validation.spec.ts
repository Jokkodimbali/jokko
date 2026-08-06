import { validerEnv } from './env.validation';

const baseEnv = {
  NODE_ENV: 'production',
  PORT: '3000',
  TRUST_PROXY: 'true',
  CORS_ORIGINS: 'https://jokko.app,https://admin.jokko.app',
  DATABASE_URL: 'postgresql://user:password@localhost:5432/jokko',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  PAYMENT_GATEWAY_MODE: 'external',
  PAYMENT_WEBHOOK_SECRET: 'c'.repeat(32),
  LIVEKIT_URL: 'wss://jokko.livekit.cloud',
  LIVEKIT_API_KEY: 'livekit-api-key',
  LIVEKIT_API_SECRET: 'livekit-api-secret-value',
};

describe('validerEnv', () => {
  it('accepts a production configuration with strict frontend origins and webhook secret', () => {
    const env = validerEnv(baseEnv);

    expect(env.NODE_ENV).toBe('production');
    expect(env.CORS_ORIGINS).toBe(baseEnv.CORS_ORIGINS);
    expect(env.PAYMENT_WEBHOOK_SECRET).toBe(baseEnv.PAYMENT_WEBHOOK_SECRET);
  });

  it('rejects production without explicit CORS origins', () => {
    expect(() =>
      validerEnv({
        ...baseEnv,
        CORS_ORIGINS: '',
      }),
    ).toThrow('CORS_ORIGINS');
  });

  it('rejects external production payments without a strong webhook secret', () => {
    expect(() =>
      validerEnv({
        ...baseEnv,
        PAYMENT_WEBHOOK_SECRET: 'short-secret',
      }),
    ).toThrow('PAYMENT_WEBHOOK_SECRET');
  });

  it('rejects production placeholder secret text', () => {
    expect(() =>
      validerEnv({
        ...baseEnv,
        JWT_ACCESS_SECRET:
          "Tu m'as demande de ne pas detailler la methode option 2",
      }),
    ).toThrow('JWT_ACCESS_SECRET');
  });

  it('preserves a complete LiveKit configuration', () => {
    const env = validerEnv({
      ...baseEnv,
      LIVEKIT_URL: 'wss://jokko.livekit.cloud',
      LIVEKIT_API_KEY: 'livekit-api-key',
      LIVEKIT_API_SECRET: 'livekit-api-secret-value',
    });

    expect(env.LIVEKIT_URL).toBe('wss://jokko.livekit.cloud');
    expect(env.LIVEKIT_API_KEY).toBe('livekit-api-key');
    expect(env.LIVEKIT_API_SECRET).toBe('livekit-api-secret-value');
  });

  it('rejects a partial LiveKit configuration', () => {
    expect(() =>
      validerEnv({
        ...baseEnv,
        LIVEKIT_URL: 'wss://jokko.livekit.cloud',
        LIVEKIT_API_KEY: '',
        LIVEKIT_API_SECRET: '',
      }),
    ).toThrow('LIVEKIT_API_KEY');
  });

  it('rejects production without LiveKit configuration', () => {
    expect(() =>
      validerEnv({
        ...baseEnv,
        LIVEKIT_URL: '',
        LIVEKIT_API_KEY: '',
        LIVEKIT_API_SECRET: '',
      }),
    ).toThrow('LIVEKIT_URL');
  });

  it('rejects an invalid LiveKit URL', () => {
    expect(() =>
      validerEnv({
        ...baseEnv,
        LIVEKIT_URL: 'https://jokko.livekit.cloud',
        LIVEKIT_API_KEY: 'livekit-api-key',
        LIVEKIT_API_SECRET: 'livekit-api-secret-value',
      }),
    ).toThrow('LIVEKIT_URL');
  });
});
