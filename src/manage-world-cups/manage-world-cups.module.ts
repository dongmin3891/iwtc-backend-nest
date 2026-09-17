import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MediaFilesModule } from '../media-files/media-files.module.js';
import { AutomationGuard } from './automation.guard.js';
import { AutomationWorldCupAttributionService } from './automation-world-cup-attribution.service.js';
import { AutomationWorldCupsController } from './automation-world-cups.controller.js';
import { ManageWorldCupContentsController } from './manage-world-cup-contents.controller.js';
import { ManageWorldCupContentsService } from './manage-world-cup-contents.service.js';
import { ManageWorldCupsController } from './manage-world-cups.controller.js';
import { ManageWorldCupsService } from './manage-world-cups.service.js';

@Module({
  imports: [AuthModule, MediaFilesModule],
  controllers: [
    ManageWorldCupsController,
    ManageWorldCupContentsController,
    AutomationWorldCupsController,
  ],
  providers: [
    ManageWorldCupsService,
    ManageWorldCupContentsService,
    AutomationGuard,
    AutomationWorldCupAttributionService,
  ],
})
export class ManageWorldCupsModule {}
