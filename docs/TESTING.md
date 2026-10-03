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
- Setup: `test/setup-e2e.ts` ustawia `NODE_ENV=test` (domyślnie bez połączenia z bazą; zestaw PostgreSQL włącza je jawnie)
- Walidacja odpowiedzi: schematy Zod z `@repo/api-contracts`

```bash
pnpm --filter api test:e2e
```

### Tester innowacji — prawdziwy PostgreSQL

`apps/api/test/testers.e2e-spec.ts` uruchamia pełny moduł NestJS z repozytorium
TypeORM i migracją produkcyjną. Zastąpiony jest jedynie transport HTTP do modelu
AI, dzięki czemu testy są deterministyczne i nie zużywają płatnych tokenów.
Bez `TEST_DATABASE_URL` ten zestaw jest pomijany; pozostałe E2E nadal działają.

Wymagania: uruchomiony PostgreSQL, Node.js 22 lub nowszy obsługiwany przez projekt
oraz zbudowane kontrakty: `pnpm --filter @repo/api-contracts build`.
Zalecana jest osobna baza testowa. Rola w połączeniu musi móc tworzyć schematy.
Adres ustaw w środowisku procesu, nie zapisuj danych dostępowych w repozytorium.

PowerShell:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://user:password@localhost:5432/hackyeah_test'
pnpm --filter api test:e2e
Remove-Item Env:TEST_DATABASE_URL
```

macOS / Linux:

```bash
TEST_DATABASE_URL='postgresql://user:password@localhost:5432/hackyeah_test' pnpm --filter api test:e2e
```

Każdy przebieg tworzy własny schemat `testers_e2e_<UUID>`, ustawia `search_path`
i uruchamia migrację z `synchronize: false`. Możliwe jest wskazanie istniejącej
bazy: tabele aplikacji w `public` nie są używane ani czyszczone. Po testach usuwane
są wyłącznie rekordy utworzone w danym przebiegu. Schemat, tabele i wpis migracji
pozostają; testy nie wykonują `DROP`, `TRUNCATE` ani resetu bazy.

Zakres: walidacja zgody i formularza, tworzenie oraz edycja profilu, izolacja
kluczy właścicieli, ukrywanie kluczy w API i danych AI, wyszukiwanie wyłącznie
aktywnych profili, odrzucanie nieistniejących / nieaktywnych / powtórzonych ID
modelu, cofnięcie publikacji, kontrola przypisań oraz ich trwałość po restarcie
aplikacji.

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

W CI zestaw PostgreSQL można włączyć przez `TEST_DATABASE_URL`; nie wymaga zmiany
`NODE_ENV=test`. Bez tej zmiennej przebiegi pozostają niezależne od bazy.
