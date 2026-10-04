import { BadRequestException, type PipeTransform } from '@nestjs/common';
import { ErrorCodes } from '@repo/api-contracts';

interface ParsingSchema<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
}

export class KnowledgeValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ParsingSchema<T>) {}
  transform(value: unknown): T {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        success: false,
        error: {
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'Sprawdź wymagane pola i format danych.',
        },
      });
    }
    return parsed.data;
  }
}
