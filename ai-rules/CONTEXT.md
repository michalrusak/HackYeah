# HackYeah — AI context

Attach at the start of **every** session.

## Stack (tylko to używamy)

| Warstwa | Technologia | App |
|---------|-------------|-----|
| Backend | NestJS 12 + TypeORM + PostgreSQL | `apps/api` |
| Frontend | Angular 19 + Angular Material + ngx-translate | `apps/web` |
| Monorepo | Turborepo + pnpm | root |

**Nie używamy:** React, Next.js, Vite SPA, shadcn, TanStack Query, next-intl.

## Playbooks

| Task | Attach |
|------|--------|
| **Backend bootstrap** | `playbooks/00-scaffold.md` |
| **Frontend bootstrap** | `playbooks/00-scaffold-web.md` |
| **Always** | `playbooks/01-global.md` |
| Backend (Nest) | + `playbooks/02-infra.md` + `playbooks/03-api.md` |
| Angular | + `playbooks/05-web-angular.md` |
| Living stack table | `docs/STACK.md` |

**Bundles** (jeden plik): `bundles/full.md` | `bundles/backend.md` | `bundles/frontend-angular.md` | `bundles/core.md`

> Pliki `04-web-react.md` i `03-api-next-routes.md` są **archiwalne** — nie stosować w tym projekcie.

## Topic index

| Topic | Playbook | Przykłady |
|-------|----------|-----------|
| Root configs (turbo, pnpm, docker) | `00-scaffold`, `02-infra` | `examples/config/` |
| Skrypty cross-platform | root `scripts/` | `scripts/setup.mjs`, `scripts/web-dev.mjs` |
| Nest module structure | `00-scaffold`, `03-api` | `examples/nest-users.module.ts` |
| Repository / Service layers | `03-api` | `examples/users.repository.ts` |
| TypeORM + Postgres | `02-infra`, `03-api` | `apps/api/src/config/database.config.ts` |
| Angular layout, Material, i18n | `05-web-angular` | `apps/web/public/i18n/pl.json` |
| i18n pl.json | `05-web-angular` | `examples/pl.json` |

## Hard rules

| Rule | Detail |
|------|--------|
| Plan first | Non-trivial: plan → confirm → implement |
| Git | No commit / push / merge by agent |
| Database | No DROP, no destructive reset bez zgody |
| TypeScript | No `any`, no `eslint-disable` |
| API | Controller → Service → Repository → TypeORM |
| Nest modules | `src/modules/<feature>/` (docelowo) lub flat w małych feature |
| Web HTTP | HttpClient przez serwisy w `core/` / `features/` — nie w komponentach |
| UI text | `apps/web/public/i18n/pl.json` — ngx-translate, pipe `translate` |
| Cross-platform | Skrypty npm przez Node (`scripts/*.mjs`), nie bash-only |

## Ports

| Serwis | Port |
|--------|------|
| API (NestJS) | **3000** |
| Web (Angular) | **4200** |
| PostgreSQL | **5432** |

Env: root `.env` (utwórz: `pnpm setup`).
