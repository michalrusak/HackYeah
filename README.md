# HackYeah

Monorepo na hackathon: **NestJS** (backend) + **Angular** (frontend) + **PostgreSQL**.

Komendy działają tak samo na **Windows (PowerShell)**, **macOS** i **Linux (bash)**.

Funkcjonalności: [matchmaking społeczny](docs/MATCHMAKING.md) i [Zasobnik wiedzy](docs/KNOWLEDGE.md). Zasobnik wymaga migracji PostgreSQL, inicjalizacji katalogu i konfiguracji hasła administratora według swojej dokumentacji. Strony: `/matchmaking`, `/zasobnik`, `/zasobnik/admin`.

---

## Wymagania

| Narzędzie | Wersja |
|-----------|--------|
| Node.js | 22.23.3 (pnpm pobiera wersję projektu przy `pnpm install`) |
| pnpm | 11.x (`corepack enable` → wersja z `package.json`) |
| Docker | do bazy PostgreSQL |

Wersja Node.js do uruchamiania skryptów jest przypięta w `package.json` (`devEngines.runtime`). Po zmianie konfiguracji uruchom `pnpm install`; nie trzeba zmieniać systemowej wersji Node.js.

Skrypty Turbo przekazują jawnie `--ui=tui`. W Turbo 2.11.7 omija to błąd obsługi Ctrl+C w terminalu Windows, powodujący kod `3221226505` przy uruchamianiu przez pnpm. Samo `"ui": "tui"` w `turbo.json` nie wystarcza — launcher sprawdza argument CLI.

### `ERR_PNPM_IGNORED_BUILDS` (esbuild / workerd / prisma)

pnpm 11 domyślnie blokuje skrypty `postinstall` zależności. **Zatwierdzone buildy są w repo** — plik `pnpm-workspace.yaml` → sekcja `allowBuilds`.

Po `git pull`:

```bash
pnpm install
```

**Nie** uruchamiaj `pnpm approve-builds` — może nadpisać config placeholderami. Jeśli błąd wraca, sprawdź czy `pnpm-workspace.yaml` ma `allowBuilds` z wartościami `true`/`false`, a nie tekstem `set this to true or false`.

---

## Szybki start

```bash
pnpm install
pnpm setup        # tworzy .env z .env.example (tylko pierwszy raz)
pnpm docker:up    # uruchamia PostgreSQL
pnpm db:migrate   # tworzy tabele aplikacji bez resetowania danych
pnpm db:seed      # katalog ROPS dla matchmakingu i demonstracyjne profile testera
pnpm dev          # API + frontend w trybie developerskim
```

Matchmaking korzysta z opublikowanych zasobów w bazie. Po utworzeniu nowej bazy wykonaj `pnpm db:seed`; bez katalogu wyszukiwanie zwróci zero dopasowań także dla seniorów. Sam katalog można wczytać przez `pnpm --filter api knowledge:seed` po zbudowaniu API. Istniejące wpisy i decyzje o publikacji pozostają zachowane.

Po starcie:

| Serwis | URL |
|--------|-----|
| Frontend (Angular) | http://localhost:4200 |
| Backend (NestJS) | http://localhost:3000 |
| PostgreSQL | `localhost:5432` |

### Wdrożenie produkcyjne (Docker)

Pełny stack w kontenerach (nginx + API + PostgreSQL):

```bash
cp .env.production.example .env   # uzupełnij domeny i hasła
pnpm docker:prod:up
```

Aplikacja: http://localhost:8080 · Szczegóły: **[docs/DEPLOY.md](docs/DEPLOY.md)**

---

## Struktura projektu

```
HackYeah/
├── apps/
│   ├── api/          NestJS — REST API, Prisma, PostgreSQL
│   └── web/          Angular 19 + Angular Material
├── packages/
│   ├── eslint-config/
│   └── typescript-config/
├── scripts/          skrypty cross-platform (Node.js)
├── docker-compose.yml
└── .env.example      szablon zmiennych środowiskowych
```

---

## Komendy

Wszystkie uruchamiasz z **katalogu głównego** repozytorium.

| Komenda | Opis |
|---------|------|
| `pnpm setup` | Tworzy `.env` z `.env.example` |
| `pnpm dev` | Dev: hot reload (API + web) |
| `pnpm start` | Prod: build + start serwerów |
| `pnpm build` | Build wszystkich aplikacji |
| `pnpm lint:fix` | Lint z auto-fix |
| `pnpm check-types` | Sprawdzenie typów TypeScript |
| `pnpm format` | Formatowanie Prettier |
| `pnpm docker:up` | Start PostgreSQL |
| `pnpm docker:down` | Stop PostgreSQL |
| `pnpm docker:logs` | Logi bazy |
| `pnpm db:migrate` | Migracje tabel aplikacji bez resetowania danych |
| `pnpm db:seed` | Idempotentne wczytanie katalogu ROPS i fikcyjnych profili testera |

### Pojedyncza aplikacja

```bash
pnpm dev --filter=web
pnpm dev --filter=api
pnpm build --filter=web
```

---

## Zmienne środowiskowe

