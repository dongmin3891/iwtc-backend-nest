import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ManageWorldCupsController } from './manage-world-cups.controller.js';
import { ManageWorldCupsService } from './manage-world-cups.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ManageWorldCupsController],
  providers: [ManageWorldCupsService],
})
export class ManageWorldCupsModule {}
