import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { AuthController } from './auth.controller.js';
import { TesterAuthGuard } from './auth.guard.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { ExpertGuard } from './expert.guard.js';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthRepository, AuthService, TesterAuthGuard, ExpertGuard],
  exports: [AuthService, TesterAuthGuard, ExpertGuard],
})
export class AuthModule {}
