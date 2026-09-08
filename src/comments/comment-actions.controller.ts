import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { CommentsService } from './comments.service.js';

@ApiTags('comments')
@Controller('comments')
export class CommentActionsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Delete(':commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: '작성 회원의 댓글 삭제' })
  @ApiNoContentResponse({ description: '댓글 삭제 성공' })
  @ApiUnauthorizedResponse({ description: '로그인 필요' })
  @ApiForbiddenResponse({ description: '댓글 작성자가 아님' })
  @ApiNotFoundResponse({ description: '댓글을 찾을 수 없음' })
  async remove(
    @Param('commentId', ParseIntPipe) commentId: number,
    @Req() request: Request & AuthenticatedRequest,
  ): Promise<void> {
    await this.commentsService.remove(commentId, request.member.id);
  }
}
