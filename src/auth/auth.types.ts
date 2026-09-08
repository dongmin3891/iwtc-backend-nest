export interface MemberSummary {
  id: number;
  serviceId: string;
  nickname: string;
}

export interface AccessTokenPayload {
  sub: number;
  sid: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: number;
  jti: string;
  familyId: string;
  type: 'refresh';
}

export interface AuthenticatedRequest {
  member: MemberSummary;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}
