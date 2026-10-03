import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  createApiSuccess,
  CreateApplicationRequestSchema,
  UpdateApplicationRequestSchema,
  type ApiSuccessResponse,
  type ApplicationData,
  type ApplicationExportData,
  type CreateApplicationRequest,
  type CreatedApplicationData,
  type UpdateApplicationRequest,
} from '@repo/api-contracts';
import { ZodValidationPipe } from '../../../shared/pipes/zod-validation.pipe.js';
import { ApplicationsService } from './applications.service.js';

@Controller()
export class ApplicationsController {
  constructor(
    @Inject(ApplicationsService)
    private readonly service: ApplicationsService,
  ) {}

  @Post('calls/:callId/applications')
  async create(
    @Param('callId') callId: string,
    @Body(
      new ZodValidationPipe(
        CreateApplicationRequestSchema,
        'Wskaż pomysł, dla którego tworzysz wniosek.',
      ),
    )
    body: CreateApplicationRequest,
    @Headers('x-edit-token') ideaToken?: string,
  ): Promise<ApiSuccessResponse<CreatedApplicationData>> {
    return createApiSuccess(
      await this.service.create(callId, body.ideaId, ideaToken),
    );
  }

  @Get('applications/:id')
  async get(
    @Param('id') id: string,
    @Headers('x-edit-token') editToken?: string,
  ): Promise<ApiSuccessResponse<ApplicationData>> {
    return createApiSuccess(await this.service.get(id, editToken));
  }

  @Patch('applications/:id')
  async update(
    @Param('id') id: string,
    @Body(
      new ZodValidationPipe(
        UpdateApplicationRequestSchema,
        'Nie udało się zapisać wniosku — sprawdź długość odpowiedzi.',
      ),
    )
    body: UpdateApplicationRequest,
    @Headers('x-edit-token') editToken?: string,
  ): Promise<ApiSuccessResponse<ApplicationData>> {
    return createApiSuccess(
      await this.service.update(id, editToken, body.answers),
    );
  }

  @Post('applications/:id/generate')
  @HttpCode(200)
  @Throttle({ default: { limit: 4, ttl: 60_000 } })
  async generate(
    @Param('id') id: string,
    @Headers('x-edit-token') editToken?: string,
  ): Promise<ApiSuccessResponse<ApplicationData>> {
    return createApiSuccess(await this.service.generate(id, editToken));
  }

  @Post('applications/:id/submit')
  @HttpCode(200)
  async submit(
    @Param('id') id: string,
    @Headers('x-edit-token') editToken?: string,
  ): Promise<ApiSuccessResponse<ApplicationData>> {
    return createApiSuccess(await this.service.submit(id, editToken));
  }

  @Get('applications/:id/export')
  async exportMarkdown(
    @Param('id') id: string,
    @Headers('x-edit-token') editToken?: string,
  ): Promise<ApiSuccessResponse<ApplicationExportData>> {
    return createApiSuccess(await this.service.exportMarkdown(id, editToken));
  }
}
