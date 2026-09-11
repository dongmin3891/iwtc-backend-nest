import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { success, type ApiResponse } from '../common/api-response.js';
import { CreateWorldCupContentsDto } from './dto/create-world-cup-contents.dto.js';
import { CreateStaticWorldCupContentDto } from './dto/create-static-world-cup-content.dto.js';
import { UpdateWorldCupContentsDto } from './dto/update-world-cup-contents.dto.js';
import { ManageWorldCupContentsService } from './manage-world-cup-contents.service.js';
import type { ManagedWorldCupContent } from './manage-world-cup-contents.types.js';
import {
  MAX_STATIC_IMAGE_SIZE,
  StaticImageFilePipe,
  type UploadedStaticImage,
} from './static-image-file.js';

@ApiTags('world-cup-content-management')
@Controller('me/game-contents-manage/world-cups')
@UseGuards(AccessTokenGuard)
@ApiUnauthorizedResponse({ description: '로그인 필요' })
export class ManageWorldCupContentsController {
  constructor(
    private readonly manageWorldCupContentsService: ManageWorldCupContentsService,
  ) {}

  @Post(':worldCupId/contents')
  @ApiOperation({ summary: '내 월드컵 후보 일괄 생성' })
  @ApiCreatedResponse({ description: '게임 생성' })
  @ApiBadRequestResponse({ description: '후보 생성 요청이 올바르지 않음' })
  @ApiNotFoundResponse({ description: '소유한 월드컵을 찾을 수 없음' })
  async create(
    @Param('worldCupId', ParseIntPipe) worldCupId: number,
    @Body() body: CreateWorldCupContentsDto,
    @Req() request: Request & AuthenticatedRequest,
  ): Promise<ApiResponse<null>> {
    await this.manageWorldCupContentsService.createMany(
      request.member.id,
      worldCupId,
      body.data,
    );
    return success('게임 생성', null);
  }

  @Post(':worldCupId/contents/static')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_STATIC_IMAGE_SIZE } }),
  )
  @ApiOperation({ summary: '내 월드컵 이미지 후보 생성' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['contentsName', 'visibleType', 'file'],
      properties: {
        contentsName: { type: 'string', minLength: 1, maxLength: 100 },
        visibleType: { type: 'string', enum: ['PUBLIC', 'PRIVATE'] },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiCreatedResponse({ description: '이미지 후보 생성' })
  @ApiBadRequestResponse({
    description: '후보 또는 이미지 파일이 올바르지 않음',
  })
  @ApiNotFoundResponse({ description: '소유한 월드컵을 찾을 수 없음' })
  async createStatic(
    @Param('worldCupId', ParseIntPipe) worldCupId: number,
    @Body() body: CreateStaticWorldCupContentDto,
    @UploadedFile(StaticImageFilePipe) file: UploadedStaticImage,
    @Req() request: Request & AuthenticatedRequest,
  ): Promise<ApiResponse<number>> {
    const candidateId =
      await this.manageWorldCupContentsService.createStaticImage(
        request.member.id,
        worldCupId,
        body,
        file,
      );
    return success('이미지 후보 생성', candidateId);
  }

  @Put(':worldCupId/contents/:contentsId/static')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_STATIC_IMAGE_SIZE } }),
  )
  @ApiOperation({ summary: '내 월드컵 이미지 후보 수정' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['contentsName', 'visibleType'],
      properties: {
        contentsName: { type: 'string', minLength: 1, maxLength: 100 },
        visibleType: { type: 'string', enum: ['PUBLIC', 'PRIVATE'] },
        file: {
          type: 'string',
          format: 'binary',
          description: '이미지를 교체할 때만 전송',
        },
      },
    },
  })
  @ApiNoContentResponse({ description: '이미지 후보 수정 성공' })
  @ApiBadRequestResponse({
    description: '후보 또는 이미지 파일이 올바르지 않음',
  })
  @ApiNotFoundResponse({
    description: '소유한 월드컵, 활성 이미지 후보 또는 미디어를 찾을 수 없음',
  })
  async updateStatic(
    @Param('worldCupId', ParseIntPipe) worldCupId: number,
    @Param('contentsId', ParseIntPipe) contentsId: number,
    @Body() body: CreateStaticWorldCupContentDto,
    @UploadedFile() file: UploadedStaticImage | undefined,
    @Req() request: Request & AuthenticatedRequest,
  ): Promise<void> {
    await this.manageWorldCupContentsService.updateStaticImage(
      request.member.id,
      worldCupId,
      contentsId,
      body,
      file,
    );
  }

  @Put(':worldCupId/contents/:contentsId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '내 월드컵 후보 수정' })
  @ApiNoContentResponse({ description: '후보 수정 성공' })
  @ApiBadRequestResponse({ description: '후보 수정 요청이 올바르지 않음' })
  @ApiNotFoundResponse({
    description: '소유한 월드컵, 후보 또는 미디어를 찾을 수 없음',
  })
  async update(
    @Param('worldCupId', ParseIntPipe) worldCupId: number,
    @Param('contentsId', ParseIntPipe) contentsId: number,
    @Body() body: UpdateWorldCupContentsDto,
    @Req() request: Request & AuthenticatedRequest,
  ): Promise<void> {
    await this.manageWorldCupContentsService.updateOne(
      request.member.id,
      worldCupId,
      contentsId,
      body,
    );
  }

  @Delete(':worldCupId/contents/:contentsId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '내 월드컵 후보 삭제' })
  @ApiNoContentResponse({ description: '후보 삭제 성공' })
  @ApiNotFoundResponse({
    description: '소유한 월드컵 또는 활성 후보를 찾을 수 없음',
  })
  async remove(
    @Param('worldCupId', ParseIntPipe) worldCupId: number,
    @Param('contentsId', ParseIntPipe) contentsId: number,
    @Req() request: Request & AuthenticatedRequest,
  ): Promise<void> {
    await this.manageWorldCupContentsService.remove(
      request.member.id,
      worldCupId,
      contentsId,
    );
  }

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
