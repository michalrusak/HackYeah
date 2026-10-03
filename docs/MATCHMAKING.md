# Matchmaking społeczny

MVP: opis problemu → interpretacja potrzeb przez Qwen → ranking maksymalnie pięciu innowacji ROPS. Strona: `/matchmaking`. Endpoint zgodny z aktualnym prefiksem projektu: `POST /api/matchmaking`.

## Uruchomienie

1. Zainstaluj zależności (`pnpm install`) i zbuduj kontrakty: `pnpm --filter @repo/api-contracts build`.
2. Uruchom `pnpm setup`. W root `.env` dodaj `OPENROUTER_API_KEY` oraz `OPENROUTER_MODEL=qwen/qwen3.8-27b`.
3. Uruchom bazę (`pnpm docker:up`) oraz aplikacje (`pnpm dev`). Otwórz `http://localhost:4200/matchmaking`.

Jeśli system blokuje binarny plik Turbo, po zbudowaniu kontraktów uruchom w dwóch terminalach `pnpm --filter api dev` i `pnpm --filter web dev`. Te komendy omijają Turbo. Zmienne OpenRouter oraz publiczne adresy są też przekazywane przez zadania `dev` i `start` Turbo, gdy konfigurację ustawiono w środowisku zamiast w `.env`.

Klucz jest odczytywany wyłącznie w API. Jedno wyszukiwanie wykonuje jedno żądanie OpenRouter z JSON Schema, bez streamingu i bez ponowień. Timeout obejmuje żądanie oraz odczyt odpowiedzi i wynosi 30 sekund. Błędne lub nieznane tagi są odrzucane. Nie ma Control Layer.

## Dane i ranking

Katalog: `apps/api/src/modules/matchmaking/catalog.v1.json`. Zawiera 15 rzeczywistych innowacji, krótkie autorskie podsumowania, źródła i datę weryfikacji. Opisy i adresy sprawdzono w indeksowanych treściach oficjalnych stron ROPS 3 października 2026. Bezpośredni odczyt części stron zwracał HTTP 403; data nie oznacza potwierdzenia dostępności wszystkich materiałów do pobrania. Tagi są redakcyjną klasyfikacją projektu, nie oficjalną klasyfikacją ROPS.

Kategorie odbiorców odpowiadają dziewięciu kategoriom biblioteki ROPS. Osobnym wymiarem są obszary Mapy wyzwań społecznych. Słowniki i schematy są wspólne dla API i Angulara w `@repo/api-contracts`.

Każdy wymiar mierzy odsetek rozpoznanych tagów występujących w innowacji. Wagi: potrzeby 50, odbiorcy 30, obszary 20. Puste wymiary są wyłączane, a pozostałe wagi normalizowane. Powtarzające się tagi nie podnoszą punktacji. Kandydat musi mieć wspólną potrzebę. Sortowanie: wynik malejąco, następnie `id` rosnąco; limit pięciu wyników. Wynik jest zaokrąglany do dwóch miejsc; poziomy: wysokie ≥70, średnie ≥40, częściowe <40. Uzasadnienie wymienia wyłącznie wspólne tagi. Poziom nie jest oceną skuteczności ani potwierdzeniem możliwości wdrożenia.

AI nie otrzymuje katalogu innowacji i nie generuje nazw ani URL. Nie zapisujemy opisów i wyników do bazy ani logów aplikacji. Telemetria zawiera jedynie czas, status i liczbę tokenów. Treść opisu jest wysyłana do OpenRouter; użytkownik widzi tę informację przy formularzu.

## Kontrakt HTTP

Żądanie: `{ "description": "Opis problemu" }`, od 1 do 4000 znaków, bez dodatkowych pól. Opis jest przycinany z białych znaków po sprawdzeniu maksymalnej długości.

Sukces HTTP 200: `{ "success": true, "data": { "interpretation": { "summary", "audiences", "areas", "needs", "missingInformation" }, "matches": [...] } }`. Każdy wynik zawiera rekord katalogu, `score`, `level`, `matchedNeeds` i `explanation`. Pusta lista jest poprawną odpowiedzią, a UI proponuje uzupełnienie opisu.

Błędy mają envelope `{ "success": false, "error": { "code", "message" } }`: 400 `VALIDATION_ERROR`, 429 `RATE_LIMIT`, 502 `AI_INVALID_RESPONSE`, 503 `AI_NOT_CONFIGURED` / `AI_UNAVAILABLE`, 504 `AI_TIMEOUT`. UI tłumaczy kody na komunikaty i pozwala ponowić wyszukiwanie. Nie pokazuje odpowiedzi dostawcy ani klucza.

## Frontend i adres API

Development: proxy `/api` kieruje do `API_URL` (domyślnie `http://localhost:3000`). Produkcyjny `pnpm start` zapisuje tylko publiczny adres API do `dist/web/browser/api-config.json`; domyślnie `${API_URL}/api`, z możliwością nadpisania przez `WEB_API_URL` (pełny adres z prefiksem lub `/api` przy reverse proxy).

API dopuszcza CORS z `WEB_ORIGIN`, domyślnie `http://localhost:4200`. Dla innego hostingu ustaw origin frontendu. Przy hostingu statycznym bez skryptu `web-serve.mjs` ustaw `api-config.json` w artefakcie wdrożenia albo zapewnij reverse proxy `/api`. Nie umieszczaj klucza OpenRouter w tym pliku.

## Weryfikacja

```text
pnpm --filter @repo/api-contracts build
pnpm --filter api test
pnpm --filter api test:e2e
pnpm --filter web test
pnpm --filter api check-types
pnpm --filter web check-types
pnpm --filter api build
pnpm --filter web build
```

Testy automatyczne nie używają rzeczywistego modelu ani bazy: obejmują walidację, punktację i remisy, źródła, interpretację, timeout, błędy, wysłanie formularza i ponowienie.

Po uruchomieniu API ze skonfigurowanym OpenRouter wykonaj `node scripts/matchmaking-demo.mjs`. Skrypt wysyła dokładnie trzy przykłady z UI i sprawdza oczekiwane wyniki w pierwszej trójce: Senior CUDER, Health Guide PL, Bez presji z depresji. Te trzy wywołania korzystają z rzeczywistego API i mogą generować opłaty. Skrypt nie wypisuje opisów ani kluczy.
