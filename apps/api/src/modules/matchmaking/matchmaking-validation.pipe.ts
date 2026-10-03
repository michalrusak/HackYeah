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
          message:
            'Podaj opis (1–4000 znaków) oraz maksymalnie 3 odpowiedzi (1–1000 znaków każda).',
        },
      });
    }
    return parsed.data;
  }
}
