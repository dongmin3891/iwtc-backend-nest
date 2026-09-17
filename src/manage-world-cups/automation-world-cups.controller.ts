import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { success, type ApiResponse } from '../common/api-response.js';
import { AutomationGuard } from './automation.guard.js';
import { AutomationWorldCupAttributionService } from './automation-world-cup-attribution.service.js';
import { CreateAutomationStaticWorldCupContentDto } from './dto/create-automation-static-world-cup-content.dto.js';
import { CreateAutomationWorldCupDto } from './dto/create-automation-world-cup.dto.js';
import { ManageWorldCupContentsService } from './manage-world-cup-contents.service.js';
import {
  ManageWorldCupsService,
  type PublishedAutomationWorldCup,
} from './manage-world-cups.service.js';
import {
  MAX_STATIC_IMAGE_SIZE,
  StaticImageFilePipe,
  type UploadedStaticImage,
} from './static-image-file.js';

@ApiTags('internal-automation')
@Controller('internal/automation/world-cups')
@UseGuards(AutomationGuard)
export class AutomationWorldCupsController {
  private readonly memberId: number;

  constructor(
    private readonly manageWorldCupsService: ManageWorldCupsService,
    private readonly manageWorldCupContentsService: ManageWorldCupContentsService,
    private readonly attributionService: AutomationWorldCupAttributionService,
    config: ConfigService,
  ) {
    this.memberId = config.get<number>('IWTC_AUTOMATION_MEMBER_ID') ?? 0;
  }

  @Post()
  @ApiOperation({ summary: '자동화 전용 비공개 월드컵 생성' })
  @ApiCreatedResponse({ description: '비공개 월드컵 생성' })
  async createWorldCup(
    @Body() body: CreateAutomationWorldCupDto,
  ): Promise<ApiResponse<number>> {
    const worldCupId = await this.manageWorldCupsService.create(this.memberId, {
      title: body.title,
      description: body.description,
      visibleType: 'PRIVATE',
    });
    return success('자동화 비공개 월드컵 생성', worldCupId);
  }

  @Post(':worldCupId/contents/static')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_STATIC_IMAGE_SIZE } }),
  )
  @ApiOperation({ summary: '자동화 전용 비공개 이미지 후보 생성' })
  @ApiCreatedResponse({ description: '비공개 이미지 후보 생성' })
  async createStaticCandidate(
    @Param('worldCupId', ParseIntPipe) worldCupId: number,
    @Body() body: CreateAutomationStaticWorldCupContentDto,
    @UploadedFile(StaticImageFilePipe) file: UploadedStaticImage,
  ): Promise<ApiResponse<number>> {
    const candidateId =
      await this.manageWorldCupContentsService.createStaticImage(
        this.memberId,
        worldCupId,
        {
          contentsName: body.contentsName,
          visibleType: 'PRIVATE',
        },
        file,
      );

    await this.attributionService.saveCandidateAttribution(
      this.memberId,
      worldCupId,
      candidateId,
      {
        sourceProvider: body.sourceProvider,
        sourceExternalId: body.sourceExternalId,
        sourceUrl: body.sourceUrl,
        sourceAuthor: body.sourceAuthor,
        sourceAuthorUrl: body.sourceAuthorUrl,
      },
    );

    return success('자동화 비공개 이미지 후보 생성', candidateId);
  }

  @Post(':worldCupId/publish')
  @ApiOperation({ summary: '자동화 월드컵 출처 검증 후 공개' })
  @ApiCreatedResponse({ description: '월드컵 및 후보 공개 완료' })
  async publishWorldCup(
    @Param('worldCupId', ParseIntPipe) worldCupId: number,
  ): Promise<ApiResponse<PublishedAutomationWorldCup>> {
    const result = await this.manageWorldCupsService.publishAutomationDraft(
      this.memberId,
      worldCupId,
    );

    return success('자동화 월드컵 공개', result);
  }
}
