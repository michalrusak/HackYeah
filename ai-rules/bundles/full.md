# Bundle: full.md

> Auto-generated from `playbooks/`. Edit playbooks, then rebuild.
> Run: `node ai-rules/scripts/build-bundles.mjs`

---
# 00 — Backend scaffold (Nest + shared root)

> Attach when bootstrapping **backend** or shared monorepo root. Frontend: `00-scaffold-web.md`.

## Root — required files

Every project MUST have these files at monorepo root. Copy from `examples/config/`.

```
hackyeah/
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── docker-compose.yml
├── .env.example
├── .gitignore
├── .prettierrc
├── tsconfig.json              # references only
└── apps/ + packages/
```

### Root `package.json` — required scripts

```json
{
  "name": "hackyeah",
  "private": true,
  "scripts": {
    "setup": "node scripts/setup.mjs",
    "dev": "turbo run dev",
    "start": "turbo run start",
    "build": "turbo run build",
    "lint:fix": "turbo run lint:fix",
    "check-types": "turbo run check-types",
    "format": "prettier --write \"**/*.{ts,tsx,md}\"",
    "docker:up": "docker compose up -d",
    "docker:down": "docker compose down",
    "docker:logs": "docker compose logs -f postgres"
  },
  "devDependencies": {
    "prettier": "^3.0.0",
    "turbo": "^2.0.0",
    "typescript": "^5.0.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

### Root `pnpm-workspace.yaml`

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### Every app/package `package.json` MUST have

```json
{
  "name": "api-nest",
  "scripts": {
    "dev": "...",
    "build": "...",
    "lint:fix": "eslint src/ --fix",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

No app without `lint:fix` and `test` scripts.

---

## Package: `@repo/api-contracts` — create first

Shared types and Zod schemas. Imported by API and (later) `@repo/api-client`.

```
packages/api-contracts/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── response.types.ts
    ├── error-codes.ts
    ├── pagination.schema.ts
    └── users/
        ├── create-user.schema.ts
        ├── user.response.ts
        └── index.ts
```

```json
// packages/api-contracts/package.json
{
  "name": "@repo/api-contracts",
  "version": "0.0.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": { "zod": "^3.23.0" }
}
```

```typescript
// packages/api-contracts/src/index.ts — barrel export everything
export * from './response.types';
export * from './error-codes';
export * from './pagination.schema';
export * from './users';
```

**Rule:** New endpoint = new folder in `src/<resource>/` with schema + response + index.ts.

---

## App: `api-nest` — create second

```
apps/api-nest/
├── package.json
├── tsconfig.json
├── nest-cli.json
├── vitest.config.ts
├── .env.example
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── test/
│   ├── setup.ts
│   └── users.e2e-spec.ts
└── src/
    ├── main.ts
    ├── app.module.ts
    ├── prisma/
    │   ├── prisma.module.ts
    │   └── prisma.service.ts
    ├── common/
    │   ├── guards/api-key.guard.ts
    │   ├── guards/jwt-auth.guard.ts
    │   ├── filters/global-exception.filter.ts
    │   ├── pipes/zod-validation.pipe.ts
    │   ├── decorators/public.decorator.ts
    │   └── utils/api-response.ts
    └── modules/
        ├── health/
        └── users/
```

### `main.ts` — required bootstrap

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.enableCors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000' });
  await app.listen(process.env.PORT ?? 3001);
}
```

### `app.module.ts` — required imports

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    HealthModule,
    UsersModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
```

---

## Adding a new API resource — backend steps

Example: add `orders`. Create **in this order**:

```
1. packages/api-contracts/src/orders/
     create-order.schema.ts
     order.response.ts
     index.ts
   → export from packages/api-contracts/src/index.ts

2. apps/api-nest/prisma/schema.prisma
   → add Order model
   → pnpm db:migrate (human runs, agent prepares migration)

3. apps/api-nest/src/modules/orders/
     orders.repository.ts
     orders.service.ts
     orders.controller.ts
     orders.module.ts
     orders.service.spec.ts

4. apps/api-nest/test/orders.e2e-spec.ts
```

Frontend steps 5–6: `00-scaffold-web.md`.

**Do not skip steps. Do not merge layers.**

---

## Adding a new Prisma model — exact steps

```
1. Edit apps/api-nest/prisma/schema.prisma
   - PascalCase model, @@map snake_case plural
   - id @default(cuid()), createdAt, updatedAt

2. Run: pnpm db:migrate --name add_<model>_table
   (human runs — agent prepares schema only)

3. Create module in src/modules/<resource>/
   - repository with prisma.<model>.*
   - service with business logic
   - controller with routes

4. Add Zod schemas in @repo/api-contracts

5. Add e2e test in test/<resource>.e2e-spec.ts
```

---

## Environment variables — exact list

| Variable | Where | Required |
|----------|-------|----------|
| `DATABASE_URL` | api-nest | ✅ |
| `PORT` | api-nest | default 3001 |
| `CORS_ORIGIN` | api-nest | default localhost:3000 |
| `JWT_SECRET` | api-nest | when auth enabled |
| `API_KEYS` | api-nest | comma-separated |
| `THROTTLE_TTL` | api-nest | default 60000 |
| `THROTTLE_LIMIT` | api-nest | default 100 |

Frontend env vars: `00-scaffold-web.md`.

All documented in root `.env.example`.

---

## Ports (fixed)

| Service | Port |
|---------|------|
| api-nest | 3001 |
| Postgres (dev) | 5432 |
| Postgres (test) | 5433 |

Frontend ports: `00-scaffold-web.md` / `docs/STACK.md`.

Do not change without updating `.env.example` and `docs/STACK.md`.

---

## CI pipeline — required steps

```yaml
# .github/workflows/ci.yml (when added)
- pnpm install
- pnpm turbo lint:fix
- pnpm turbo test
- pnpm turbo build
```

Every PR must pass lint:fix + test + build for affected packages.


---

# 00 — Web scaffold (Angular)

> Attach when bootstrapping or extending **`apps/web`**. Backend: `00-scaffold.md`.

## App: `apps/web`

```
apps/web/
├── angular.json
├── package.json
├── public/
│   └── i18n/
│       └── pl.json                 # ALL UI strings (ngx-translate)
├── scripts/                        # (opcjonalnie — prefer root scripts/)
└── src/
    ├── app/
    │   ├── core/
    │   │   ├── constants/
    │   │   ├── layout/             # app-header, app-layout
    │   │   ├── models/
    │   │   ├── services/           # api.service, auth.service
    │   │   └── interceptors/
    │   ├── pages/                  # route-level pages (home, about…)
    │   ├── features/               # docelowo: większe moduły domenowe
    │   ├── app.config.ts
    │   ├── app.routes.ts
    │   └── app.component.ts
    ├── index.html                  # lang="pl"
    └── styles.scss
```

## Required deps (frontend)

- `@angular/*` 19.x
- `@angular/material`, `@angular/cdk`, `@angular/animations`
- `@ngx-translate/core`, `@ngx-translate/http-loader`

Port: **`WEB_PORT`** z `.env`, domyślnie **4200**.  
API URL: **`API_URL`** z `.env`, domyślnie `http://localhost:3000`.

Dev/start uruchamiane przez root `scripts/web-dev.mjs` / `scripts/web-serve.mjs` (cross-platform).

## i18n

- Plik: `public/i18n/pl.json`
- Konfiguracja: `app.config.ts` → `provideTranslateHttpLoader({ prefix: './i18n/', suffix: '.json' })`
- Szablony: `{{ 'nav.home' | translate }}`
- Nawigacja: klucze w `core/constants/app.constants.ts` (`labelKey`, nie hardcoded label)

**Hard rule:** zero hardcoded user-facing strings w HTML/TS.

## Po dodaniu resource w API — kroki frontend

```
1. Klucze i18n w public/i18n/pl.json
2. (docelowo) typy/schemas w @repo/api-contracts
3. Metody w features/<name>/<name>.service.ts (HttpClient tylko tu lub w ApiService)
4. Standalone component(s) w features/<name>/
5. Trasa lazy w <name>.routes.ts + wpis w app.routes.ts
```

Szczegóły: `playbooks/05-web-angular.md`.


---

# 01 — Global rules

> **Always attach** this playbook in every AI session.

## AI workflow

1. **Plan first.** For anything beyond a one-line fix, output:
   - Goal (1 sentence)
   - Steps (numbered)
   - Files to create/edit
   - Risks or open questions
   Then wait for confirmation on large changes (>3 files or new module).
2. **Read before write.** Open existing files in the target app. Match naming, imports, and patterns already there.
3. **Minimal diff.** Only change what the task requires. No drive-by refactors, no unused code, no "while I'm here" dependency bumps.
4. **No AI slop.** No filler comments, no over-abstracted helpers, no 200-line files when 40 lines suffice. Code should look like a senior dev wrote it under time pressure — clean, direct, boring.
5. **Verify.** Before claiming done, run lint:fix/test for affected packages and report results.

## Git — agent restrictions

**NEVER** unless user explicitly asks:

```
git commit | git push | git merge | git rebase | gh pr create
```

**Allowed** for analysis: `git status`, `git diff`, `git log`, `git branch`

### Human workflow

| Item | Rule |
|------|------|
| Branch | `feat/`, `fix/`, `chore/` + kebab-case |
| PR size | ≤300 lines when possible |
| PR body | What / Why / How to test |
| Commits | Conventional Commits: `feat(users): add create endpoint` |
| Main | Protected — merge only via PR |

## TypeScript

```jsonc
// packages/tsconfig/base.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

| Rule | Detail |
|------|--------|
| No `any` | Use concrete type, generic, or discriminated union |
| No `unknown` as escape | Validate with Zod at boundaries, then use inferred type |
| Return types | Required on exported functions, services, hooks, API handlers |
| Shared types | Live in `@repo/api-contracts` — never duplicate in apps |
| Path aliases | `@repo/api-contracts`, `@repo/<package>` |

```typescript
// ❌ BAD
const body = req.body as CreateUserInput;
const data: any = await fetch(...);

// ✅ GOOD
const body = CreateUserSchema.parse(req.body);
const data = UserResponseSchema.parse(json.data);
```

### Forbidden

- `@ts-ignore`, `@ts-expect-error`
- `eslint-disable` (any form)
- Non-null assertion `!` without prior guard
- Type assertion `as T` without prior Zod parse

## ESLint + Prettier

- Shared config: `packages/eslint-config`
- Prettier: root `.prettierrc`
- All apps extend shared config — no local rule weakening
- Fix errors; never suppress

```bash
pnpm turbo lint:fix --filter=<app>
pnpm turbo format:check   # if configured
```

## SOLID — how we apply it

### S — Single Responsibility

One class/file = one reason to change.

| Layer | Responsibility | Must NOT do |
|-------|---------------|-------------|
| Controller / route.ts | HTTP: parse request, call service, return response | Business rules, Prisma |
| Service | Business logic, orchestration, mapping to response DTO | HTTP details, raw SQL |
| Repository | Database queries (Prisma) | Business rules, HTTP |

```typescript
// ❌ BAD — service does HTTP + DB + validation
@Post()
async create(@Body() body) {
  if (!body.email.includes('@')) return { error: 'bad email' };
  return this.prisma.user.create({ data: body });
}

// ✅ GOOD
@Post()
create(@Body(new ZodValidationPipe(CreateUserSchema)) body: CreateUserInput) {
  return this.usersService.create(body);
}
```

### O — Open/Closed

Extend via new modules/classes, not by editing existing ones with growing if/else.

```typescript
// ❌ BAD
if (user.plan === 'premium') { /* 20 lines */ }
else if (user.plan === 'free') { /* 20 lines */ }

// ✅ GOOD — new behavior = new class/module
interface NotificationSender { send(user: User, msg: string): Promise<void>; }
class EmailSender implements NotificationSender { ... }
class PushSender implements NotificationSender { ... }
```

### L — Liskov Substitution

Repository interfaces must be swappable (real Prisma repo vs in-memory mock in tests).

```typescript
// users.repository.interface.ts
export abstract class UsersRepository {
  abstract findById(id: string): Promise<User | null>;
  abstract create(data: CreateUserInput): Promise<User>;
}

// tests: class InMemoryUsersRepository implements UsersRepository { ... }
```

### I — Interface Segregation

Small, focused interfaces. Don't force a class to implement methods it doesn't need.

```typescript
// ❌ BAD — fat interface
interface UserRepo {
  findById; create; delete; sendEmail; generateReport;
}

// ✅ GOOD — split
interface UsersReader { findById(id: string): Promise<User | null>; }
interface UsersWriter { create(data: CreateUserInput): Promise<User>; }
```

### D — Dependency Inversion

High-level modules depend on abstractions, not Prisma directly.

```typescript
// ✅ Service depends on repository, not PrismaService
@Injectable()
export class UsersService {
  constructor(private readonly usersRepo: UsersRepository) {}
}
```

## DRY — single source of truth

| What | Single location |
|------|----------------|
| Request/response schemas | `@repo/api-contracts` (Zod) |
| Error codes | `@repo/api-contracts/src/error-codes.ts` |
| API response types | `@repo/api-contracts/src/response.types.ts` |
| ESLint/TS config | `packages/eslint-config`, `packages/tsconfig` |

Frontend DRY (services, i18n): `05-web-angular.md`.

If you copy a Zod schema, type, or error code into an app — you're doing it wrong.

## KISS — when to stop abstracting

| Situation | Do | Don't |
|-----------|-----|-------|
| 1 endpoint, 1 query | One service method + one repo method | Generic `BaseCrudService<T>` |
| 2 similar forms | Copy and adjust | Abstract mega-form component on day 1 |
| 3 env vars | `process.env.DATABASE_URL` with Zod parse in `env.ts` | Config service with 5 layers |
| Error handling | Global filter + `apiError()` helper | Custom error class hierarchy per feature |

**Rule of thumb:** abstract on the **third** repetition, not the first.

## Secrets and env

- `.env.example` committed — documents every var
- `.env` never committed
- No secrets in source, Dockerfiles, or client-side env vars
- Client env: tylko publiczne zmienne (np. `API_URL` w root `.env`, ładowane przez Turbo / skrypty Node) — bez sekretów w Angularze


---

# 02 — Infrastructure (backend + shared)

> Attach with `01-global.md`. Frontend: `00-scaffold-web.md`, `05-web-angular.md`.

## Monorepo — layout (backend focus)

```
HackYeah/
├── apps/
│   ├── api/                      # NestJS + TypeORM + PostgreSQL
│   └── web/                      # Angular 19 + Material
├── packages/
│   ├── eslint-config/
│   └── typescript-config/
├── scripts/                      # cross-platform (setup, web-dev, web-serve)
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
└── .env.example
```

Szczegóły stacku: `docs/STACK.md`. Przykładowe configi: `examples/config/`.

---

## pnpm — commands you MUST use

```bash
# Install + env
pnpm install
pnpm setup

# Dev (API + web)
pnpm dev

# Pojedyncza app
pnpm dev --filter=api
pnpm dev --filter=web

# Zależności
pnpm --filter api add @nestjs/throttler
pnpm --filter web add @angular/material

# Monorepo
pnpm lint:fix
pnpm build
pnpm check-types

# Database (Docker)
pnpm docker:up
pnpm docker:down
pnpm docker:logs
```

### Dependency rules (hard)

| Rule | Example |
|------|---------|
| Shared code in `packages/` | `@repo/api-contracts` |
| Apps import packages | `import { CreateUserSchema } from '@repo/api-contracts'` |
| Apps NEVER import apps | one app importing another's src ❌ |
| Contracts before implementation | schema in api-contracts → then API module |

---

## Turborepo — exact `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "lint:fix": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

---

## Docker Compose — exact file

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    container_name: hackyeah-postgres
    ports:
      - '5432:5432'
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: app_dev
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
      timeout: 3s
      retries: 5

  postgres-test:
    image: postgres:16-alpine
    container_name: hackyeah-postgres-test
    ports:
      - '5433:5432'
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: app_test
    profiles: ['test']

volumes:
  pgdata:
```

```bash
# .env.example — commit this
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app_dev
DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5433/app_test
API_KEYS=dev-key-change-me
JWT_SECRET=dev-secret-change-me
THROTTLE_TTL=60000
THROTTLE_LIMIT=100
CORS_ORIGIN=http://localhost:3000
PORT=3001
```

### Startup — run in this order

```bash
pnpm db:up                              # 1. postgres healthy
pnpm db:migrate                         # 2. apply migrations
pnpm db:seed                            # 3. optional dev data
pnpm turbo dev --filter=api-nest   # 4. apps
```

---

## Prisma — exact setup

**Location:** `apps/api-nest/prisma/schema.prisma`

### `PrismaService` — required singleton

```typescript
// apps/api-nest/src/prisma/prisma.service.ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}

// apps/api-nest/src/prisma/prisma.module.ts
@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
```

Only **Repository** classes inject `PrismaService`. Never controller, never service.

### Schema rules — every model MUST have

```prisma
model Example {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("examples")
}
```

| Element | Rule | Example |
|---------|------|---------|
| Model name | PascalCase singular | `OrderItem` |
| Table | `@@map("snake_case_plural")` | `order_items` |
| Field | camelCase | `userId` |
| Column | `@map("snake_case")` when multi-word | `user_id` |
| PK | always `id String @id @default(cuid())` | |
| FK field | `<model>Id` | `userId` |
| Relation | descriptive camelCase | `author`, `orderItems` |

Full example: `examples/schema.prisma`

### Migration commands

```bash
# Create migration (after editing schema.prisma)
pnpm --filter api-nest exec prisma migrate dev --name add_orders_table

# Production / CI
pnpm --filter api-nest exec prisma migrate deploy

# Inspect drift
pnpm --filter api-nest exec prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma
```

### Agent — FORBIDDEN commands

```
prisma migrate reset          ❌ NEVER
prisma db push --force-reset  ❌ NEVER
DROP DATABASE / DROP TABLE    ❌ NEVER
```

On failure: fix schema or migration SQL → `migrate resolve` → corrective migration.

### Seed — exact pattern

```typescript
// apps/api-nest/prisma/seed.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { email: 'dev@hackyeah.local' },
    update: {},
    create: { email: 'dev@hackyeah.local', name: 'Dev User' },
  });
}

