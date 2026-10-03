# HackYeah
h
Monorepo na hackathon: **NestJS** (backend) + **Angular** (frontend) + **PostgreSQL**.

Komendy działają tak samo na **Windows (PowerShell)**, **macOS** i **Linux (bash)**.

---

## Wymagania

| Narzędzie | Wersja |
|-----------|--------|
| Node.js | ≥ 22 |
| pnpm | 11.x (zalecane: wersja z `package.json`) |
| Docker | do bazy PostgreSQL |

---

## Szybki start

```bash
pnpm install
pnpm setup        # tworzy .env z .env.example (tylko pierwszy raz)
pnpm docker:up    # uruchamia PostgreSQL
pnpm dev          # API + frontend w trybie developerskim
```

Po starcie:

| Serwis | URL |
|--------|-----|
| Frontend (Angular) | http://localhost:4200 |
| Backend (NestJS) | http://localhost:3000 |
| PostgreSQL | `localhost:5432` |

---

## Struktura projektu

```
HackYeah/
├── apps/
│   ├── api/          NestJS — REST API, TypeORM, PostgreSQL
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
| `DATABASE_URL` | `postgresql://hackyeah:hackyeah@localhost:5432/hackyeah` | TypeORM |
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

- **NestJS 12** + **TypeORM** + **PostgreSQL**
- Konfiguracja bazy: `apps/api/src/config/database.config.ts`
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
6. `pnpm dev`
7. Otwórz http://localhost:4200

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
