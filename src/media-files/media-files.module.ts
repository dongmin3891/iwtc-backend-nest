import { Module } from '@nestjs/common';
import { MediaFilesController } from './media-files.controller.js';
import { MediaFilesService } from './media-files.service.js';

@Module({
  controllers: [MediaFilesController],
  providers: [MediaFilesService],
})
export class MediaFilesModule {}
