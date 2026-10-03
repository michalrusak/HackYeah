import {
  Catch,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { ErrorCodes, type ErrorCode } from '@repo/api-contracts';
import type { Response } from 'express';
import { AiError } from '../ai/openrouter.client.js';
import { DomainError } from '../errors/domain.error.js';

// Front mapuje kody na własne tłumaczenia; te komunikaty są zapasem dla
// klientów, które tego nie robią.
const AI_MESSAGES: Partial<Record<ErrorCode, string>> = {
  [ErrorCodes.AI_NOT_CONFIGURED]:
    'Usługa AI nie została skonfigurowana. Administrator musi dodać klucz OpenRouter.',
  [ErrorCodes.AI_UNAVAILABLE]:
    'Usługa AI jest chwilowo niedostępna. Spróbuj ponownie za chwilę.',
  [ErrorCodes.AI_TIMEOUT]:
    'Generowanie trwało zbyt długo. Spróbuj ponownie lub skróć treść.',
  [ErrorCodes.AI_INVALID_RESPONSE]:
    'AI zwróciło odpowiedź, której nie możemy odczytać. Spróbuj ponownie.',
  [ErrorCodes.RATE_LIMIT]:
    'Osiągnięto limit zapytań. Odczekaj chwilę i spróbuj ponownie.',
};

@Catch(DomainError, AiError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainError | AiError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const message =
      exception instanceof DomainError
        ? exception.publicMessage
        : (AI_MESSAGES[exception.code] ?? 'Operacja AI nie powiodła się.');
    response.status(exception.status).json({
      success: false,
      error: { code: exception.code, message },
    });
  }
}
