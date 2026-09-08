const DEFAULT_CORS_ORIGINS = ['http://localhost:3000'];

export interface Environment {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DATABASE_URL: string;
  CORS_ORIGINS: string[];
  MEDIA_PUBLIC_BASE_URL: string;
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
    JWT_ACCESS_SECRET: jwtAccessSecret,
    JWT_REFRESH_SECRET: jwtRefreshSecret,
    JWT_ACCESS_TTL_SECONDS: jwtAccessTtlSeconds,
    JWT_REFRESH_TTL_SECONDS: jwtRefreshTtlSeconds,
  };
}
