# 03b — Next.js API Routes (optional)

> **ARCHIWUM — nie używać w HackYeah.** Backend: NestJS (`03-api.md`).


> Attach **only** if this app uses Next.js API routes instead of Nest. For NestJS: `03-api.md` only.

## When to use

| Setup | Attach |
|-------|--------|
| NestJS (`apps/api-nest`) | `03-api.md` |
| Next.js route handlers (`apps/web-next/app/api/`) | `03-api.md` concepts + this file |
| Both | Both files — same contracts, no duplicate logic |

## Structure

```
apps/web-next/
  app/api/v1/users/route.ts
  lib/
    api/
      responses.ts         # jsonSuccess, jsonError
      validation.ts        # parseBody, parseQuery
    modules/users/
      users.service.ts
      users.repository.ts
    db/prisma.ts           # PrismaClient singleton
```

Same layering as Nest: **route.ts → Service → Repository → Prisma**.

## Route handler example

```typescript
// app/api/v1/users/route.ts
export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, CreateUserSchema);
  if (!parsed.ok) return parsed.response;

  const result = await usersService.create(parsed.data);
  if (!result.success) {
    return jsonError(result.error.code, result.error.message, statusForCode(result.error.code));
  }
  return jsonSuccess(result.data, { status: 201 });
}
```

## Rules

- Same Zod schemas from `@repo/api-contracts`
- Same `ApiResponse<T>` envelope and error codes
- Prisma only in repository — never in route.ts
- No different response shape than Nest endpoints

Example: `examples/next-route-handler.example.ts` (if present) or `playbooks/03-api.md` contract section.
