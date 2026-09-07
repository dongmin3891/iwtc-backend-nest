import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { success, type ApiResponse } from '../common/api-response.js';
import { GetWorldCupContentsQuery } from './dto/get-world-cup-contents.query.js';
import { ListWorldCupsQuery } from './dto/list-world-cups.query.js';
import { WorldCupsService } from './world-cups.service.js';
import type {
  AvailableRounds,
  WorldCupContents,
  WorldCupPage,
} from './world-cups.types.js';

@ApiTags('world-cups')
@Controller('world-cups')
export class WorldCupsController {
  constructor(private readonly worldCupsService: WorldCupsService) {}

  @Get()
  @ApiOperation({ summary: '공개 월드컵 목록 조회' })
  @ApiOkResponse({ description: '월드컵 페이지 조회 성공' })
  async findAll(
    @Query() query: ListWorldCupsQuery,
  ): Promise<ApiResponse<WorldCupPage>> {
    const page = await this.worldCupsService.findAll(query);
    return success('월드컵 페이지 조회 성공', page);
  }

  @Get(':worldCupId/available-rounds')
  @ApiOperation({ summary: '플레이 가능한 라운드 조회' })
  @ApiOkResponse({ description: '플레이 가능한 라운드 조회 성공' })
  async findAvailableRounds(
    @Param('worldCupId', ParseIntPipe) worldCupId: number,
  ): Promise<ApiResponse<AvailableRounds>> {
    const rounds = await this.worldCupsService.findAvailableRounds(worldCupId);
    return success('플레이 가능한 라운드 조회 성공', rounds);
  }

  @Get(':worldCupId/contents')
  @ApiOperation({ summary: '월드컵 대진 후보 조회' })
  @ApiOkResponse({ description: '컨텐츠 조회 성공' })
  async findContents(
    @Param('worldCupId', ParseIntPipe) worldCupId: number,
    @Query() query: GetWorldCupContentsQuery,
  ): Promise<ApiResponse<WorldCupContents>> {
    const contents = await this.worldCupsService.findContents(
      worldCupId,
      query,
    );
    return success('컨텐츠 조회 성공', contents);
  }
}
