import { Controller, Get } from '@nestjs/common';
import { createApiSuccess } from '@repo/api-contracts';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello() {
    return createApiSuccess({ message: this.appService.getHello() });
  }
}
