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

  it('closes CORS by default in production', () => {
    expect(
      buildCorsOptionsFromValues({
        nodeEnv: 'production',
        corsOrigins: '',
      }),
    ).toEqual({ origin: false });
  });
});
