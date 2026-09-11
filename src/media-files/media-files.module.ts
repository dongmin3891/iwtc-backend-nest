import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaFilesController } from './media-files.controller.js';
import { MediaFilesService } from './media-files.service.js';
import { ObjectStorageService } from './object-storage.service.js';
import { createS3Client, S3_CLIENT } from './s3-client.provider.js';

@Module({
  controllers: [MediaFilesController],
  providers: [
    MediaFilesService,
    ObjectStorageService,
    {
      provide: S3_CLIENT,
      inject: [ConfigService],
      useFactory: createS3Client,
    },
  ],
  exports: [ObjectStorageService],
})
export class MediaFilesModule {}
