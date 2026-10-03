import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestersAiService } from './testers-ai.service.js';
import { TestersController } from './testers.controller.js';
import { TesterAssignmentEntity, TesterProfileEntity, TesterSearchEntity } from './testers.entities.js';
import { TestersRepository } from './testers.repository.js';
import { TestersService } from './testers.service.js';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([TesterProfileEntity, TesterSearchEntity, TesterAssignmentEntity])],
  controllers: [TestersController],
  providers: [TestersRepository, TestersService, TestersAiService],
})
export class TestersModule {}
