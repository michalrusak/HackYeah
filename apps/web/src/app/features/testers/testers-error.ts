import { HttpErrorResponse } from '@angular/common/http';
import { ApiErrorResponseSchema } from '@repo/api-contracts';

export function testerErrorKey(error: unknown): string {
  const response =
    error instanceof HttpErrorResponse
      ? ApiErrorResponseSchema.safeParse(error.error)
      : null;
  const code = response?.success ? response.data.error.code : '';
  const messages: Record<string, string> = {
    AI_NOT_CONFIGURED: 'notConfigured',
    AI_UNAVAILABLE: 'unavailable',
    AI_TIMEOUT: 'timeout',
    AI_INVALID_RESPONSE: 'invalidResponse',
    RATE_LIMIT: 'rateLimit',
    VALIDATION_ERROR: 'validation',
    NOT_FOUND: 'notFound',
    UNAUTHORIZED: 'sessionExpired',
  };
  return `testers.errors.${messages[code] ?? (error instanceof HttpErrorResponse && error.status === 429 ? 'rateLimit' : 'generic')}`;
}
