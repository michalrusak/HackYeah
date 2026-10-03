import { HttpErrorResponse } from '@angular/common/http';
import { ApiErrorResponseSchema } from '@repo/api-contracts';

export function knowledgeError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const body = ApiErrorResponseSchema.safeParse(error.error);
    const code = body.success ? body.data.error.code : '';
    if (error.status === 429) return 'knowledge.errors.rateLimit';
    if (code === 'UNAUTHORIZED') return 'knowledge.errors.unauthorized';
    if (code === 'FORBIDDEN') return 'knowledge.errors.forbidden';
    if (code === 'CONFLICT') return 'knowledge.errors.conflict';
    if (code === 'ADMIN_NOT_CONFIGURED')
      return 'knowledge.errors.notConfigured';
    if (code === 'VALIDATION_ERROR') return 'knowledge.errors.validation';
  }
  return 'knowledge.errors.generic';
}
