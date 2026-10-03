# 04 — Web React / Next.js

> **ARCHIWUM — nie używać w HackYeah.** Projekt: tylko Angular (`05-web-angular.md`).


> Attach when working on: `apps/web-next/**`, `apps/web-react/**`, `packages/ui/**`, `packages/api-client/**`.

## Stack

| Tool | Purpose |
|------|---------|
| Next.js App Router / Vite + React | Framework |
| shadcn/ui + Tailwind | UI components |
| TanStack Query | Server/async state (cache) |
| react-hook-form + `@hookform/resolvers/zod` | Forms |
| Zod (from `@repo/api-contracts`) | Validation — same schemas as API |
| `@repo/api-client` | Typed HTTP — no raw `fetch()` in components |
| next-intl / react-i18next | i18n |
| lucide-react | Icons |

## Folder structure

### Next.js

```
apps/web-next/
├── app/
│   ├── [locale]/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── users/
│   │       ├── page.tsx
│   │       └── [id]/page.tsx
│   └── api/v1/              # only if this app serves API routes
├── components/
│   ├── ui/                  # shadcn (or import from @repo/ui)
│   └── features/
│       └── users/
│           ├── user-form.tsx
│           ├── user-list.tsx
│           └── user-card.tsx
├── lib/
│   ├── hooks/
│   │   └── users/
│   │       ├── use-user.ts
│   │       └── use-create-user.ts
│   └── providers/
│       └── query-provider.tsx
├── locales/
│   └── pl.json              # ALL user-facing strings — ONLY this file for now
└── middleware.ts             # locale routing (next-intl)
```

### Vite React SPA

```
apps/web-react/
├── src/
│   ├── pages/
│   ├── components/
│   │   ├── ui/
│   │   └── features/
│   ├── lib/hooks/
│   ├── lib/providers/
│   └── locales/pl.json
└── index.html
```

## API Client — `@repo/api-client`

**Hard rule:** Components and pages never call `fetch()` directly. All HTTP goes through `@repo/api-client`.

### Base client

```typescript
// packages/api-client/src/client.ts
import { z, type ZodType } from 'zod';
import { ApiResponseSchema, type ApiErrorBody } from '@repo/api-contracts';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export class ApiClientError extends Error {
  constructor(public readonly error: ApiErrorBody) {
    super(error.code);
    this.name = 'ApiClientError';
  }
}

export async function apiClient<T>(
  path: string,
  dataSchema: ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...init?.headers },
    ...init,
  });

  const json = await res.json();

  if (!json.success) {
    throw new ApiClientError(json.error);
  }

  return dataSchema.parse(json.data);
}

export async function apiClientPaginated<T>(
  path: string,
  itemSchema: ZodType<T>,
  init?: RequestInit,
): Promise<{ data: T[]; meta: PaginationMeta }> {
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers: { Accept: 'application/json', ...init?.headers } });
  const json = await res.json();
  if (!json.success) throw new ApiClientError(json.error);
  return { data: z.array(itemSchema).parse(json.data), meta: json.meta };
}
```

### Resource functions

```typescript
// packages/api-client/src/users.ts
import { apiClient, apiClientPaginated } from './client';
import { CreateUserSchema, UserResponseSchema, type CreateUserInput, type UserResponse } from '@repo/api-contracts';

export function getUser(id: string) {
  return apiClient(`/users/${id}`, UserResponseSchema);
}

export function getUsers(page = 1, pageSize = 20) {
  return apiClientPaginated(`/users?page=${page}&pageSize=${pageSize}`, UserResponseSchema);
}

export function createUser(input: CreateUserInput) {
  return apiClient('/users', UserResponseSchema, {
    method: 'POST',
    body: JSON.stringify(CreateUserSchema.parse(input)),
  });
}
```

### Error → i18n mapping

```typescript
// packages/api-client/src/error-i18n.ts
const ERROR_I18N_KEYS: Record<string, string> = {
  EMAIL_TAKEN: 'errors.emailTaken',
  USER_NOT_FOUND: 'errors.userNotFound',
  VALIDATION_ERROR: 'errors.validation',
  RATE_LIMITED: 'errors.rateLimited',
  UNAUTHORIZED: 'errors.unauthorized',
};

export function getErrorI18nKey(code: string): string {
  return ERROR_I18N_KEYS[code] ?? 'errors.generic';
}
```

**Never show `error.message` from API to user** — map `error.code` → i18n key.

## TanStack Query — cache patterns

### Provider setup

```typescript
// lib/providers/query-provider.tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

### Query keys — convention

```typescript
// lib/hooks/query-keys.ts
export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (page: number, pageSize: number) => [...userKeys.lists(), { page, pageSize }] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
};
```

Always use key factories — never inline `['users', id]` strings.

### useQuery — fetch single resource

```typescript
// lib/hooks/users/use-user.ts
import { useQuery } from '@tanstack/react-query';
import { getUser } from '@repo/api-client/users';
import { userKeys } from '../query-keys';

export function useUser(id: string) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => getUser(id),
    enabled: !!id,
  });
}
```

### useQuery — paginated list

```typescript
export function useUsers(page: number, pageSize = 20) {
  return useQuery({
    queryKey: userKeys.list(page, pageSize),
    queryFn: () => getUsers(page, pageSize),
    placeholderData: (prev) => prev,  // keep old data while fetching next page
  });
}
```

### useMutation — create/update/delete

```typescript
// lib/hooks/users/use-create-user.ts
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
```

| Action | Cache strategy |
|--------|---------------|
| Create | `invalidateQueries` on list keys |
| Update | `invalidateQueries` on detail + list keys |
| Delete | `removeQueries` on detail + `invalidateQueries` on list |
| Optimistic update | Only when UX demands instant feedback — use `onMutate` + rollback |

### Using in components

```typescript
function UserPage({ id }: { id: string }) {
  const { data: user, isLoading, error } = useUser(id);
  const t = useTranslations();

  if (isLoading) return <Skeleton className="h-8 w-48" />;
  if (error) return <Alert>{t(getErrorI18nKey((error as ApiClientError).error.code))}</Alert>;

  return <UserCard user={user} />;
}
```

## React Hook Form + Zod

### Standard form pattern

```typescript
// components/features/users/user-form.tsx
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateUserSchema, type CreateUserInput } from '@repo/api-contracts';
import { useCreateUser } from '@/lib/hooks/users/use-create-user';
import { useTranslations } from 'next-intl';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { getErrorI18nKey, ApiClientError } from '@repo/api-client';

