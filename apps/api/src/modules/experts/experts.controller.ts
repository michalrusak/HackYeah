import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  createApiSuccess,
  ExpertGrantRequestSchema,
  type ApiSuccessResponse,
  type ExpertGrantRequest,
  type ExpertListData,
} from '@repo/api-contracts';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe.js';
import { KnowledgeAdminGuard } from '../knowledge/knowledge-admin.guard.js';
import { ExpertsService } from './experts.service.js';

/**
 * Nadawanie roli eksperta przez ROPS. Adres leży pod `/knowledge/admin`, bo
 * ciasteczko sesji administratora jest ograniczone do tej ścieżki.
 */
@Controller('knowledge/admin/experts')
@UseGuards(KnowledgeAdminGuard)
export class ExpertsAdminController {
  constructor(
    @Inject(ExpertsService) private readonly service: ExpertsService,
  ) {}

  @Get()
  async list(): Promise<ApiSuccessResponse<ExpertListData>> {
    return createApiSuccess(await this.service.list());
  }

  @Post()
  @HttpCode(200)
  async grant(
    @Body(
      new ZodValidationPipe(
        ExpertGrantRequestSchema,
        'Podaj login konta, imię i nazwisko eksperta oraz co najmniej jedną dziedzinę.',
      ),
    )
    body: ExpertGrantRequest,
  ): Promise<ApiSuccessResponse<ExpertListData>> {
    return createApiSuccess(await this.service.grant(body));
  }

  @Post(':id/revoke')
  @HttpCode(200)
  async revoke(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<ExpertListData>> {
    return createApiSuccess(await this.service.revoke(id));
  }
}
