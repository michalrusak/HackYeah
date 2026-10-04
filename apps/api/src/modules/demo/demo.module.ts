import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { DemoController } from './demo.controller.js';
import { DemoRepository } from './demo.repository.js';
import { DemoService } from './demo.service.js';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [DemoController],
  providers: [DemoService, DemoRepository],
})
export class DemoModule {}
