import { Body, Controller, Inject, Post, Res } from '@nestjs/common';
import type {
  ApiErrorResponse,
  ApiSuccessResponse,
  MatchmakingData,
  MatchmakingRequest,
} from '@repo/api-contracts';
import type { Response } from 'express';
import { MatchmakingValidationPipe } from './matchmaking-validation.pipe.js';
import { MatchmakingService } from './matchmaking.service.js';

@Controller('matchmaking')
export class MatchmakingController {
  constructor(
    @Inject(MatchmakingService) private readonly service: MatchmakingService,
  ) {}

  @Post()
  async match(
    @Body(new MatchmakingValidationPipe()) body: MatchmakingRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<MatchmakingData> | ApiErrorResponse> {
    const outcome = await this.service.match(body.description);
    response.status(outcome.status);
    return outcome.body;
  }
}