export function UserForm() {
  const t = useTranslations('users.form');
  const createUser = useCreateUser();

  const form = useForm<CreateUserInput>({
    resolver: zodResolver(CreateUserSchema),
    defaultValues: { email: '', name: '' },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await createUser.mutateAsync(data);
      toast.success(t('success'));
      form.reset();
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.error.details) {
          Object.entries(err.error.details).forEach(([field, messages]) => {
            form.setError(field as keyof CreateUserInput, { message: messages[0] });
          });
        } else {
          toast.error(t(getErrorI18nKey(err.error.code)));
        }
      }
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem>
            <FormLabel>{t('emailLabel')}</FormLabel>
            <FormControl><Input type="email" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>{t('nameLabel')}</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit" disabled={createUser.isPending}>
          {createUser.isPending ? t('submitting') : t('submit')}
        </Button>
      </form>
    </Form>
  );
}
```

### Form rules

| Rule | Detail |
|------|--------|
| Schema source | Always `@repo/api-contracts` — same as API |
| Resolver | Always `zodResolver(Schema)` |
| Labels/errors | Always `t('key')` from i18n — never hardcoded strings |
| Submit | `mutateAsync` from TanStack Query mutation |
| API errors | Map `error.code` → i18n; map `error.details` → `form.setError` |
| Loading | Disable submit button with `isPending` |

## i18n — Polish only (for now)

**All user-facing text lives in `locales/pl.json`.** No hardcoded Polish/English in components.

### File structure

```json
{
  "common": {
    "loading": "Ładowanie...",
    "save": "Zapisz",
    "cancel": "Anuluj",
    "back": "Wróć"
  },
  "errors": {
    "generic": "Coś poszło nie tak. Spróbuj ponownie.",
    "emailTaken": "Ten adres e-mail jest już zajęty.",
    "userNotFound": "Nie znaleziono użytkownika.",
    "validation": "Formularz zawiera błędy.",
    "rateLimited": "Zbyt wiele prób. Spróbuj za chwilę.",
    "unauthorized": "Musisz się zalogować."
  },
  "users": {
    "title": "Użytkownicy",
    "form": {
      "emailLabel": "Adres e-mail",
      "nameLabel": "Imię i nazwisko",
      "submit": "Utwórz użytkownika",
      "submitting": "Tworzenie...",
      "success": "Użytkownik utworzony."
    },
    "list": {
      "empty": "Brak użytkowników.",
      "columns": {
        "email": "E-mail",
        "name": "Nazwa"
      }
    }
  }
}
```

### Key naming convention

```
<feature>.<context>.<element>

users.form.emailLabel
users.list.empty
errors.emailTaken
common.save
```

### next-intl setup (Next.js)

```typescript
// middleware.ts
import createMiddleware from 'next-intl/middleware';
export default createMiddleware({ locales: ['pl'], defaultLocale: 'pl' });

// app/[locale]/layout.tsx
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

export default async function LocaleLayout({ children, params: { locale } }) {
  const messages = await getMessages();
  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
```

### Usage in components

```typescript
const t = useTranslations('users.form');
<FormLabel>{t('emailLabel')}</FormLabel>   // ✅
<FormLabel>Adres e-mail</FormLabel>         // ❌ hardcoded
```

### Rules

- Backend `error.message` is for logs/dev — **never** display to user
- Map `error.code` → `errors.*` i18n key
- Zod validation messages: use `z.string().min(1, { message: 'validation.required' })` or handle via i18n map
- Prepare keys for future EN — structure ready, only `pl.json` exists now

## shadcn/ui

- Install into `@repo/ui` (shared) or `components/ui/` (app-specific)
- Extend via composition, not by editing generated primitives
- Use `cn()` from `@repo/ui/lib/utils` for conditional classes
- Toast: `sonner` via shadcn toast component
- Loading states: `<Skeleton />` from shadcn — not custom spinners

## Next.js specifics

- `"use client"` only when needed (hooks, events, browser APIs)
- Server Components for data that doesn't need interactivity
- Do not fetch in Server Components if TanStack Query is used on client for same data — pick one per resource
- Env: `NEXT_PUBLIC_API_URL` for api-client base URL

## Adding a new feature — checklist

```
- [ ] i18n keys in locales/pl.json (all labels, messages, errors)
- [ ] Zod schema in @repo/api-contracts (if new API interaction)
- [ ] api-client function in @repo/api-client
- [ ] query key in query-keys.ts
- [ ] useQuery / useMutation hook in lib/hooks/
- [ ] Feature component in components/features/
- [ ] Page in app/[locale]/
- [ ] Component test for critical forms
```

## Forbidden

- `fetch()` in components/pages — use `@repo/api-client`
- Hardcoded user-facing strings — use `t('key')`
- Displaying `error.message` from API to user
- Inline Zod schemas — import from `@repo/api-contracts`
- CSS modules / styled-components (Tailwind + shadcn only)
- Installing MUI/Chakra alongside shadcn
- `any` on form data or API responses
