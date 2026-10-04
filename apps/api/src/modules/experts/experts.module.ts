import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { ExpertsAdminController } from './experts.controller.js';
import { ExpertsRepository } from './experts.repository.js';
import { ExpertsService } from './experts.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [ExpertsAdminController],
  providers: [ExpertsService, ExpertsRepository],
})
export class ExpertsModule {}
