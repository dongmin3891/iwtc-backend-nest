import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ManageWorldCupContentsController } from './manage-world-cup-contents.controller.js';
import { ManageWorldCupContentsService } from './manage-world-cup-contents.service.js';
import { ManageWorldCupsController } from './manage-world-cups.controller.js';
import { ManageWorldCupsService } from './manage-world-cups.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ManageWorldCupsController, ManageWorldCupContentsController],
  providers: [ManageWorldCupsService, ManageWorldCupContentsService],
})
export class ManageWorldCupsModule {}
