import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  createApiSuccess,
  KnowledgeQuerySchema,
  NeedSignalSchema,
  type KnowledgeQuery,
  type NeedSignal,
} from '@repo/api-contracts';
import { KnowledgeService } from './knowledge.service.js';
import { KnowledgeValidationPipe } from './knowledge-validation.pipe.js';

@Controller('knowledge')
export class KnowledgeController {
  constructor(
    @Inject(KnowledgeService) private readonly service: KnowledgeService,
  ) {}

  @Get('overview')
  async overview() {
    return createApiSuccess(await this.service.overview());
  }

  @Get('resources')
  async list(
    @Query(new KnowledgeValidationPipe(KnowledgeQuerySchema))
    query: KnowledgeQuery,
  ) {
    return createApiSuccess(await this.service.list(query));
  }

  @Get('resources/:id')
  async find(@Param('id') id: string) {
    return createApiSuccess(await this.service.find(id));
  }

  @Post('needs')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async need(
    @Body(new KnowledgeValidationPipe(NeedSignalSchema)) input: NeedSignal,
  ) {
    await this.service.recordNeed(input);
    return createApiSuccess({ accepted: true });
  }
}
