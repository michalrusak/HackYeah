import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { AuthController } from './auth.controller.js';
import { TesterAuthGuard } from './auth.guard.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthRepository, AuthService, TesterAuthGuard],
  exports: [AuthService, TesterAuthGuard],
})
export class AuthModule {}
