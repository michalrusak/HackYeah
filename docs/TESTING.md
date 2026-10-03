# Testy — HackYeah

## Komendy (root)

```bash
pnpm test          # unit testy (api) + karma (web)
pnpm test:e2e      # E2E API (Vitest + supertest)
```

## API — unit (`apps/api`)

- Runner: **Vitest** (`vitest.config.ts`)
- Pliki: `src/**/*.spec.ts`
- Bez bazy (NODE_ENV domyślny, mock modułów)

```bash
pnpm --filter api test
```

## API — E2E (`apps/api`)

- Runner: **Vitest** (`vitest.config.e2e.ts`)
- Pliki: `test/**/*.e2e-spec.ts`
- Setup: `test/setup-e2e.ts` ustawia `NODE_ENV=test` (bez TypeORM — szybkie testy HTTP)
- Walidacja odpowiedzi: schematy Zod z `@repo/api-contracts`

```bash
pnpm --filter api test:e2e
```

## Web — unit (`apps/web`)

- Runner: **Karma + Jasmine** (domyślnie Angular CLI)
- Headless: `pnpm --filter web test`

```bash
pnpm --filter web test
pnpm --filter web test:watch   # watch mode
```

## CI (zalecany pipeline)

```bash
pnpm install
pnpm setup
pnpm build
pnpm test
pnpm test:e2e
```

E2E API z prawdziwą bazą (opcjonalnie): uruchom `pnpm docker:up` i testuj bez `NODE_ENV=test` w osobnym pliku spec.
