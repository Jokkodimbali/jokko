import { buildCorsOptionsFromValues } from './cors.config';

describe('buildCorsOptionsFromValues', () => {
  it('allows only configured frontend origins', () => {
    expect(
      buildCorsOptionsFromValues({
        nodeEnv: 'production',
        corsOrigins: 'https://jokko.app, https://admin.jokko.app',
      }),
    ).toEqual({
      origin: ['https://jokko.app', 'https://admin.jokko.app'],
      credentials: true,
    });
  });

  it('allows every origin when the wildcard marker is configured', () => {
    expect(
      buildCorsOptionsFromValues({
        nodeEnv: 'production',
        corsOrigins: '*',
      }),
    ).toEqual({
      origin: true,
      credentials: true,
    });
  });

  it('keeps local Angular origins available in development', () => {
    expect(
      buildCorsOptionsFromValues({
        nodeEnv: 'development',
        corsOrigins: 'https://staging.jokko.app',
      }),
    ).toEqual({
      origin: [
        'https://staging.jokko.app',
        'http://localhost:4200',
        'http://127.0.0.1:4200',
      ],
      credentials: true,
    });
  });

  it('closes CORS by default in production', () => {
    expect(
      buildCorsOptionsFromValues({
        nodeEnv: 'production',
        corsOrigins: '',
      }),
    ).toEqual({ origin: false });
  });
});
