import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  AssistantChatRequestSchema,
  AssistantSeedRequestSchema,
  createApiSuccess,
  VisualRequestSchema,
  type ApiSuccessResponse,
  type AssistantChatData,
  type AssistantChatRequest,
  type AssistantExpandData,
  type AssistantMessage,
  type AssistantSeedRequest,
  type AssistantWildcardsData,
  type VisualData,
  type VisualRequest,
} from '@repo/api-contracts';
import type { Response } from 'express';
import { ZodValidationPipe } from '../../../shared/pipes/zod-validation.pipe.js';
import { AssistantService } from './assistant.service.js';
import { VisualService } from './visual.service.js';

const AI_THROTTLE = { default: { limit: 12, ttl: 60_000 } };

@Controller()
export class AssistantController {
  constructor(
    @Inject(AssistantService) private readonly service: AssistantService,
    @Inject(VisualService) private readonly visuals: VisualService,
  ) {}

  @Post('assistant/chat')
  @HttpCode(200)
  @Throttle(AI_THROTTLE)
  async chat(
    @Body(
      new ZodValidationPipe(
        AssistantChatRequestSchema,
        'Wpisz pytanie o długości od 1 do 2000 znaków.',
      ),
    )
    body: AssistantChatRequest,
    @Headers('x-edit-token') editToken?: string,
  ): Promise<ApiSuccessResponse<AssistantChatData>> {
    return createApiSuccess(await this.service.chat(body, editToken));
  }

  @Get('assistant/history/:ideaId')
  async history(
    @Param('ideaId') ideaId: string,
    @Headers('x-edit-token') editToken?: string,
  ): Promise<ApiSuccessResponse<{ messages: AssistantMessage[] }>> {
    return createApiSuccess({
      messages: await this.service.history(ideaId, editToken),
    });
  }

  @Post('assistant/expand')
  @HttpCode(200)
  @Throttle(AI_THROTTLE)
  async expand(
    @Body(
      new ZodValidationPipe(
        AssistantSeedRequestSchema,
        'Opisz pomysł w co najmniej 10 znakach.',
      ),
    )
    body: AssistantSeedRequest,
  ): Promise<ApiSuccessResponse<AssistantExpandData>> {
    return createApiSuccess(await this.service.expand(body.idea));
  }

  @Post('assistant/wildcards')
  @HttpCode(200)
  @Throttle(AI_THROTTLE)
  async wildcards(
    @Body(
      new ZodValidationPipe(
        AssistantSeedRequestSchema,
        'Opisz pomysł w co najmniej 10 znakach.',
      ),
    )
    body: AssistantSeedRequest,
  ): Promise<ApiSuccessResponse<AssistantWildcardsData>> {
    return createApiSuccess(await this.service.wildcards(body.idea));
  }

  @Post('ideas/:id/visual')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async createVisual(
    @Param('id') id: string,
    @Body(
      new ZodValidationPipe(
        VisualRequestSchema,
        'Wskazówka może mieć najwyżej 500 znaków.',
      ),
    )
    body: VisualRequest,
    @Headers('x-edit-token') editToken?: string,
  ): Promise<ApiSuccessResponse<VisualData>> {
    return createApiSuccess(
      await this.visuals.generate(id, editToken, body.hint),
    );
  }

  @Get('ideas/:id/visual/:visualId')
  async readVisual(
    @Param('id') id: string,
    @Param('visualId') visualId: string,
    @Res() response: Response,
  ): Promise<void> {
    const visual = await this.visuals.read(id, visualId);
    response.setHeader('Content-Type', visual.mimeType);
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    response.send(visual.data);
  }
}
