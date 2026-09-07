import { Module } from '@nestjs/common';
import { WorldCupsController } from './world-cups.controller.js';
import { WorldCupsService } from './world-cups.service.js';

@Module({
  controllers: [WorldCupsController],
  providers: [WorldCupsService],
})
export class WorldCupsModule {}
