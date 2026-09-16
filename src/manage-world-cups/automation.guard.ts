import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

export const AUTOMATION_TOKEN_HEADER = 'x-iwtc-automation-token';

@Injectable()
export class AutomationGuard implements CanActivate {
  private readonly expectedToken: string;

  constructor(config: ConfigService) {
    this.expectedToken = config.get<string>('IWTC_AUTOMATION_TOKEN') ?? '';
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.expectedToken) {
      throw new UnauthorizedException('Automation access is not configured.');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers[AUTOMATION_TOKEN_HEADER];
    const token = Array.isArray(header) ? header[0] : header;
    if (!token) {
      throw new UnauthorizedException('Automation token is required.');
    }

    const provided = Buffer.from(token);
    const expected = Buffer.from(this.expectedToken);
    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      throw new UnauthorizedException('Invalid automation token.');
    }

    return true;
  }
}
