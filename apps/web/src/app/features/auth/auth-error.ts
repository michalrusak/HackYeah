import { HttpErrorResponse } from '@angular/common/http';
import { ApiErrorResponseSchema } from '@repo/api-contracts';

export function authErrorKey(error: unknown, authenticating = false): string {
  const response =
    error instanceof HttpErrorResponse
      ? ApiErrorResponseSchema.safeParse(error.error)
      : null;
  const code = response?.success ? response.data.error.code : '';
  const messages: Record<string, string> = {
    INVALID_CREDENTIALS: 'invalidCredentials',
    LOGIN_TAKEN: 'loginTaken',
    CONFLICT: 'loginTaken',
    UNAUTHORIZED: authenticating ? 'invalidCredentials' : 'sessionExpired',
    VALIDATION_ERROR: 'validation',
    RATE_LIMIT: 'rateLimit',
  };
  return `auth.errors.${messages[code] ?? (error instanceof HttpErrorResponse && error.status === 429 ? 'rateLimit' : 'generic')}`;
}
