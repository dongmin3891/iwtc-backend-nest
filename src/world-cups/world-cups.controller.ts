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
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { success, type ApiResponse } from '../common/api-response.js';
import { ClearWorldCupDto } from './dto/clear-world-cup.dto.js';
import { GetWorldCupContentsQuery } from './dto/get-world-cup-contents.query.js';
import { ListWorldCupsQuery } from './dto/list-world-cups.query.js';
import { WorldCupsService } from './world-cups.service.js';
import type {
  AvailableRounds,
  ClearWorldCupResultContent,
  WorldCupContents,
  WorldCupPage,
  WorldCupRankingContent,
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

  @Post(':worldCupId/clear')
  @ApiOperation({ summary: '월드컵 게임 결과 저장' })
  @ApiCreatedResponse({ description: '게임 결과 생성' })
  @ApiBadRequestResponse({ description: '요청 또는 결과 후보가 올바르지 않음' })
  @ApiNotFoundResponse({ description: '월드컵을 찾을 수 없음' })
  @ApiConflictResponse({ description: '다른 결과에 사용된 playId' })
  async clearWorldCup(
    @Param('worldCupId', ParseIntPipe) worldCupId: number,
    @Body() request: ClearWorldCupDto,
  ): Promise<ApiResponse<ClearWorldCupResultContent[]>> {
    const result = await this.worldCupsService.saveGameResult(
      worldCupId,
      request,
    );
    return success('게임 결과 생성', result);
  }

  @Get(':worldCupId/game-result-contents')
  @ApiOperation({ summary: '월드컵 게임 결과 랭킹 조회' })
  @ApiOkResponse({ description: '게임 결과 컨텐츠 리스트 조회 성공' })
  @ApiNotFoundResponse({ description: '월드컵을 찾을 수 없음' })
  async findGameResultContents(
    @Param('worldCupId', ParseIntPipe) worldCupId: number,
  ): Promise<ApiResponse<WorldCupRankingContent[]>> {
    const result =
      await this.worldCupsService.findGameResultContents(worldCupId);
    return success('게임 결과 컨텐츠 리스트 조회 성공', result);
  }
}
