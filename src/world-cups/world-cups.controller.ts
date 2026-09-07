import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { success, type ApiResponse } from '../common/api-response.js';
import { ListWorldCupsQuery } from './dto/list-world-cups.query.js';
import { WorldCupsService } from './world-cups.service.js';
import type { WorldCupPage } from './world-cups.types.js';

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
}
