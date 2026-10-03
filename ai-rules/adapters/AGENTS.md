# Agent instructions — HackYeah

Stack: **NestJS** (`apps/api`) + **Angular** (`apps/web`). Bez React/Next.

Read at session start:

1. `ai-rules/CONTEXT.md`
2. `ai-rules/playbooks/01-global.md`
3. `ai-rules/docs/STACK.md`
4. Domain playbook:
   - Backend → `ai-rules/playbooks/03-api.md`
   - Angular → `ai-rules/playbooks/05-web-angular.md`

Or attach bundle: `ai-rules/bundles/full.md`

Hard rules: plan first, no git commit/push, Controller → Service → Repository → TypeORM, HttpClient only in services, all UI text in `apps/web/public/i18n/pl.json`, cross-platform scripts via root `scripts/*.mjs`.
