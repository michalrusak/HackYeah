import { ErrorCodes, type ErrorCode } from '@repo/api-contracts';

/**
 * Błąd domenowy niosący gotowy kod i komunikat dla użytkownika. Mapowaniem na
 * kopertę odpowiedzi zajmuje się `DomainExceptionFilter`, więc serwisy nie
 * muszą zwracać par `{ status, body }`.
 */
export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
    readonly publicMessage: string,
  ) {
    super(`${code}: ${publicMessage}`);
    this.name = 'DomainError';
  }

  static notFound(publicMessage: string): DomainError {
    return new DomainError(ErrorCodes.NOT_FOUND, 404, publicMessage);
  }

  static forbidden(publicMessage: string): DomainError {
    return new DomainError(ErrorCodes.FORBIDDEN, 403, publicMessage);
  }

  static conflict(publicMessage: string): DomainError {
    return new DomainError(ErrorCodes.CONFLICT, 409, publicMessage);
  }

  static callClosed(publicMessage: string): DomainError {
    return new DomainError(ErrorCodes.CALL_CLOSED, 409, publicMessage);
  }

  static validation(publicMessage: string): DomainError {
    return new DomainError(ErrorCodes.VALIDATION_ERROR, 400, publicMessage);
  }
}
