import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  createApiSuccess,
  SaveCanvasRequestSchema,
  type ApiSuccessResponse,
  type CanvasData,
  type CanvasSuggestionsData,
  type CanvasTemplateData,
  type SaveCanvasRequest,
} from '@repo/api-contracts';
import { ZodValidationPipe } from '../../../shared/pipes/zod-validation.pipe.js';
import { CanvasService } from './canvas.service.js';

@Controller()
export class CanvasController {
  constructor(@Inject(CanvasService) private readonly service: CanvasService) {}

  @Get('canvas/template')
  getTemplate(): ApiSuccessResponse<CanvasTemplateData> {
    return createApiSuccess({ template: this.service.getTemplate() });
  }

  @Get('ideas/:id/canvas')
  async get(
    @Param('id') id: string,
    @Headers('x-edit-token') editToken?: string,
  ): Promise<ApiSuccessResponse<CanvasData>> {
    return createApiSuccess(await this.service.get(id, editToken));
  }

  @Put('ideas/:id/canvas')
  async save(
    @Param('id') id: string,
    @Body(
      new ZodValidationPipe(
        SaveCanvasRequestSchema,
        'Nie udało się zapisać Canvy — sprawdź długość pól.',
      ),
    )
    body: SaveCanvasRequest,
    @Headers('x-edit-token') editToken?: string,
  ): Promise<ApiSuccessResponse<CanvasData>> {
    return createApiSuccess(
      await this.service.save(id, editToken, body.answers),
    );
  }

  @Post('ideas/:id/canvas/suggest')
  @HttpCode(200)
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  async suggest(
    @Param('id') id: string,
    @Headers('x-edit-token') editToken?: string,
  ): Promise<ApiSuccessResponse<CanvasSuggestionsData>> {
    return createApiSuccess(await this.service.suggest(id, editToken));
  }
}
