import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
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
import { CreateManagedWorldCupDto } from './dto/create-managed-world-cup.dto.js';
import { ManageWorldCupsService } from './manage-world-cups.service.js';
import type {
  ManagedWorldCupDetail,
  ManagedWorldCupSummary,
} from './manage-world-cups.types.js';

@ApiTags('world-cup-management')
@Controller('me/game-manage/world-cups')
@UseGuards(AccessTokenGuard)
@ApiUnauthorizedResponse({ description: '로그인 필요' })
export class ManageWorldCupsController {
  constructor(
    private readonly manageWorldCupsService: ManageWorldCupsService,
  ) {}

  @Get()
  @ApiOperation({ summary: '내 월드컵 목록 조회' })
  @ApiOkResponse({ description: '자신의 게임 리스트 조회' })
  async findAll(
    @Req() request: Request & AuthenticatedRequest,
  ): Promise<ApiResponse<ManagedWorldCupSummary[]>> {
    const worldCups = await this.manageWorldCupsService.findAll(
      request.member.id,
    );
    return success('자신의 게임 리스트 조회', worldCups);
  }

  @Get(':worldCupId')
  @ApiOperation({ summary: '내 월드컵 상세 조회' })
  @ApiOkResponse({ description: '자신의 월드컵 조회' })
  @ApiNotFoundResponse({ description: '소유한 월드컵을 찾을 수 없음' })
  async findOne(
    @Param('worldCupId', ParseIntPipe) worldCupId: number,
    @Req() request: Request & AuthenticatedRequest,
  ): Promise<ApiResponse<ManagedWorldCupDetail>> {
    const worldCup = await this.manageWorldCupsService.findOne(
      request.member.id,
      worldCupId,
    );
    return success('자신의 월드컵 조회', worldCup);
  }

  @Post()
  @ApiOperation({ summary: '내 월드컵 생성' })
  @ApiCreatedResponse({ description: '게임 생성' })
  async create(
    @Body() body: CreateManagedWorldCupDto,
    @Req() request: Request & AuthenticatedRequest,
  ): Promise<ApiResponse<number>> {
    const worldCupId = await this.manageWorldCupsService.create(
      request.member.id,
      body,
    );
    return success('게임 생성', worldCupId);
  }
}
