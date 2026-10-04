import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  createApiSuccess,
  GrantAlertSubscriptionRequestSchema,
  type ApiSuccessResponse,
  type GrantAlertSubscriptionRequest,
  type GrantCallData,
  type GrantCallListData,
} from '@repo/api-contracts';
import { ZodValidationPipe } from '../../../shared/pipes/zod-validation.pipe.js';
import { CallsService } from './calls.service.js';

@Controller('calls')
export class CallsController {
  constructor(@Inject(CallsService) private readonly service: CallsService) {}

  @Get()
  async list(): Promise<ApiSuccessResponse<GrantCallListData>> {
    return createApiSuccess(await this.service.list());
  }

  @Post('subscribe')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async subscribe(
    @Body(
      new ZodValidationPipe(
        GrantAlertSubscriptionRequestSchema,
        'Podaj poprawny adres e-mail do subskrypcji alertu grantowego.',
      ),
    )
    body: GrantAlertSubscriptionRequest,
  ): Promise<ApiSuccessResponse<{ success: boolean; email: string }>> {
    return createApiSuccess(await this.service.subscribeToAlerts(body));
  }

  @Get(':id')
  async get(
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<GrantCallData>> {
    return createApiSuccess({ call: await this.service.get(id) });
  }
}