Skopiuj konfigurację jednym poleceniem:

```bash
pnpm setup
```

Plik `.env` jest w **rootcie** repozytoria. Turbo ładuje go automatycznie.

| Zmienna | Domyślnie | Gdzie używana |
|---------|-----------|---------------|
| `PORT` | `3000` | NestJS (`apps/api/src/main.ts`) |
| `WEB_PORT` | `4200` | Angular (`scripts/web-dev.mjs`) |
| `API_URL` | `http://localhost:3000` | Frontend → backend |
| `DATABASE_URL` | `postgresql://hackyeah:hackyeah@localhost:5432/hackyeah` | Prisma |
| `POSTGRES_*` | `hackyeah` / `5432` | Docker Compose |

---

## Baza danych

PostgreSQL startuje przez Docker Compose:

```bash
pnpm docker:up
```

Domyślne dane logowania:

- **user:** `hackyeah`
- **hasło:** `hackyeah`
- **baza:** `hackyeah`
- **port:** `5432`

API **wymaga działającej bazy** — przed `pnpm dev` lub `pnpm start` uruchom `pnpm docker:up`.

Po pierwszym `pnpm docker:up` (lub po zmianie schema):

```bash
pnpm db:migrate      # dev — tworzy i stosuje migracje
pnpm db:generate     # tylko regeneracja klienta
pnpm db:studio       # Prisma Studio (GUI)
```

Schema: `apps/api/prisma/schema.prisma` · config: `apps/api/prisma7.config.ts` · `DATABASE_URL` z root `.env`.

---

## Frontend (Angular)

- **Angular 19** + **Angular Material** (motyw `azure-blue`)
- Layout: header z nawigacją, wyszukiwarką, powiadomieniami i menu użytkownika
- Linki nawigacji: `apps/web/src/app/core/constants/app.constants.ts`

Nowy komponent Material:

```bash
cd apps/web
pnpm ng generate @angular/material:card moj-komponent
```

---

## Backend (NestJS)

- **NestJS 12** + **Prisma 7** + **PostgreSQL**
- Schema: `apps/api/prisma/schema.prisma`, config: `apps/api/prisma7.config.ts`
- Migracje: `pnpm db:migrate`
- Domyślny endpoint: `GET http://localhost:3000/` → `Hello World!`

---

## Dev vs Start

| | `pnpm dev` | `pnpm start` |
|---|-----------|--------------|
| **Cel** | Codzienna praca | Test wersji produkcyjnej |
| **Frontend** | `ng serve` (hot reload) | Serwuje zbudowany `dist/` |
| **Backend** | `nest start --watch` | `node dist/main.js` |
| **Build** | Nie | Tak, automatycznie |

Nie uruchamiaj `dev` i `start` jednocześnie — oba używają portów **3000** i **4200**.

---

## Rozwiązywanie problemów

### Port zajęty (`EADDRINUSE`)

Zatrzymaj poprzedni proces (**Ctrl+C**) albo:

**Windows (PowerShell):**

```powershell
netstat -ano | findstr ":3000"
Stop-Process -Id <PID> -Force
```

**macOS / Linux:**

```bash
lsof -i :3000
kill <PID>
```

### API nie łączy się z bazą

1. Sprawdź, czy Docker działa: `pnpm docker:up`
2. Sprawdź, czy istnieje `.env`: `pnpm setup`
3. Logi bazy: `pnpm docker:logs`

### `pnpm` nie znaleziony

```bash
corepack enable
corepack prepare pnpm@11.25.0 --activate
```

---

## Dla nowych osób w zespole

1. Sklonuj repozytorium
2. Zainstaluj Node ≥ 22, pnpm, Docker
3. `pnpm install`
4. `pnpm setup`
5. `pnpm docker:up`
6. `pnpm db:migrate` i opcjonalnie `pnpm db:seed`
7. `pnpm dev`
8. Otwórz http://localhost:4200

## Tester innowacji

Zakładka `/tester-innowacji` udostępnia wyszukiwanie testerów przez AI, tworzenie i edycję własnego profilu oraz zapisywanie przypisań osób do testów w PostgreSQL. Wymagania, model dostępu i API opisano w [dokumentacji funkcji](docs/TESTER-INNOWACJI.md).

Przed pierwszym użyciem uruchom `pnpm db:migrate` i opcjonalnie `pnpm db:seed`, aby dodać fikcyjne profile demonstracyjne do bazy. Ponowne seedowanie nie duplikuje danych. AI korzysta z `OPENROUTER_API_KEY` i `OPENROUTER_MODEL` w `.env`.

## Testy

Szczegóły: [`docs/TESTING.md`](docs/TESTING.md)

```bash
pnpm test          # unit
pnpm test:e2e      # API E2E
```

## Reguły AI

Szczegóły dla agentów i zespołu: [`ai-rules/README.md`](ai-rules/README.md)  
Szybki kontekst: [`ai-rules/CONTEXT.md`](ai-rules/CONTEXT.md)

Stack w regułach: **NestJS + Angular** (bez React/Next).

Powodzenia na hackathonie!
