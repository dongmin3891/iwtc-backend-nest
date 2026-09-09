import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { success, type ApiResponse } from '../common/api-response.js';
import { ManageWorldCupContentsService } from './manage-world-cup-contents.service.js';
import type { ManagedWorldCupContent } from './manage-world-cup-contents.types.js';

@ApiTags('world-cup-content-management')
@Controller('me/game-contents-manage/world-cups')
@UseGuards(AccessTokenGuard)
@ApiUnauthorizedResponse({ description: '로그인 필요' })
export class ManageWorldCupContentsController {
  constructor(
    private readonly manageWorldCupContentsService: ManageWorldCupContentsService,
  ) {}

  @Get(':worldCupId/manage-contents')
  @ApiOperation({ summary: '내 월드컵의 관리용 후보 목록 조회' })
  @ApiOkResponse({ description: '자신의 게임 컨텐츠 리스트 조회' })
  @ApiNotFoundResponse({ description: '소유한 월드컵을 찾을 수 없음' })
  async findAll(
    @Param('worldCupId', ParseIntPipe) worldCupId: number,
    @Req() request: Request & AuthenticatedRequest,
  ): Promise<ApiResponse<ManagedWorldCupContent[]>> {
    const contents = await this.manageWorldCupContentsService.findAll(
      request.member.id,
      worldCupId,
    );
    return success('자신의 게임 컨텐츠 리스트 조회', contents);
  }
}
