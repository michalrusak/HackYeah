import { Body, Controller, Inject, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  createApiSuccess,
  PilotMatchRequestSchema,
  type ApiSuccessResponse,
  type PilotMatchesData,
  type PilotMatchRequest,
} from '@repo/api-contracts';
import { TesterValidationPipe } from '../testers/testers-validation.pipe.js';
import { PilotMatchesService } from './pilot-matches.service.js';

@Controller('matchmaking/pilots')
export class PilotMatchesController {
  constructor(
    @Inject(PilotMatchesService) private readonly service: PilotMatchesService,
  ) {}
  @Post()
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  async match(
    @Body(new TesterValidationPipe(PilotMatchRequestSchema))
    input: PilotMatchRequest,
  ): Promise<ApiSuccessResponse<PilotMatchesData>> {
    return createApiSuccess(await this.service.match(input.interpretation));
  }
}
