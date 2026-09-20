import { Module } from '@nestjs/common';
import { MediaFilesModule } from '../media-files/media-files.module.js';
import { WorldCupsController } from './world-cups.controller.js';
import { WorldCupsService } from './world-cups.service.js';

@Module({
  imports: [MediaFilesModule],
  controllers: [WorldCupsController],
  providers: [WorldCupsService],
})
export class WorldCupsModule {}
