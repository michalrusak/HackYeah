// apps/api-nest/src/modules/users/users.service.ts
import { Injectable } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import {
  ErrorCode,
  type CreateUserInput,
  type UserResponse,
  type ApiResponse,
} from '@repo/api-contracts';
import { apiSuccess, apiError } from '../../common/utils/api-response';

function toUserResponse(user: { id: string; email: string; name: string; createdAt: Date }): UserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt.toISOString(),
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly usersRepo: UsersRepository) {}

  async findById(id: string): Promise<ApiResponse<UserResponse>> {
    const user = await this.usersRepo.findById(id);
    if (!user) return apiError(ErrorCode.USER_NOT_FOUND, 'User not found', 404);
    return apiSuccess(toUserResponse(user));
  }

  async create(input: CreateUserInput): Promise<ApiResponse<UserResponse>> {
    const existing = await this.usersRepo.findByEmail(input.email);
    if (existing) return apiError(ErrorCode.EMAIL_TAKEN, 'Email already registered', 409);

    const user = await this.usersRepo.create(input);
    return apiSuccess(toUserResponse(user));
  }
}
