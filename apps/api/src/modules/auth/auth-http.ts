import { ForbiddenException } from '@nestjs/common';
import { ErrorCodes } from '@repo/api-contracts';
import type { CookieOptions, Request } from 'express';

export const SESSION_COOKIE = 'hackyeah_session';

export function allowedWebOrigins(): string[] {
  const raw =
    process.env.WEB_ORIGIN ??
    `http://localhost:${process.env.WEB_PORT ?? '4200'}`;
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => new URL(entry).origin);
}

/** Brak nagłówka Origin = żądanie same-origin lub serwerowe — dozwolone. */
export function isAllowedWebOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  return allowedWebOrigins().includes(origin);
}

export function configureCorsOrigin(
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
): void {
  callback(null, isAllowedWebOrigin(origin));
}

export function assertTrustedOrigin(request: Request): void {
  const origin = request.get('origin');
  if (!origin || !allowedWebOrigins().includes(origin)) {
    throw new ForbiddenException({
      success: false,
      error: {
        code: ErrorCodes.FORBIDDEN,
        message: 'Żądanie musi pochodzić z aplikacji.',
      },
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

function useSecureCookies(): boolean {
  if (process.env.COOKIE_SECURE === 'true') return true;
  if (process.env.COOKIE_SECURE === 'false') return false;
  return process.env.NODE_ENV === 'production';
}

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: useSecureCookies(),
    path: '/api',
  };
}

export interface TesterRequest extends Request {
  testerOwnerHash?: string;
  testerAccountId?: string;
}
