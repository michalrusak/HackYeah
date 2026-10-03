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
