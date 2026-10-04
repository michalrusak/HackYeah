# Wdrożenie produkcyjne (Docker)

Instrukcja uruchomienia pełnego stacku: **PostgreSQL + NestJS API + Angular (nginx)**.

---

## Wymagania

| Narzędzie | Wersja |
|-----------|--------|
| Docker | 24+ z Compose V2 |
| pnpm | 11.x (opcjonalnie — tylko do skryptów npm) |

Na serwerze produkcyjnym **nie trzeba** Node.js ani pnpm — wszystko buduje się w obrazach Docker.

---

## Szybki start (lokalny test produkcji)

```bash
# 1. Konfiguracja środowiska
cp .env.production.example .env
# Edytuj .env — minimum: POSTGRES_PASSWORD, DOCKER_WEB_ORIGIN

# 2. Build i start
pnpm docker:prod:up

# 3. Dane demonstracyjne (opcjonalnie)
pnpm docker:prod:seed
```

| Adres | Opis |
|-------|------|
| http://localhost:8080 | Aplikacja (frontend) |
| http://localhost:8080/api/health | Health check API + baza |

Komendy:

```bash
pnpm docker:prod:logs    # logi wszystkich serwisów
pnpm docker:prod:down    # zatrzymanie
```

---

## Architektura

```
Przeglądarka
    │
    ▼
nginx (kontener web, port DOCKER_WEB_PORT)
    ├── /*           → Angular SPA (statyczne pliki)
    ├── /api/*       → proxy → NestJS (kontener api:3000)
    └── /api-config.json  → adres API dla frontendu (generowany przy starcie)
         │
         ▼
    PostgreSQL (kontener postgres)
```

**Domyślny tryb (zalecany):** frontend i API pod **jednym originem** — nginx proxy'uje `/api`. Przeglądarka nie wykonuje cross-origin requestów, ale CORS i `WEB_ORIGIN` są skonfigurowane na wypadek żądań z nagłówkiem `Origin` (logowanie, sesje).

---

## Zmienne środowiskowe

Plik `.env` w katalogu głównym repozytorium jest automatycznie ładowany przez `docker compose`.

Szablon: [`.env.production.example`](../.env.production.example)

### Kluczowe dla połączenia FE ↔ API

| Zmienna | Domyślnie | Opis |
|---------|-----------|------|
| `DOCKER_WEB_ORIGIN` | `http://localhost:8080` | Publiczny origin frontendu. Używany przez API do **CORS**, walidacji `Origin` (auth) i linków w mailach. Musi dokładnie odpowiadać adresowi w przeglądarce. |
| `DOCKER_WEB_PORT` | `8080` | Port hosta mapowany na nginx (kontener web). |
| `WEB_API_URL` | `/api` | Adres API zapisywany do `api-config.json` przy starcie kontenera web. Frontend ładuje go przez `ApiConfigService`. |
| `COOKIE_SECURE` | `false` | `true` gdy aplikacja działa za **HTTPS** (wymagane dla cookies sesji). |
| `TRUST_PROXY` | `true` | NestJS ufaj nagłówkom `X-Forwarded-*` z nginx. |
| `TRUST_PROXY_HOPS` | `1` | Liczba warstw reverse proxy przed API. |

### Baza i sekrety

| Zmienna | Opis |
|---------|------|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Dane PostgreSQL |
| `OPENROUTER_API_KEY` | Klucz AI (matchmaking, tester, kreator) |
| `KNOWLEDGE_ADMIN_PASSWORD_HASH` | Hash hasła panelu Zasobnika |
| `SMTP_URL`, `MAIL_FROM`, `ROPS_NOTIFY_EMAIL` | Powiadomienia e-mail (opcjonalnie) |

`DATABASE_URL` jest **ustawiany automatycznie** w `docker-compose.prod.yml` — nie trzeba go podawać ręcznie.

---

## Tryby wdrożenia

### A. Jeden host / jedna domena (zalecane)

Przykład: `https://lacznik.example.pl`

```env
DOCKER_WEB_ORIGIN=https://lacznik.example.pl
DOCKER_WEB_PORT=8080
WEB_API_URL=/api
COOKIE_SECURE=true
```

- nginx serwuje frontend i proxy'uje `/api` do NestJS
- Frontend woła API pod tym samym originem (`/api/...`)
- CORS: `WEB_ORIGIN` = `https://lacznik.example.pl`
- Przed kontenerem może stać Traefik/Caddy z TLS — wtedy `TRUST_PROXY=true`

### B. Rozdzielone domeny (frontend ≠ API)

Przykład: frontend `https://app.example.pl`, API `https://api.example.pl`

```env
DOCKER_WEB_ORIGIN=https://app.example.pl
WEB_API_URL=https://api.example.pl/api
COOKIE_SECURE=true
```

- Frontend ładuje `api-config.json` z pełnym URL API
- API musi zezwolić na CORS z `https://app.example.pl` (`WEB_ORIGIN`)
- Cookies sesji są ustawiane na domenie API — żądania `withCredentials` z frontendu do `api.example.pl` działają poprawnie
- W tym trybie **nie musisz** proxy'ować `/api` przez nginx frontendu (możesz zostawić — nie koliduje)

### C. Wiele originów (staging + prod)

```env
WEB_ORIGIN=https://app.example.pl,https://staging.example.pl
```

W Dockerze ustaw `DOCKER_WEB_ORIGIN` na tę samą wartość (zmienna przekazywana do API jako `WEB_ORIGIN`).

