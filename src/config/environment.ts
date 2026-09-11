const DEFAULT_CORS_ORIGINS = ['http://localhost:3000'];

export interface Environment {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DATABASE_URL: string;
  CORS_ORIGINS: string[];
  MEDIA_PUBLIC_BASE_URL: string;
  S3_ENDPOINT: string;
  S3_REGION: string;
  S3_BUCKET: string;
  S3_ACCESS_KEY_ID: string;
  S3_SECRET_ACCESS_KEY: string;
  S3_FORCE_PATH_STYLE: boolean;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_TTL_SECONDS: number;
  JWT_REFRESH_TTL_SECONDS: number;
}

export function validateEnvironment(
  raw: Record<string, unknown>,
): Record<string, unknown> & Environment {
  const nodeEnv = String(raw.NODE_ENV ?? 'development');
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error(
      'NODE_ENV는 development, test, production 중 하나여야 합니다.',
    );
  }

  const port = Number(raw.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT는 1부터 65535 사이의 정수여야 합니다.');
  }

  const databaseUrl = String(raw.DATABASE_URL ?? '');
  if (!databaseUrl.startsWith('postgresql://')) {
    throw new Error('DATABASE_URL은 postgresql://로 시작해야 합니다.');
  }

  const corsOrigins = String(raw.CORS_ORIGINS ?? DEFAULT_CORS_ORIGINS.join(','))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const mediaPublicBaseUrl = String(
    raw.MEDIA_PUBLIC_BASE_URL ??
      (nodeEnv === 'production' ? '' : 'http://localhost:9000/iwtc'),
  ).replace(/\/+$/, '');
  if (!/^https?:\/\//.test(mediaPublicBaseUrl)) {
    throw new Error('MEDIA_PUBLIC_BASE_URL은 유효한 HTTP(S) URL이어야 합니다.');
  }
  if (nodeEnv === 'production' && !mediaPublicBaseUrl.startsWith('https://')) {
    throw new Error('운영 MEDIA_PUBLIC_BASE_URL은 HTTPS URL이어야 합니다.');
  }

  const s3Endpoint = String(
    raw.S3_ENDPOINT ?? (nodeEnv === 'production' ? '' : 'http://localhost:9000'),
  ).replace(/\/+$/, '');
  if (!/^https?:\/\//.test(s3Endpoint)) {
    throw new Error('S3_ENDPOINT는 유효한 HTTP(S) URL이어야 합니다.');
  }
  if (nodeEnv === 'production' && !s3Endpoint.startsWith('https://')) {
    throw new Error('운영 S3_ENDPOINT는 HTTPS URL이어야 합니다.');
  }

  const s3Region = String(raw.S3_REGION ?? 'us-east-1').trim();
  const s3Bucket = String(raw.S3_BUCKET ?? 'iwtc').trim();
  const s3AccessKeyId = String(
    raw.S3_ACCESS_KEY_ID ??
      (nodeEnv === 'production' ? '' : 'local-minio-access-key'),
  ).trim();
  const s3SecretAccessKey = String(
    raw.S3_SECRET_ACCESS_KEY ??
      (nodeEnv === 'production' ? '' : 'local-minio-secret-key'),
  ).trim();
  if (!s3Region || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(s3Bucket)) {
    throw new Error('S3_REGION과 S3_BUCKET 설정을 확인해주세요.');
  }
  if (!s3AccessKeyId || !s3SecretAccessKey) {
    throw new Error('S3 접근 키와 비밀 키가 필요합니다.');
  }

  const forcePathStyleValue = String(raw.S3_FORCE_PATH_STYLE ?? 'true');
  if (!['true', 'false'].includes(forcePathStyleValue)) {
    throw new Error('S3_FORCE_PATH_STYLE은 true 또는 false여야 합니다.');
  }

  const jwtAccessSecret = String(raw.JWT_ACCESS_SECRET ?? '');
  const jwtRefreshSecret = String(raw.JWT_REFRESH_SECRET ?? '');
  if (jwtAccessSecret.length < 32 || jwtRefreshSecret.length < 32) {
    throw new Error('JWT secret은 각각 32자 이상이어야 합니다.');
  }
  if (jwtAccessSecret === jwtRefreshSecret) {
    throw new Error('access token과 refresh token의 secret은 달라야 합니다.');
  }

  const jwtAccessTtlSeconds = Number(raw.JWT_ACCESS_TTL_SECONDS ?? 900);
  const jwtRefreshTtlSeconds = Number(raw.JWT_REFRESH_TTL_SECONDS ?? 2592000);
  if (!Number.isInteger(jwtAccessTtlSeconds) || jwtAccessTtlSeconds < 60) {
    throw new Error('JWT_ACCESS_TTL_SECONDS는 60 이상의 정수여야 합니다.');
  }
  if (
    !Number.isInteger(jwtRefreshTtlSeconds) ||
    jwtRefreshTtlSeconds < jwtAccessTtlSeconds
  ) {
    throw new Error(
      'JWT_REFRESH_TTL_SECONDS는 access token 수명 이상의 정수여야 합니다.',
    );
  }

  return {
    ...raw,
    NODE_ENV: nodeEnv as Environment['NODE_ENV'],
    PORT: port,
    DATABASE_URL: databaseUrl,
    CORS_ORIGINS: corsOrigins,
    MEDIA_PUBLIC_BASE_URL: mediaPublicBaseUrl,
    S3_ENDPOINT: s3Endpoint,
    S3_REGION: s3Region,
    S3_BUCKET: s3Bucket,
    S3_ACCESS_KEY_ID: s3AccessKeyId,
    S3_SECRET_ACCESS_KEY: s3SecretAccessKey,
    S3_FORCE_PATH_STYLE: forcePathStyleValue === 'true',
    JWT_ACCESS_SECRET: jwtAccessSecret,
    JWT_REFRESH_SECRET: jwtRefreshSecret,
    JWT_ACCESS_TTL_SECONDS: jwtAccessTtlSeconds,
    JWT_REFRESH_TTL_SECONDS: jwtRefreshTtlSeconds,
  };
}
