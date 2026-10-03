// apps/api-nest/src/modules/users/users.module.ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}

// apps/api-nest/src/app.module.ts — register:
// imports: [UsersModule, ThrottlerModule.forRoot(...), ...]
