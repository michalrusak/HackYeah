import {
  Body,
  Controller,
  createParamDecorator,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  SetMetadata,
  UnauthorizedException,
  UseGuards,
  type ExecutionContext,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  createApiSuccess,
  CreateConversationSchema,
  SendMessageSchema,
  type ApiSuccessResponse,
  type ContactListData,
  type ContactQueueData,
  type ContactThreadData,
  type CreateConversation,
  type SendMessage,
} from '@repo/api-contracts';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe.js';
import type { TesterRequest } from '../auth/auth-http.js';
import { REQUIRE_ACCOUNT, TesterAuthGuard } from '../auth/auth.guard.js';
import { KnowledgeAdminGuard } from '../knowledge/knowledge-admin.guard.js';
import { ContactService } from './contact.service.js';

const CONVERSATION_ERROR =
  'Podaj imię, nazwisko, rodzaj sprawy, temat i treść wiadomości.';
const MESSAGE_ERROR = 'Wpisz wiadomość (do 4000 znaków).';

const AccountId = createParamDecorator(
  (_: unknown, context: ExecutionContext): string => {
    const { testerAccountId } = context
      .switchToHttp()
      .getRequest<TesterRequest>();
    if (!testerAccountId) throw new UnauthorizedException();
    return testerAccountId;
  },
);

/** Rozmowy użytkownika z ROPS — dostęp daje sesja konta. */
@Controller('contact/conversations')
@UseGuards(TesterAuthGuard)
@SetMetadata(REQUIRE_ACCOUNT, true)
export class ContactController {
  constructor(
    @Inject(ContactService) private readonly service: ContactService,
  ) {}

  @Get()
  async list(
    @AccountId() accountId: string,
  ): Promise<ApiSuccessResponse<ContactListData>> {
    return createApiSuccess(await this.service.list(accountId));
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async create(
    @AccountId() accountId: string,
    @Body(new ZodValidationPipe(CreateConversationSchema, CONVERSATION_ERROR))
    body: CreateConversation,
  ): Promise<ApiSuccessResponse<ContactThreadData>> {
    return createApiSuccess(await this.service.create(accountId, body));
  }

  @Get(':id')
  async thread(
    @AccountId() accountId: string,
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<ContactThreadData>> {
    return createApiSuccess(await this.service.thread(accountId, id));
  }

  @Post(':id/messages')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async message(
    @AccountId() accountId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SendMessageSchema, MESSAGE_ERROR))
    body: SendMessage,
  ): Promise<ApiSuccessResponse<ContactThreadData>> {
    return createApiSuccess(
      await this.service.userMessage(accountId, id, body.content),
    );
  }
}

/**
 * Skrzynka ROPS. Adres leży pod `/knowledge/admin`, bo ciasteczko sesji
 * administratora jest ograniczone do tej ścieżki.
 */
@Controller('knowledge/admin/contact')
@UseGuards(KnowledgeAdminGuard)
export class ContactAdminController {
  constructor(
    @Inject(ContactService) private readonly service: ContactService,
  ) {}

  @Get()
  async queue(): Promise<ApiSuccessResponse<ContactQueueData>> {
    return createApiSuccess(await this.service.queue());
  }

  @Get(':id')
  async detail(
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<ContactThreadData>> {
    return createApiSuccess(await this.service.detail(id));
  }

  @Post(':id/messages')
  @HttpCode(200)
  async reply(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SendMessageSchema, MESSAGE_ERROR))
    body: SendMessage,
  ): Promise<ApiSuccessResponse<ContactThreadData>> {
    return createApiSuccess(await this.service.reply(id, body.content));
  }

  @Post(':id/close')
  @HttpCode(200)
  async close(
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<ContactThreadData>> {
    return createApiSuccess(await this.service.close(id));
  }
}
