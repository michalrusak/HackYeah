import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { TestersAiService } from './testers-ai.service.js';
import { TestersController } from './testers.controller.js';
import { TestersRepository } from './testers.repository.js';
import { TestersService } from './testers.service.js';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [TestersController],
  providers: [TestersRepository, TestersService, TestersAiService],
})
export class TestersModule {}