---

## Wdrożenie na serwerze

### 1. Przygotowanie

```bash
git clone <repo-url> hackyeah
cd hackyeah
cp .env.production.example .env
nano .env   # uzupełnij hasła i domeny
```

### 2. Start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Przy pierwszym starcie API automatycznie uruchamia `prisma migrate deploy`.

### 3. Seed (opcjonalnie)

```bash
docker compose -f docker-compose.prod.yml exec api node prisma/seed.mjs
# lub: pnpm docker:prod:seed
```

### 4. Reverse proxy z TLS (Caddy / nginx / Traefik)

Typowa konfiguracja: reverse proxy na hoście przekierowuje `https://twoja-domena.pl` → `localhost:8080` (kontener web).

Ustaw w `.env`:

```env
DOCKER_WEB_ORIGIN=https://twoja-domena.pl
COOKIE_SECURE=true
```

### 5. Aktualizacja wersji

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Migracje bazy uruchamiają się przy restarcie kontenera API.

---

## Weryfikacja po wdrożeniu

```bash
# Health API (przez nginx)
curl -s https://twoja-domena.pl/api/health | jq

# Konfiguracja frontendu
curl -s https://twoja-domena.pl/api-config.json

# Oczekiwane:
# {"apiUrl":"/api"}                          — tryb A (proxy)
# {"apiUrl":"https://api.example.pl/api"}    — tryb B (rozdzielony)
```

W przeglądarce: otwórz aplikację, sprawdź logowanie (tester innowacji) — sesja wymaga poprawnego `WEB_ORIGIN` i `COOKIE_SECURE`.

---

## Rozwiązywanie problemów

### Frontend nie łączy się z API

1. Sprawdź `api-config.json` w przeglądarce (`/api-config.json`)
2. Sprawdź `/api/health` — czy zwraca `database: "up"`
3. W DevTools → Network: czy requesty idą na poprawny URL

### Błąd CORS lub „Żądanie musi pochodzić z aplikacji”

- `DOCKER_WEB_ORIGIN` musi **dokładnie** zgadzać się z originem w pasku adresu (np. `https://app.pl`, nie `https://app.pl/`).
- Za HTTPS ustaw `COOKIE_SECURE=true`.
- Przy wielu domenach użyj listy rozdzielonej przecinkami.

### Sesja / logowanie nie działa po HTTPS

- `COOKIE_SECURE=true` w `.env`
- Sprawdź, czy reverse proxy przekazuje `X-Forwarded-Proto: https`

### API unhealthy / migracje

```bash
docker compose -f docker-compose.prod.yml logs api
```

Typowe przyczyny: PostgreSQL jeszcze nie gotowy, złe `POSTGRES_PASSWORD`, brak migracji.

### Port 8080 zajęty / dostęp tylko przez VPN

W produkcji Docker **na zewnątrz wystawia tylko frontend** (nginx). API i PostgreSQL są wewnątrz sieci Docker — nie trzeba ich mapować na host.

Zmień w `.env` **dwa** pola (port + origin muszą się zgadzać):

```env
DOCKER_WEB_PORT=9000
DOCKER_WEB_ORIGIN=http://10.8.0.5:9000
WEB_API_URL=/api
COOKIE_SECURE=false
```

- `DOCKER_WEB_PORT` — port na serwerze (ten, który przepuszcza VPN/firewall)
- `DOCKER_WEB_ORIGIN` — dokładny adres, który wpisujesz w przeglądarce (IP VPN serwera + port)
- `WEB_API_URL=/api` — zostaw tak, nginx proxy'uje API pod tym samym adresem

Restart po zmianie:

```bash
docker compose -f docker-compose.prod.yml up -d
```

Test z komputera w VPN:

```bash
curl http://10.8.0.5:9000/api/health
```

Opcjonalnie — nasłuch tylko na interfejsie VPN (np. `10.8.0.5`), w `docker-compose.prod.yml` zamień linię portów web na:

```yaml
ports:
  - "10.8.0.5:9000:80"
```

(wtedy `DOCKER_WEB_PORT` w `.env` nie steruje mapowaniem — port wpisujesz w compose)

Firewall Ubuntu (jeśli VPN nie przepuszcza sam):

```bash
sudo ufw allow 9000/tcp
```

---

## Pliki infrastruktury

| Plik | Opis |
|------|------|
| `docker-compose.prod.yml` | Stack produkcyjny |
| `docker-compose.yml` | Tylko PostgreSQL (development) |
| `apps/api/Dockerfile` | Obraz NestJS + Prisma |
| `apps/web/Dockerfile` | Obraz Angular + nginx |
| `apps/web/nginx.conf` | Proxy `/api`, SPA fallback |
| `apps/web/docker-entrypoint.d/99-api-config.sh` | Generuje `api-config.json` z `WEB_API_URL` |

---

## Development vs produkcja

| | Development | Produkcja (Docker) |
|---|-------------|-------------------|
| Start | `pnpm docker:up` + `pnpm dev` | `pnpm docker:prod:up` |
| Frontend | `ng serve` :4200 | nginx :8080 |
| API | Nest watch :3000 | `node dist/main.js` w kontenerze |
| Proxy API | `proxy.conf.mjs` | nginx `location /api/` |
| Konfiguracja API URL | `API_URL` w `.env` | `WEB_API_URL` → `api-config.json` |
