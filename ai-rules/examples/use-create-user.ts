// apps/web-next/lib/hooks/users/use-create-user.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createUser } from '@repo/api-client/users';
import { userKeys } from '../query-keys';

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}

// apps/web-next/lib/hooks/query-keys.ts
export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (page: number, pageSize: number) =>
    [...userKeys.lists(), { page, pageSize }] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
};
