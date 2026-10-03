import {
  BadRequestException,
  createParamDecorator,
  Injectable,
  UnauthorizedException,
  type ExecutionContext,
  type PipeTransform,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ErrorCodes, TesterOwnerKeySchema } from '@repo/api-contracts';
import type { TesterRequest } from '../auth/auth-http.js';

interface InputSchema<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
}

export class TesterValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: InputSchema<T>) {}
  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success)
      throw new BadRequestException({
        success: false,
        error: {
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'Sprawdź poprawność danych formularza.',
        },
      });
    return result.data;
  }
}

@Injectable()
export class TesterOwnerKeyPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    const result = TesterOwnerKeySchema.safeParse(value);
    if (!result.success)
      throw new UnauthorizedException({
        success: false,
        error: {
          code: ErrorCodes.UNAUTHORIZED,
          message: 'Brak poprawnego klucza dostępu do profilu.',
        },
      });
    return createHash('sha256').update(result.data).digest('hex');
  }
}

export const TesterOwner = createParamDecorator(
  (_data: undefined, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<TesterRequest>();
    if (!request.testerOwnerHash) throw new UnauthorizedException();
    return request.testerOwnerHash;
  },
);
