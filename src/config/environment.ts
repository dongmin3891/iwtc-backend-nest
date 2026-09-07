const DEFAULT_CORS_ORIGINS = ['http://localhost:3000'];

export interface Environment {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DATABASE_URL: string;
  CORS_ORIGINS: string[];
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

  return {
    ...raw,
    NODE_ENV: nodeEnv as Environment['NODE_ENV'],
    PORT: port,
    DATABASE_URL: databaseUrl,
    CORS_ORIGINS: corsOrigins,
  };
}
