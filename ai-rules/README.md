# AI Rules for HackYeah

Playbooki dla agentów AI i zespołu. Stack: **NestJS + Angular** (bez React/Next).

## Quick start

### 1. Każda sesja

```
ai-rules/CONTEXT.md
ai-rules/playbooks/01-global.md
ai-rules/docs/STACK.md
+ playbook domenowy (patrz tabela w CONTEXT.md)
```

### 2. Playbooki domenowe

| Praca nad… | Dołącz |
|------------|--------|
| NestJS backend | `00-scaffold.md` + `02-infra.md` + `03-api.md` |
| Angular frontend | `00-scaffold-web.md` + `05-web-angular.md` |

### 3. Bundles (jeden plik zamiast wielu playbooków)

```bash
node ai-rules/scripts/build-bundles.mjs
```

| Bundle | Zawartość |
|--------|-----------|
| `bundles/core.md` | global + infra |
| `bundles/backend.md` | backend scaffold + global + infra + Nest API |
| `bundles/frontend-angular.md` | web scaffold + global + Angular |
| `bundles/full.md` | wszystko aktywne (Nest + Angular) |

## Per-tool setup

| Tool | How |
|------|-----|
| **Cursor** | `@ai-rules/CONTEXT.md` + `@ai-rules/playbooks/03-api.md` itd. |
| **Claude Code** | `adapters/claude/CLAUDE.md` → skopiuj do root lub czytaj z `ai-rules/` |
| **Codex / OpenCode** | `adapters/AGENTS.md` |
| **Inne** | Wklej `bundles/full.md` do system prompt |

## Repository structure

```
ai-rules/
├── CONTEXT.md              # Entry point
├── playbooks/              # SOURCE OF TRUTH
│   ├── 00-scaffold.md      # Backend + root monorepo
│   ├── 00-scaffold-web.md  # Angular apps/web
│   ├── 01-global.md        # AI, git, TS, SOLID
│   ├── 02-infra.md         # turbo, docker, tests
│   ├── 03-api.md           # Nest API patterns (TypeORM)
│   ├── 05-web-angular.md   # Material, ngx-translate, services
│   ├── 04-web-react.md     # ARCHIWUM — nie używać
│   └── 03-api-next-routes.md # ARCHIWUM — nie używać
├── docs/STACK.md
├── examples/
├── bundles/                # Auto-generated
└── adapters/
```

## Key patterns

```
API:     Controller → Service → Repository → TypeORM
Nest:    apps/api/src/ (modules/<feature>/ docelowo)
Angular: apps/web/src/app/features/<feature>/
Forms:   Reactive Forms + Validators (Zod w serwisie opcjonalnie)
i18n:    apps/web/public/i18n/pl.json — ngx-translate
HTTP:    Komponent → FeatureService → ApiService → HttpClient
Skrypty: pnpm setup | dev | start | docker:up (cross-platform)
```

## Contributing

1. Edytuj `playbooks/`.
2. `node ai-rules/scripts/build-bundles.mjs`
3. Aktualizuj `docs/STACK.md` przy zmianie stacku.
