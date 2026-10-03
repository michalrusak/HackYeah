# Stack decisions — HackYeah

Living document. AI agents: read before choosing patterns.

## Global (decided)

| Area | Choice |
|------|--------|
| Monorepo | Turborepo + pnpm |
| Language | TypeScript strict |
| Lint / format | oxlint (apps) + Prettier (root) |
| Containers | Docker Compose (PostgreSQL 17) |
| ORM | **TypeORM** (NestJS) |
| Validation | class-validator / Zod at boundaries (docelowo `@repo/api-contracts`) |
| API shape | `{ success, data }` / `{ success, error }` — see `playbooks/03-api.md` |
| API layers | Controller → Service → Repository → TypeORM |
| Frontend UI | **Angular Material** + CDK |
| Frontend forms | Reactive Forms + walidacja (Zod opcjonalnie w serwisie) |
| Frontend HTTP | HttpClient + interceptory + feature services |
| i18n | **`public/i18n/pl.json`** + `@ngx-translate/core` |
| Cross-platform scripts | Node `.mjs` w root `scripts/` |

## Apps (aktualne)

| App | Framework | UI | API | DB | Status |
|-----|-----------|-----|-----|-----|--------|
| `apps/api` | NestJS 12 | — | REST | TypeORM + Postgres | ✅ scaffold |
| `apps/web` | Angular 19 | Material | → `API_URL` | — | ✅ scaffold |

## Shared packages

| Package | Purpose |
|---------|---------|
| `@repo/eslint-config` | Shared ESLint |
| `@repo/typescript-config` | Shared tsconfig |
| `@repo/api-contracts` | *(planned)* Zod schemas, types, error codes |
| `@repo/api-client` | *(planned)* typed HTTP dla Angular |

## Nie używamy

- React, Next.js, Vite SPA
- shadcn/ui, Tailwind-first UI
- TanStack Query (React) — w Angular: signals + services (lub `@tanstack/angular-query` gdy potrzeba)
- next-intl, react-i18next
- `@repo/ui` (React)
- Prisma *(playbooki mogą wspominać jako wzorzec — projekt używa TypeORM)*

## Open decisions

- [ ] `@repo/api-contracts` — kiedy wydzielić wspólne Zod/types
- [ ] Auth: JWT vs session
- [ ] Angular tests: Karma (default) vs Vitest
- [ ] PR / comment language: English vs Polish