main().finally(() => prisma.$disconnect());
```

```json
// apps/api-nest/package.json
"prisma": { "seed": "tsx prisma/seed.ts" }
```

---

## Testing — exact patterns

### What to write when

| You add… | You MUST create… |
|----------|-----------------|
| Service method with logic | `*.service.spec.ts` — mock repository |
| API endpoint | `test/*.e2e-spec.ts` — supertest, real test DB |
| Bug fix | Regression test proving the fix |

### api-nest: `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: { include: ['src/modules/**'] },
  },
});
```

### Unit test — service (mock repository)

File: `src/modules/users/users.service.spec.ts`
Example: `examples/users.service.spec.ts`

```typescript
// Pattern:
const mockRepo = { findById: vi.fn(), findByEmail: vi.fn(), create: vi.fn() };
const service = new UsersService(mockRepo as unknown as UsersRepository);

it('returns 404 when user not found', async () => {
  mockRepo.findById.mockResolvedValue(null);
  const result = await service.findById('missing');
  expect(result.success).toBe(false);
  expect(result.error.code).toBe('USER_NOT_FOUND');
});
```

### E2E test — endpoint (supertest + test DB)

File: `test/users.e2e-spec.ts`
Example: `examples/users.e2e-spec.ts`

```typescript
// Pattern:
beforeAll(async () => {
  app = await createTestApp();  // bootstraps Nest with test DATABASE_URL
});
afterEach(async () => {
  await cleanDatabase();  // truncate tables — test DB only!
});

it('POST /users returns 201', () =>
  request(app.getHttpServer())
    .post('/api/v1/users')
    .send({ email: 'a@b.com', name: 'Alice' })
    .expect(201)
    .expect(res => {
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('a@b.com');
    }));

it('POST /users returns 409 on duplicate email', async () => {
  await createUser({ email: 'dup@b.com', name: 'A' });
  return request(app.getHttpServer())
    post('/api/v1/users')
    .send({ email: 'dup@b.com', name: 'B' })
    .expect(409)
    .expect(res => expect(res.body.error.code).toBe('EMAIL_TAKEN'));
});
```

### Test DB

```bash
# Start test postgres
docker compose --profile test up -d postgres-test

# .env.test (never commit)
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/app_test
```

- Truncate tables in `afterEach` — **test DB only**
- Never point tests at `app_dev` database

### Before PR — backend

```bash
pnpm turbo lint:fix test build --filter=api-nest
```


---

# 03 — API (NestJS)

> Attach for backend: `apps/api/**`, `packages/api-contracts/**` (gdy istnieje).
> **ORM w projekcie: TypeORM** (nie Prisma). Wzorce Repository/Service takie same.

## Architecture overview

```
HTTP Request
  → Guard (auth / api-key / throttle)
  → Pipe (Zod validation)
  → Controller / route.ts
  → Service (business logic)
  → Repository (TypeORM / DB queries)
  → map to ApiResponse<T>
  → HTTP Response
```

**Hard rule:** Zapytania DB tylko w Repository (TypeORM). Services nie importują `DataSource` / `Repository` bezpośrednio — tylko przez repo class.

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


---

# 05 — Web Angular

> Attach when working on: `apps/web/**`.

## Stack

| Tool | Purpose |
|------|---------|
| Angular 19 | Framework (standalone components) |
| Angular Material + CDK | UI |
| HttpClient | HTTP (via typed API service) |
| Reactive Forms | Forms |
| Zod (from `@repo/api-contracts`) | Validation — parse in service layer |
| `@ngx-translate/core` + http-loader | Translations (`public/i18n/pl.json`) |
| Signals | Reactive state |

## Folder structure

```
apps/web/src/app/
├── core/
│   ├── constants/                   # nav items (labelKey → i18n)
│   ├── layout/                      # app-header, app-layout
│   ├── services/                    # api.service, auth.service
│   ├── interceptors/
│   ├── guards/
│   └── models/
├── pages/                           # proste strony (home, about…)
├── features/                        # większe moduły domenowe
│   └── users/
│       ├── users.routes.ts
│       ├── users.service.ts
│       └── user-list/ …
├── app.config.ts                    # provideTranslateHttpLoader, HttpClient
├── app.routes.ts
public/i18n/
└── pl.json                          # ALL user-facing strings
```

**All features live in `features/`** — never directly in `app/`.

## API Service — typed HTTP

```typescript
// core/services/api.service.ts
@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  get<T>(path: string, schema: ZodType<T>): Observable<T> {
    return this.http.get<ApiResponse<unknown>>(`${this.baseUrl}${path}`).pipe(
      map((json) => {
        if (!json.success) throw new ApiClientError(json.error);
        return schema.parse(json.data);
      }),
    );
  }

  post<T>(path: string, body: unknown, schema: ZodType<T>): Observable<T> {
    return this.http.post<ApiResponse<unknown>>(`${this.baseUrl}${path}`, body).pipe(
      map((json) => {
        if (!json.success) throw new ApiClientError(json.error);
        return schema.parse(json.data);
      }),
    );
  }
}
```

### Feature service

```typescript
// features/users/users.service.ts
@Injectable({ providedIn: 'root' })
export class UsersService {
  constructor(private api: ApiService) {}

  getUser(id: string) {
    return this.api.get(`/users/${id}`, UserResponseSchema);
  }

  createUser(input: CreateUserInput) {
    const validated = CreateUserSchema.parse(input);
    return this.api.post('/users', validated, UserResponseSchema);
  }
}
```

**Hard rule:** Components never call `HttpClient` directly — always through feature service.

## Error interceptor

```typescript
// core/interceptors/error.interceptor.ts
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.error?.error?.code) {
        const i18nKey = ERROR_I18N_KEYS[err.error.error.code] ?? 'errors.generic';
        snackBar.open(translate.instant(i18nKey), '', { duration: 5000 });
      }
      return throwError(() => err);
    }),
  );
};
```

Mapowanie kodów błędów API → klucze i18n: w `@repo/api-contracts` (docelowo) lub `core/constants/error-i18n.ts`.

## Reactive Forms + Zod

```typescript
// features/users/user-form/user-form.component.ts
@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, TranslatePipe],
  templateUrl: './user-form.component.html',
})
export class UserFormComponent {
  private fb = inject(FormBuilder);
  private usersService = inject(UsersService);
  private snackBar = inject(MatSnackBar);
  private translate = inject(TranslateService);

  isSubmitting = signal(false);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    name: ['', [Validators.required, Validators.maxLength(100)]],
  });

  onSubmit() {
    if (this.form.invalid) return;

    const parsed = CreateUserSchema.safeParse(this.form.value);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0] as string;
        this.form.get(field)?.setErrors({ zod: issue.message });
      });
      return;
    }

    this.isSubmitting.set(true);
    this.usersService.createUser(parsed.data).subscribe({
      next: () => {
        this.snackBar.open(this.translate.instant('users.form.success'), '', { duration: 3000 });
        this.form.reset();
        this.isSubmitting.set(false);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        // error interceptor handles display
      },
    });
  }
}
```

### Template — i18n only

```html
<!-- user-form.component.html -->
<form [formGroup]="form" (ngSubmit)="onSubmit()">
  <mat-form-field>
    <mat-label>{{ 'users.form.emailLabel' | translate }}</mat-label>
    <input matInput formControlName="email" type="email" />
    <mat-error *ngIf="form.get('email')?.hasError('required')">
      {{ 'validation.required' | translate }}
    </mat-error>
  </mat-form-field>

  <mat-form-field>
    <mat-label>{{ 'users.form.nameLabel' | translate }}</mat-label>
    <input matInput formControlName="name" />
  </mat-form-field>

  <button mat-raised-button color="primary" type="submit" [disabled]="isSubmitting()">
    {{ (isSubmitting() ? 'users.form.submitting' : 'users.form.submit') | translate }}
  </button>
</form>
```

## i18n — pl.json only

Plik: `public/i18n/pl.json`:

```json
{
  "common": { "save": "Zapisz", "cancel": "Anuluj" },
  "errors": { "emailTaken": "Ten adres e-mail jest już zajęty." },
  "users": {
    "form": {
      "emailLabel": "Adres e-mail",
      "nameLabel": "Imię i nazwisko",
      "submit": "Utwórz użytkownika",
      "submitting": "Tworzenie...",
      "success": "Użytkownik utworzony."
    }
  },
  "validation": { "required": "To pole jest wymagane." }
}
```

**Rules:** Wszystkie teksty UI w `pl.json` — zero hardcoded strings w HTML/TS.

## Routing

```typescript
// features/users/users.routes.ts
export const USERS_ROUTES: Routes = [
  { path: '', component: UserListComponent },
  { path: 'new', component: UserFormComponent },
  { path: ':id', component: UserDetailComponent },
];

// app.routes.ts
export const routes: Routes = [
  { path: 'users', loadChildren: () => import('./features/users/users.routes').then(m => m.USERS_ROUTES) },
];
```

- Lazy-load all features
- Standalone components — no NgModules

## State with signals

```typescript
// features/users/user-list/user-list.component.ts
export class UserListComponent implements OnInit {
  private usersService = inject(UsersService);

  users = signal<UserResponse[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);

  ngOnInit() {
    this.usersService.getUsers(1, 20).subscribe({
      next: (result) => { this.users.set(result.data); this.isLoading.set(false); },
      error: () => { this.error.set('errors.generic'); this.isLoading.set(false); },
    });
  }
}
```

For complex async state with caching, consider `@tanstack/angular-query` — otherwise signals + service is enough (KISS).

## Material theming

- Define theme in `styles.scss` using Material 3 theming API
- Use Material components for: buttons, inputs, dialogs, tables, snackbar
- CDK for: overlay, drag-drop, virtual scroll (when needed)

## Adding a new feature — checklist

```
- [ ] i18n keys in public/i18n/pl.json
- [ ] Zod schema in @repo/api-contracts (if new API interaction)
- [ ] Feature service methods (via ApiService)
- [ ] Standalone component(s) in features/<name>/
- [ ] Lazy route in features/<name>/<name>.routes.ts
- [ ] Register route in app.routes.ts
- [ ] TestBed test for form component
```

## Forbidden

- NgModules for new features
- HttpClient in components — use feature service
- Hardcoded strings in templates
- React/Next/shadcn/Tailwind-first patterns
- next-intl, react-i18next, TanStack Query (React)
- jQuery or direct DOM manipulation
- `any` on form values or API responses
