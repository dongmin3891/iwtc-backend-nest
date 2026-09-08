import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CommentActionsController } from './comment-actions.controller.js';
import { CommentsController } from './comments.controller.js';
import { CommentsService } from './comments.service.js';

@Module({
  imports: [AuthModule],
  controllers: [CommentsController, CommentActionsController],
  providers: [CommentsService],
})
export class CommentsModule {}
