import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { success, type ApiResponse } from '../common/api-response.js';
import { CommentsService } from './comments.service.js';
import type { CommentListItem } from './comments.types.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { ListCommentsQuery } from './dto/list-comments.query.js';

@ApiTags('comments')
@Controller('world-cups')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get(':worldCupId/comments')
  @ApiOperation({ summary: '월드컵 댓글 목록 조회' })
  @ApiOkResponse({ description: '코멘트 조회 성공' })
  @ApiNotFoundResponse({ description: '월드컵을 찾을 수 없음' })
  async findAll(
    @Param('worldCupId', ParseIntPipe) worldCupId: number,
    @Query() query: ListCommentsQuery,
  ): Promise<ApiResponse<CommentListItem[]>> {
    const comments = await this.commentsService.findAll(worldCupId, query);
    return success('코멘트 조회 성공', comments);
  }

  @Post(':worldCupId/contents/:contentsId/comments')
  @ApiOperation({ summary: '월드컵 후보에 비회원 댓글 작성' })
  @ApiCreatedResponse({ description: '댓글 작성' })
  @ApiBadRequestResponse({
    description: '닉네임 또는 댓글 본문이 올바르지 않음',
  })
  @ApiNotFoundResponse({ description: '월드컵 또는 후보를 찾을 수 없음' })
  async create(
    @Param('worldCupId', ParseIntPipe) worldCupId: number,
    @Param('contentsId', ParseIntPipe) contentsId: number,
    @Body() request: CreateCommentDto,
  ): Promise<ApiResponse<null>> {
    await this.commentsService.create(worldCupId, contentsId, request);
    return success('댓글 작성', null);
  }
}
