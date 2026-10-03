# 03 — API (NestJS)

> Attach for backend: `apps/api/**`, `packages/api-contracts/**` (gdy istnieje).
> **ORM w projekcie: Prisma 7.** Wzorce Repository/Service bez zmian.

## Architecture overview

```
HTTP Request
  → Guard (auth / api-key / throttle)
  → Pipe (Zod validation)
  → Controller / route.ts
  → Service (business logic)
  → Repository (Prisma / DB queries)
  → map to ApiResponse<T>
  → HTTP Response
```

**Hard rule:** Zapytania DB tylko w Repository (Prisma). Services nie importują `PrismaService` bezpośrednio — tylko przez repo class.

## NestJS folder structure

```
apps/api/src/
├── main.ts
├── app.module.ts
├── common/
│   ├── guards/
│   │   ├── api-key.guard.ts
│   │   └── jwt-auth.guard.ts
│   ├── filters/
│   │   └── global-exception.filter.ts
│   ├── pipes/
│   │   └── zod-validation.pipe.ts
│   ├── decorators/
│   │   ├── public.decorator.ts
│   │   └── current-user.decorator.ts
│   ├── interceptors/
│   │   └── logging.interceptor.ts
│   └── utils/
│       ├── api-response.ts          # apiSuccess(), apiError()
│       └── prisma-error-mapper.ts
├── modules/
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── users.repository.ts
│   │   └── users.repository.interface.ts
│   ├── orders/
│   │   └── ...
│   └── health/
│       ├── health.module.ts
│       └── health.controller.ts
└── prisma/
    ├── schema.prisma
    ├── migrations/
    └── seed.ts
```

**All feature modules live in `src/modules/`** — never directly in `src/`.

## Layer responsibilities

### Controller — HTTP only

```typescript
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Post()
  @HttpCode(201)
  create(@Body(new ZodValidationPipe(CreateUserSchema)) body: CreateUserInput) {
    return this.usersService.create(body);
  }
}
```

- Parse route params, query, body (via Zod pipe)
- Call one service method
- Return `ApiResponse<T>` — no try/catch (global filter handles)

### Service — business logic

```typescript
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
    return apiSuccess(toUserResponse(user), { status: 201 });
  }
}
```

- Business rules, validation beyond schema (uniqueness, permissions)
- Map Prisma entities → response DTOs via mapper functions (`toUserResponse`)
- Return `ApiResponse<T>` — never throw for expected errors (404, 409)
- Throw only for unexpected errors (global filter → 500)

### Repository — database only

```typescript
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  create(data: CreateUserInput) {
    return this.prisma.user.create({ data });
  }

  findManyPaginated(page: number, pageSize: number) {
    return this.prisma.$transaction([
      this.prisma.user.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);
  }
}
```

- Only Prisma queries — no `if (email taken)` logic here
- Return Prisma entities (raw) — mapping happens in service
- Complex queries live here, not in service

### Module wiring

```typescript
@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService],  // if other modules need it
})
export class UsersModule {}
```

## API response contract

Every endpoint returns the same envelope. Types in `@repo/api-contracts`.

### Success

```typescript
interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: { page: number; pageSize: number; total: number };
}
```

### Error

```typescript
interface ApiErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, string[]>;
  };
}

type ApiResponse<T> = ApiSuccess<T> | ApiErrorResponse;
```

### Helpers (`common/utils/api-response.ts`)

```typescript
export function apiSuccess<T>(data: T, opts?: { status?: number; meta?: PaginationMeta }) {
  return { success: true as const, data, meta: opts?.meta };
}

export function apiError(code: ErrorCode, message: string, status: number, details?: Record<string, string[]>) {
  return { response: { success: false as const, error: { code, message, details } }, status };
}
```

### HTTP status mapping

| Situation | Status | Error code |
|-----------|--------|-----------|
| OK | 200 | — |
| Created | 201 | — |
| No content (delete) | 204 | — |
| Validation failed | 400 | `VALIDATION_ERROR` |
| Missing/invalid auth | 401 | `UNAUTHORIZED` |
| Not allowed | 403 | `FORBIDDEN` |
| Not found | 404 | `NOT_FOUND` / `USER_NOT_FOUND` |
| Duplicate / conflict | 409 | `CONFLICT` / `EMAIL_TAKEN` |
| Rate limited | 429 | `RATE_LIMITED` |
| Server error | 500 | `INTERNAL_ERROR` |

### Error codes (`packages/api-contracts/src/error-codes.ts`)

```typescript
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
} as const;
```

Add domain codes here — never use arbitrary strings in controllers.

## Validation — Zod in `@repo/api-contracts`

