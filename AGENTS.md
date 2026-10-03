<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

## HackYeah — reguły projektu

**Stack:** NestJS (`apps/api`) + Angular (`apps/web`) + PostgreSQL. **Bez React/Next.**

Przed kodowaniem czytaj:

1. `ai-rules/CONTEXT.md`
2. `ai-rules/playbooks/01-global.md`
3. `ai-rules/docs/STACK.md`
4. Playbook domenowy: `03-api.md` (backend) lub `05-web-angular.md` (frontend)

Bundle (wszystko w jednym pliku): `ai-rules/bundles/full.md`

| Obszar | Zasada |
|--------|--------|
| API | Controller → Service → Repository → Prisma |
| Angular | Standalone components, Material, ngx-translate |
| i18n | `apps/web/public/i18n/pl.json` — zero hardcoded UI text |
| Env / skrypty | `pnpm setup`, root `scripts/*.mjs` (Windows + macOS + Linux) |
| Git | Agent nie commituje ani nie pushuje bez prośby |

Pliki `04-web-react.md` i `03-api-next-routes.md` są **archiwalne** — nie stosować.
