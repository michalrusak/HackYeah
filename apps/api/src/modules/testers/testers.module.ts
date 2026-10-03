import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { TestersAiService } from './testers-ai.service.js';
import { TestersController } from './testers.controller.js';
import { TestersRepository } from './testers.repository.js';
import { TestersService } from './testers.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule],
  controllers: [TestersController],
  providers: [TestersRepository, TestersService, TestersAiService],
})
export class TestersModule {}