```typescript
// packages/api-contracts/src/users/create-user.schema.ts
export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
});
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

// packages/api-contracts/src/users/user.response.ts
export const UserResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  createdAt: z.string().datetime(),
});
export type UserResponse = z.infer<typeof UserResponseSchema>;
```

### ZodValidationPipe

```typescript
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}
  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Invalid request body',
          details: result.error.flatten().fieldErrors,
        },
      });
    }
    return result.data;
  }
}
```

### Query/path validation

```typescript
// Pagination query
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

@Get()
findAll(@Query(new ZodValidationPipe(PaginationQuerySchema)) query: PaginationQuery) {
  return this.usersService.findAll(query);
}
```

## URL conventions

- Global prefix: `/api/v1/` (set in `main.ts`: `app.setGlobalPrefix('api/v1')`)
- Resources: plural nouns — `/users`, `/orders`, `/users/:id/posts`
- Nested max 2 levels — deeper → flatten or query params
- Verbs in URL only for non-CRUD actions: `POST /users/:id/activate`

## Pagination

**Request:** `GET /api/v1/users?page=1&pageSize=20`

**Response:**
```json
{
  "success": true,
  "data": [ { "id": "...", "email": "..." } ],
  "meta": { "page": 1, "pageSize": 20, "total": 142 }
}
```

## Rate limiting

Use `@nestjs/throttler`.

```typescript
// app.module.ts
ThrottlerModule.forRoot([{
  ttl: parseInt(process.env.THROTTLE_TTL ?? '60000'),
  limit: parseInt(process.env.THROTTLE_LIMIT ?? '100'),
}]),

// global
{ provide: APP_GUARD, useClass: ThrottlerGuard },
```

| Endpoint type | Limit |
|--------------|-------|
| Default | 100 req / 60s per IP |
| Auth (login, register) | 10 req / 60s per IP |
| Health check | Skip throttling |

```typescript
@Throttle({ default: { ttl: 60000, limit: 10 } })
@Post('login')
login() { ... }

@SkipThrottle()
@Get('health')
health() { ... }
```

**429 response:**
```json
{
  "success": false,
  "error": { "code": "RATE_LIMITED", "message": "Too many requests. Try again later." }
}
```

## API Key authentication

For server-to-server, webhooks, cron — **not** for browser clients.

```typescript
// common/guards/api-key.guard.ts
@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const key = context.switchToHttp().getRequest().headers['x-api-key'];
    const validKeys = (process.env.API_KEYS ?? '').split(',');
    if (!key || !validKeys.includes(key)) {
      throw new UnauthorizedException({
        success: false,
        error: { code: ErrorCode.UNAUTHORIZED, message: 'Invalid API key' },
      });
    }
    return true;
  }
}
```

| Auth type | Used for | Header |
|-----------|----------|--------|
| None + `@Public()` | Health, public data | — |
| JWT (`JwtAuthGuard`) | User-facing endpoints | `Authorization: Bearer <token>` |
| API Key (`ApiKeyGuard`) | Webhooks, cron, internal | `X-API-Key: <key>` |

```typescript
@Public()
@UseGuards(ApiKeyGuard)
@Post('webhooks/stripe')
handleWebhook() { ... }
```

## Global exception filter

Maps all unhandled errors to `ApiErrorResponse`:

```typescript
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      return res.status(exception.getStatus()).json(body);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = mapPrismaError(exception);
      return res.status(mapped.status).json(mapped.body);
    }

    console.error(exception);
    return res.status(500).json({
      success: false,
      error: { code: ErrorCode.INTERNAL_ERROR, message: 'Internal server error' },
    });
  }
}
```

### Prisma error mapping

| Prisma code | HTTP | Error code |
|-------------|------|-----------|
| P2002 (unique) | 409 | `CONFLICT` |
| P2025 (not found) | 404 | `NOT_FOUND` |
| P2003 (FK) | 400 | `VALIDATION_ERROR` |

## Adding a new endpoint — checklist

```
- [ ] Zod schema + response type in @repo/api-contracts
- [ ] Repository method (if new query)
- [ ] Service method (business logic + mapping)
- [ ] Controller route (thin)
- [ ] Rate limit decided (default / strict / skip)
- [ ] Auth decided (public / JWT / API key)
- [ ] Integration test (happy + error path)
- [ ] Hand off to frontend: api-client + hooks (`00-scaffold-web.md`)
```

## Forbidden

- Prisma in controller or service
- Business logic in controller
- Different response shape than `ApiResponse<T>`
- Inline Zod schemas in controller — import from `@repo/api-contracts`
- Returning raw Prisma entity to client (always map via `toXxxResponse`)
- `prisma migrate reset`
- Leaking stack traces in production
