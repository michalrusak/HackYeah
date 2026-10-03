import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { TesterProjectsController } from './tester-projects.controller.js';
import { TesterProjectsRepository } from './tester-projects.repository.js';
import { TesterProjectsService } from './tester-projects.service.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [TesterProjectsController],
  providers: [TesterProjectsRepository, TesterProjectsService],
})
export class TesterProjectsModule {}
