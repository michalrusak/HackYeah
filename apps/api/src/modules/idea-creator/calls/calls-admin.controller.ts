import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  createApiSuccess,
  CreateGrantCallRequestSchema,
  type AdminGrantCall,
  type AdminGrantCallListData,
  type ApiSuccessResponse,
  type CreateGrantCallRequest,
} from '@repo/api-contracts';
import { ZodValidationPipe } from '../../../shared/pipes/zod-validation.pipe.js';
import { KnowledgeAdminGuard } from '../../knowledge/knowledge-admin.guard.js';
import { CallsService } from './calls.service.js';

@Controller('knowledge/admin/calls')
@UseGuards(KnowledgeAdminGuard)
export class CallsAdminController {
  constructor(@Inject(CallsService) private readonly service: CallsService) {}

  @Get()
  async list(): Promise<ApiSuccessResponse<AdminGrantCallListData>> {
    return createApiSuccess(await this.service.listAdmin());
  }

  @Post()
  async create(
    @Body(
      new ZodValidationPipe(
        CreateGrantCallRequestSchema,
        'Nieprawidłowe dane nowego naboru grantowego.',
      ),
    )
    body: CreateGrantCallRequest,
  ): Promise<ApiSuccessResponse<{ call: AdminGrantCall }>> {
    return createApiSuccess({ call: await this.service.createCall(body) });
  }

  @Patch(':id/publish')
  async togglePublish(
    @Param('id') id: string,
    @Body('isPublished') isPublished: boolean,
  ): Promise<ApiSuccessResponse<{ call: AdminGrantCall }>> {
    return createApiSuccess({
      call: await this.service.togglePublish(id, Boolean(isPublished)),
    });
  }
}
