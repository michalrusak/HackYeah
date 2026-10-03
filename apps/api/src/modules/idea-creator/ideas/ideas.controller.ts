import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  createApiSuccess,
  CreateIdeaRequestSchema,
  IdeaListQuerySchema,
  UpdateIdeaRequestSchema,
  type ApiErrorResponse,
  type ApiSuccessResponse,
  type CreatedIdeaData,
  type CreateIdeaRequest,
  type IdeaData,
  type IdeaListData,
  type IdeaListQuery,
  type MatchmakingData,
  type PlainLanguageData,
  type UpdateIdeaRequest,
} from '@repo/api-contracts';
import type { Response } from 'express';
import { MatchmakingService } from '../../matchmaking/matchmaking.service.js';
import { ZodValidationPipe } from '../../../shared/pipes/zod-validation.pipe.js';
import { IdeasService } from './ideas.service.js';

const AI_THROTTLE = { default: { limit: 8, ttl: 60_000 } };

@Controller('ideas')
export class IdeasController {
  constructor(
    @Inject(IdeasService) private readonly service: IdeasService,
    @Inject(MatchmakingService)
    private readonly matchmaking: MatchmakingService,
  ) {}

  @Post()
  async create(
    @Body(
      new ZodValidationPipe(
        CreateIdeaRequestSchema,
        'Uzupełnij tytuł, istotę pomysłu, problem i odbiorców.',
      ),
    )
    body: CreateIdeaRequest,
  ): Promise<ApiSuccessResponse<CreatedIdeaData>> {
    return createApiSuccess(await this.service.create(body));
  }

  @Get()
  async list(
    @Query(
      new ZodValidationPipe(
        IdeaListQuerySchema,
        'Nieprawidłowe parametry wyszukiwania.',
      ),
    )
    query: IdeaListQuery,
  ): Promise<ApiSuccessResponse<IdeaListData>> {
    return createApiSuccess(await this.service.list(query));
  }

  @Get(':id')
  async get(
    @Param('id') id: string,
    @Headers('x-edit-token') editToken?: string,
  ): Promise<ApiSuccessResponse<IdeaData>> {
    return createApiSuccess({ idea: await this.service.get(id, editToken) });
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(
      new ZodValidationPipe(
        UpdateIdeaRequestSchema,
        'Nie udało się zapisać zmian — sprawdź długość pól.',
      ),
    )
    body: UpdateIdeaRequest,
    @Headers('x-edit-token') editToken?: string,
  ): Promise<ApiSuccessResponse<IdeaData>> {
    return createApiSuccess({
      idea: await this.service.update(id, editToken, body),
    });
  }

  @Post(':id/publish')
  @HttpCode(200)
  async publish(
    @Param('id') id: string,
    @Headers('x-edit-token') editToken?: string,
  ): Promise<ApiSuccessResponse<IdeaData>> {
    return createApiSuccess({ idea: await this.service.publish(id, editToken) });
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('id') id: string,
    @Headers('x-edit-token') editToken?: string,
  ): Promise<void> {
    await this.service.remove(id, editToken);
  }

  @Post(':id/adopt')
  async adopt(
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<CreatedIdeaData>> {
    return createApiSuccess(await this.service.adopt(id));
  }

  @Post(':id/plain-language')
  @HttpCode(200)
  @Throttle(AI_THROTTLE)
  async plainLanguage(
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<PlainLanguageData>> {
    return createApiSuccess(await this.service.plainLanguage(id));
  }

  /** Przepina opis fiszki do istniejącego rankingu innowacji ROPS. */
  @Post(':id/related')
  @HttpCode(200)
  @Throttle(AI_THROTTLE)
  async related(
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
    @Headers('x-edit-token') editToken?: string,
  ): Promise<ApiSuccessResponse<MatchmakingData> | ApiErrorResponse> {
    const description = await this.service.describeForMatchmaking(id, editToken);
    const outcome = await this.matchmaking.match(description);
    response.status(outcome.status);
    return outcome.body;
  }
}
