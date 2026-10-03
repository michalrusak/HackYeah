// packages/api-client/src/client.ts — see playbooks/04-web-react.md for full version
// packages/api-client/src/users.ts

import { apiClient, apiClientPaginated } from './client';
import {
  CreateUserSchema,
  UserResponseSchema,
  type CreateUserInput,
} from '@repo/api-contracts';

export function getUser(id: string) {
  return apiClient(`/users/${id}`, UserResponseSchema);
}

export function getUsers(page = 1, pageSize = 20) {
  return apiClientPaginated(
    `/users?page=${page}&pageSize=${pageSize}`,
    UserResponseSchema,
  );
}

export function createUser(input: CreateUserInput) {
  return apiClient('/users', UserResponseSchema, {
    method: 'POST',
    body: JSON.stringify(CreateUserSchema.parse(input)),
  });
}
