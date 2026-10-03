import { Controller, Get, Inject, Param } from '@nestjs/common';
import {
  createApiSuccess,
  type ApiSuccessResponse,
  type GrantCallData,
  type GrantCallListData,
} from '@repo/api-contracts';
import { CallsService } from './calls.service.js';

@Controller('calls')
export class CallsController {
  constructor(@Inject(CallsService) private readonly service: CallsService) {}

  @Get()
  async list(): Promise<ApiSuccessResponse<GrantCallListData>> {
    return createApiSuccess(await this.service.list());
  }

  @Get(':id')
  async get(
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<GrantCallData>> {
    return createApiSuccess({ call: await this.service.get(id) });
  }
}
