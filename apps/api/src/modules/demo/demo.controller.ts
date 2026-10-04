import { Controller, Get, Header, Inject } from '@nestjs/common';
import {
  createApiSuccess,
  type ApiSuccessResponse,
  type DemoData,
} from '@repo/api-contracts';
import { DemoService } from './demo.service.js';

@Controller('demo')
export class DemoController {
  constructor(@Inject(DemoService) private readonly service: DemoService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  get(): ApiSuccessResponse<DemoData> {
    return createApiSuccess(this.service.data());
  }
}
