import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { AuthService } from './auth.service.js';
import { OptionalAccessTokenGuard } from './optional-access-token.guard.js';

function createContext(request: { headers: Record<string, string> }) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('OptionalAccessTokenGuard', () => {
  it('allows a request without an access token as a guest', async () => {
    const authService = { authorizeAccess: vi.fn() };
    const guard = new OptionalAccessTokenGuard(
      authService as unknown as AuthService,
    );
    const request = { headers: {} };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(authService.authorizeAccess).not.toHaveBeenCalled();
    expect(request).not.toHaveProperty('member');
  });

  it('attaches the authenticated member when a valid token is present', async () => {
    const member = { id: 1, serviceId: 'member01', nickname: '동민' };
    const authService = {
      authorizeAccess: vi.fn().mockResolvedValue(member),
    };
    const guard = new OptionalAccessTokenGuard(
      authService as unknown as AuthService,
    );
    const request: {
      headers: Record<string, string>;
      member?: typeof member;
    } = { headers: { 'access-token': 'valid-token' } };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(authService.authorizeAccess).toHaveBeenCalledWith('valid-token');
    expect(request.member).toEqual(member);
  });

  it('rejects a request that includes an invalid token', async () => {
    const authService = {
      authorizeAccess: vi
        .fn()
        .mockRejectedValue(new UnauthorizedException('invalid token')),
    };
    const guard = new OptionalAccessTokenGuard(
      authService as unknown as AuthService,
    );
    const request = { headers: { 'access-token': 'invalid-token' } };

    await expect(
      guard.canActivate(createContext(request)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('does not downgrade an empty access token header to a guest', async () => {
    const authService = {
      authorizeAccess: vi
        .fn()
        .mockRejectedValue(new UnauthorizedException('invalid token')),
    };
    const guard = new OptionalAccessTokenGuard(
      authService as unknown as AuthService,
    );
    const request = { headers: { 'access-token': '' } };

    await expect(
      guard.canActivate(createContext(request)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authService.authorizeAccess).toHaveBeenCalledWith('');
  });
});
