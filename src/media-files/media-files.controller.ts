import {
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { success, type ApiResponse } from '../common/api-response.js';
import { GetMediaFileQuery } from './dto/get-media-file.query.js';
import { MediaFilesService } from './media-files.service.js';
import type { MediaFileResponse } from './media-files.types.js';

@ApiTags('media-files')
@Controller('media-files')
export class MediaFilesController {
  constructor(private readonly mediaFilesService: MediaFilesService) {}

  @Get(':mediaFileId')
  @Header('Cache-Control', 'public, no-cache')
  @ApiOperation({ summary: '미디어 파일 조회' })
  @ApiOkResponse({ description: '미디어 파일 조회' })
  @ApiNotFoundResponse({ description: '미디어 파일을 찾을 수 없음' })
  async findOne(
    @Param('mediaFileId', ParseIntPipe) mediaFileId: number,
    @Query() query: GetMediaFileQuery,
  ): Promise<ApiResponse<MediaFileResponse>> {
    const mediaFile = await this.mediaFilesService.findOne(
      mediaFileId,
      query.size,
    );
    return success('미디어 파일 조회', mediaFile);
  }
}
