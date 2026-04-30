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
});
