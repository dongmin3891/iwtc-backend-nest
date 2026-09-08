import type { Request } from 'express';

export function getAccessToken(request: Request): string | undefined {
  const header = request.headers['access-token'];
  return Array.isArray(header) ? header[0] : header;
}
