import { BadRequestException, type PipeTransform } from '@nestjs/common';
import { ErrorCodes } from '@repo/api-contracts';

/**
 * Minimalny kształt schematu Zoda. API nie zależy od pakietu `zod` bezpośrednio
 * — schematy żyją w `@repo/api-contracts`, a tu wystarcza `safeParse`.
 */
export interface JsonSchema<T> {
  safeParse(
    data: unknown,
  ): { success: true; data: T } | { success: false };
}

/**
 * Generyczna wersja pipe'a z modułu matchmakingu — przyjmuje dowolny schemat
 * i komunikat, zamiast powielać tę samą klasę dla każdego endpointu.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(
    private readonly schema: JsonSchema<T>,
    private readonly message: string,
  ) {}

  transform(value: unknown): T {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        success: false,
        error: {
          code: ErrorCodes.VALIDATION_ERROR,
          message: this.message,
        },
      });
    }
    return parsed.data;
  }
}
