import { S3Client } from '@aws-sdk/client-s3';
import type { ConfigService } from '@nestjs/config';

export const S3_CLIENT = Symbol('S3_CLIENT');

export function createS3Client(config: ConfigService): S3Client {
  return new S3Client({
    endpoint: config.getOrThrow<string>('S3_ENDPOINT'),
    region: config.getOrThrow<string>('S3_REGION'),
    forcePathStyle: config.getOrThrow<boolean>('S3_FORCE_PATH_STYLE'),
    credentials: {
      accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY_ID'),
      secretAccessKey: config.getOrThrow<string>('S3_SECRET_ACCESS_KEY'),
    },
  });
}
