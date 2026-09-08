import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommentsModule } from './comments/comments.module.js';
import { validateEnvironment } from './config/environment.js';
import { HealthModule } from './health/health.module.js';
import { MediaFilesModule } from './media-files/media-files.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { WorldCupsModule } from './world-cups/world-cups.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    PrismaModule,
    HealthModule,
    MediaFilesModule,
    WorldCupsModule,
    CommentsModule,
  ],
})
export class AppModule {}
