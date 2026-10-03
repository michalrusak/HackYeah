import { ForbiddenException } from '@nestjs/common';
import { ErrorCodes } from '@repo/api-contracts';
import type { CookieOptions, Request } from 'express';

export const SESSION_COOKIE = 'hackyeah_session';

export function allowedWebOrigins(): string[] {
  return (process.env.WEB_ORIGIN ?? `http://localhost:${process.env.WEB_PORT ?? '4200'}`)
    .split(',')
    .map((origin) => new URL(origin.trim()).origin);
}

export function assertTrustedOrigin(request: Request): void {
  const origin = request.get('origin');
  if (!origin || !allowedWebOrigins().includes(origin)) {
    throw new ForbiddenException({
      success: false,
      error: { code: ErrorCodes.FORBIDDEN, message: 'Żądanie musi pochodzić z aplikacji.' },
    });
  }
}

export function sessionToken(request: Request): string | undefined {
  return request.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
}

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api',
  };
}

export interface TesterRequest extends Request {
  testerOwnerHash?: string;
}
