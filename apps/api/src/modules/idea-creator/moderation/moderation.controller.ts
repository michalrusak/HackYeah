import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  createApiSuccess,
  IdeaDecisionRequestSchema,
  IdeaMessageRequestSchema,
  type ApiSuccessResponse,
  type IdeaDecisionRequest,
  type IdeaMessageRequest,
  type IdeaThreadData,
  type ModerationDetailData,
  type ModerationListData,
} from '@repo/api-contracts';
import { ZodValidationPipe } from '../../../shared/pipes/zod-validation.pipe.js';
import { KnowledgeAdminGuard } from '../../knowledge/knowledge-admin.guard.js';
import { ModerationService } from './moderation.service.js';

const MESSAGE_ERROR = 'Wpisz wiadomość (do 2000 znaków).';

/** Wątek autora z ROPS — dostęp daje kod edycji fiszki. */
@Controller('ideas')
export class IdeaThreadController {
  constructor(
    @Inject(ModerationService) private readonly service: ModerationService,
  ) {}

  @Get(':id/thread')
  async thread(
    @Param('id') id: string,
    @Headers('x-edit-token') editToken?: string,
  ): Promise<ApiSuccessResponse<IdeaThreadData>> {
    return createApiSuccess(await this.service.thread(id, editToken));
  }

  @Post(':id/thread')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async message(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(IdeaMessageRequestSchema, MESSAGE_ERROR))
    body: IdeaMessageRequest,
    @Headers('x-edit-token') editToken?: string,
  ): Promise<ApiSuccessResponse<IdeaThreadData>> {
    return createApiSuccess(
      await this.service.authorMessage(id, editToken, body.content),
    );
  }
}

/**
 * Kolejka ROPS. Adres leży pod `/knowledge/admin`, bo ciasteczko sesji
 * administratora jest ograniczone do tej ścieżki.
 */
@Controller('knowledge/admin/ideas')
@UseGuards(KnowledgeAdminGuard)
export class IdeaModerationController {
  constructor(
    @Inject(ModerationService) private readonly service: ModerationService,
  ) {}

  @Get()
  async queue(): Promise<ApiSuccessResponse<ModerationListData>> {
    return createApiSuccess(await this.service.queue());
  }

  @Get(':id')
  async detail(
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<ModerationDetailData>> {
    return createApiSuccess(await this.service.detail(id));
  }

  @Post(':id/decision')
  @HttpCode(200)
  async decide(
    @Param('id') id: string,
    @Body(
      new ZodValidationPipe(
        IdeaDecisionRequestSchema,
        'Prośba o uzupełnienie i odrzucenie wymagają wiadomości dla autora.',
      ),
    )
    body: IdeaDecisionRequest,
  ): Promise<ApiSuccessResponse<ModerationDetailData>> {
    return createApiSuccess(await this.service.decide(id, body));
  }

  @Post(':id/messages')
  @HttpCode(200)
  async reply(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(IdeaMessageRequestSchema, MESSAGE_ERROR))
    body: IdeaMessageRequest,
  ): Promise<ApiSuccessResponse<ModerationDetailData>> {
    return createApiSuccess(await this.service.reply(id, body.content));
  }
}
