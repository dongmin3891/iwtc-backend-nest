import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import { success, type ApiResponse } from '../common/api-response.js';
import { AccessTokenGuard } from './access-token.guard.js';
import { REFRESH_COOKIE_NAME } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import type { AuthenticatedRequest, MemberSummary } from './auth.types.js';
import { SignInDto } from './dto/sign-in.dto.js';
import { SignUpDto } from './dto/sign-up.dto.js';

type RequestWithCookies = Request & {
  cookies?: Record<string, string | undefined>;
};

@ApiTags('members')
@Controller()
export class AuthController {
  private readonly refreshTtlSeconds: number;
  private readonly secureCookie: boolean;

  constructor(
    private readonly authService: AuthService,
    config: ConfigService,
  ) {
    this.refreshTtlSeconds = config.getOrThrow<number>(
      'JWT_REFRESH_TTL_SECONDS',
    );
    this.secureCookie = config.getOrThrow<string>('NODE_ENV') === 'production';
  }

  @Post('members/sign-up')
  @ApiOperation({ summary: '회원가입' })
  @ApiCreatedResponse({ description: '가입 성공' })
  @ApiConflictResponse({ description: '아이디 또는 닉네임 중복' })
  async signUp(@Body() request: SignUpDto): Promise<ApiResponse<null>> {
    await this.authService.signUp(request);
    return success('가입 성공', null);
  }

  @Post('members/sign-in')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '로그인' })
  @ApiOkResponse({ description: '로그인 성공' })
  @ApiUnauthorizedResponse({ description: '아이디 또는 비밀번호 불일치' })
  async signIn(
    @Body() request: SignInDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiResponse<null>> {
    const tokens = await this.authService.signIn(request);
    response.setHeader('access-token', tokens.accessToken);
    response.cookie(
      REFRESH_COOKIE_NAME,
      tokens.refreshToken,
      this.refreshCookieOptions(),
    );
    return success('로그인 성공', null);
  }

  @Get('members/me/summary')
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: '내 회원 정보 조회' })
  @ApiOkResponse({ description: '회원 정보 조회 성공' })
  @ApiUnauthorizedResponse({ description: '로그인 필요' })
  me(
    @Req() request: Request & AuthenticatedRequest,
  ): ApiResponse<MemberSummary> {
    return success('회원 정보 조회 성공', request.member);
  }

  @Post('members/sign-out')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '로그아웃' })
  async signOut(
    @Req() request: RequestWithCookies,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.signOut(request.cookies?.[REFRESH_COOKIE_NAME]);
    response.clearCookie(REFRESH_COOKIE_NAME, this.refreshCookieBaseOptions());
  }

  @Post('new-access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '토큰 갱신' })
  @ApiOkResponse({ description: '토큰 갱신 성공' })
  @ApiUnauthorizedResponse({ description: '갱신 토큰 만료 또는 재사용' })
  async refresh(
    @Req() request: RequestWithCookies,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiResponse<{ newAccessToken: string }>> {
    const refreshToken = request.cookies?.[REFRESH_COOKIE_NAME];
    if (!refreshToken) {
      throw new UnauthorizedException(
        '로그인이 만료되었습니다. 다시 로그인해주세요.',
      );
    }

    response.clearCookie(REFRESH_COOKIE_NAME, this.refreshCookieBaseOptions());
    const tokens = await this.authService.refresh(refreshToken);
    response.cookie(
      REFRESH_COOKIE_NAME,
      tokens.refreshToken,
      this.refreshCookieOptions(),
    );
    return success('토큰 갱신 성공', {
      newAccessToken: tokens.accessToken,
    });
  }

  private refreshCookieBaseOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.secureCookie,
      sameSite: 'lax',
      path: '/api',
    };
  }

  private refreshCookieOptions(): CookieOptions {
    return {
      ...this.refreshCookieBaseOptions(),
      maxAge: this.refreshTtlSeconds * 1000,
    };
  }
}
