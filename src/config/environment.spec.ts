import { validateEnvironment } from './environment.js';

const VALID_ENVIRONMENT = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://iwtc:password@localhost:5432/iwtc',
  JWT_ACCESS_SECRET: 'access-secret-at-least-thirty-two-characters',
  JWT_REFRESH_SECRET: 'refresh-secret-at-least-thirty-two-characters',
};

describe('validateEnvironment', () => {
  it('provides local S3-compatible storage defaults', () => {
    expect(validateEnvironment(VALID_ENVIRONMENT)).toMatchObject({
      S3_ENDPOINT: 'http://localhost:9000',
      S3_REGION: 'us-east-1',
      S3_BUCKET: 'iwtc',
      S3_ACCESS_KEY_ID: 'local-minio-access-key',
      S3_SECRET_ACCESS_KEY: 'local-minio-secret-key',
      S3_FORCE_PATH_STYLE: true,
    });
  });

  it('normalizes explicit S3-compatible storage settings', () => {
    expect(
      validateEnvironment({
        ...VALID_ENVIRONMENT,
        S3_ENDPOINT: 'https://objects.example.com/',
        S3_REGION: 'ap-northeast-2',
        S3_BUCKET: 'iwtc-media',
        S3_ACCESS_KEY_ID: 'access-key',
        S3_SECRET_ACCESS_KEY: 'secret-key',
        S3_FORCE_PATH_STYLE: 'false',
      }),
    ).toMatchObject({
      S3_ENDPOINT: 'https://objects.example.com',
      S3_REGION: 'ap-northeast-2',
      S3_BUCKET: 'iwtc-media',
      S3_ACCESS_KEY_ID: 'access-key',
      S3_SECRET_ACCESS_KEY: 'secret-key',
      S3_FORCE_PATH_STYLE: false,
    });
  });

  it('requires HTTPS object storage in production', () => {
    expect(() =>
      validateEnvironment({
        ...VALID_ENVIRONMENT,
        NODE_ENV: 'production',
        MEDIA_PUBLIC_BASE_URL: 'https://media.example.com/iwtc',
        S3_ENDPOINT: 'http://objects.example.com',
        S3_ACCESS_KEY_ID: 'access-key',
        S3_SECRET_ACCESS_KEY: 'secret-key',
      }),
    ).toThrow('운영 S3_ENDPOINT는 HTTPS URL이어야 합니다.');
  });

  it('rejects an invalid path-style setting', () => {
    expect(() =>
      validateEnvironment({
        ...VALID_ENVIRONMENT,
        S3_FORCE_PATH_STYLE: 'yes',
      }),
    ).toThrow('S3_FORCE_PATH_STYLE은 true 또는 false여야 합니다.');
  });
});
