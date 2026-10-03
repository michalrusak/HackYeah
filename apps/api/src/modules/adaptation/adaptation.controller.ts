import { Body, Controller, Inject, Post, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  AdaptationRequestSchema,
  type AdaptationRequest,
} from '@repo/api-contracts';
import type { Response } from 'express';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe.js';
import { AdaptationService } from './adaptation.service.js';

@Controller('adaptations')
export class AdaptationController {
  constructor(
    @Inject(AdaptationService) private readonly service: AdaptationService,
  ) {}

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async adapt(
    @Body(
      new ZodValidationPipe(
        AdaptationRequestSchema,
        'Nieprawidłowa innowacja lub zbyt długa rozmowa.',
      ),
    )
    input: AdaptationRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const outcome = await this.service.adapt(input);
    response.status(outcome.status);
    return outcome.body;
  }
}
