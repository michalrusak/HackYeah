import { HttpErrorResponse } from '@angular/common/http';
import { ApiErrorResponseSchema } from '@repo/api-contracts';

const KEYS: Record<string, string> = {
  VALIDATION_ERROR: 'validation',
  NOT_FOUND: 'notFound',
  FORBIDDEN: 'forbidden',
  CONFLICT: 'conflict',
  CALL_CLOSED: 'callClosed',
  RATE_LIMIT: 'rateLimit',
  AI_NOT_CONFIGURED: 'aiNotConfigured',
  AI_UNAVAILABLE: 'aiUnavailable',
  AI_TIMEOUT: 'aiTimeout',
  AI_INVALID_RESPONSE: 'aiInvalidResponse',
};

/** Zamienia kod błędu z koperty API na klucz tłumaczenia `ideaCreator.errors.*`. */
export function toErrorKey(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return 'ideaCreator.errors.generic';
  }
  const parsed = ApiErrorResponseSchema.safeParse(error.error);
  const code = parsed.success ? parsed.data.error.code : null;
  if (code && KEYS[code]) return `ideaCreator.errors.${KEYS[code]}`;
  if (error.status === 429) return 'ideaCreator.errors.rateLimit';
  if (error.status === 404) return 'ideaCreator.errors.notFound';
  return 'ideaCreator.errors.generic';
}
