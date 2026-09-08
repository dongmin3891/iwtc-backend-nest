import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import type { AuthenticatedRequest } from './auth.types.js';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & Partial<AuthenticatedRequest>>();
    const header = request.headers['access-token'];
    const accessToken = Array.isArray(header) ? header[0] : header;
    if (!accessToken) {
      throw new UnauthorizedException('로그인이 필요합니다.');
    }

    request.member = await this.authService.authorizeAccess(accessToken);
    return true;
  }
}
