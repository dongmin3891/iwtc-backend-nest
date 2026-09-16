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
import { CreateAutomationWorldCupDto } from './dto/create-automation-world-cup.dto.js';
import { CreateStaticWorldCupContentDto } from './dto/create-static-world-cup-content.dto.js';
import { ManageWorldCupContentsService } from './manage-world-cup-contents.service.js';
import { ManageWorldCupsService } from './manage-world-cups.service.js';
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
    @Body() body: CreateStaticWorldCupContentDto,
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
    return success('자동화 비공개 이미지 후보 생성', candidateId);
  }
}
