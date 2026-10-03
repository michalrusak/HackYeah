import { Body, Controller, Inject, Post, Res } from '@nestjs/common';
import type {
  ApiErrorResponse,
  ApiSuccessResponse,
  MatchmakingData,
  MatchmakingRequest,
} from '@repo/api-contracts';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { MatchmakingValidationPipe } from './matchmaking-validation.pipe.js';
import { MatchmakingService } from './matchmaking.service.js';

@Controller('matchmaking')
export class MatchmakingController {
  constructor(
    @Inject(MatchmakingService) private readonly service: MatchmakingService,
  ) {}

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async match(
    @Body(new MatchmakingValidationPipe()) body: MatchmakingRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<MatchmakingData> | ApiErrorResponse> {
    const outcome = await this.service.match(body.description, body.answers);
    response.status(outcome.status);
    return outcome.body;
  }
}
