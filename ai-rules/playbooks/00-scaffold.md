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
