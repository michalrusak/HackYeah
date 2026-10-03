import {
  BadRequestException,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import {
  ErrorCodes,
  MatchmakingRequestSchema,
  type MatchmakingRequest,
} from '@repo/api-contracts';

@Injectable()
export class MatchmakingValidationPipe implements PipeTransform<
  unknown,
  MatchmakingRequest
> {
  transform(value: unknown): MatchmakingRequest {
    const parsed = MatchmakingRequestSchema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        success: false,
        error: {
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'Opis musi zawierać od 1 do 4000 znaków.',
        },
      });
    }
    return parsed.data;
  }
}
