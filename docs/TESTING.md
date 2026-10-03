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

`apps/api/test/testers.e2e-spec.ts`, `auth.e2e-spec.ts`, `tester-projects.e2e-spec.ts`
i `testers-seed.e2e-spec.ts` korzystają z rzeczywistego PostgreSQL, repozytoriów
Prisma i produkcyjnych migracji SQL. Testy API uruchamiają pełne moduły NestJS.
Zastąpiony jest jedynie transport HTTP do modelu
AI, dzięki czemu testy są deterministyczne i nie zużywają płatnych tokenów.
Bez `TEST_DATABASE_URL` ten zestaw jest pomijany; pozostałe E2E nadal działają.

Wymagania: uruchomiony PostgreSQL, Node.js 22 lub nowszy obsługiwany przez projekt
oraz zbudowane kontrakty: `pnpm --filter @repo/api-contracts build`.
Po zmianie modeli wygeneruj klienta: `pnpm --filter api db:generate`.
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
i wykonuje pliki SQL z `apps/api/prisma/migrations`. Klient Prisma z adapterem
PostgreSQL używa wyłącznie tego schematu. Możliwe jest wskazanie istniejącej
bazy: tabele aplikacji w `public` nie są używane ani czyszczone. Po testach usuwane
są wyłącznie rekordy utworzone w danym przebiegu. Schemat i tabele pozostają;
testy nie wykonują `DROP`, `TRUNCATE` ani resetu bazy.

Zakres: walidacja formularza, tworzenie oraz edycja profilu, izolacja
kont właścicieli, ukrywanie danych uwierzytelniania w API i danych AI, wyszukiwanie wyłącznie
aktywnych profili, odrzucanie nieistniejących / nieaktywnych / powtórzonych ID
modelu, unieważnianie wyników po edycji profilu (także
podczas trwającego zapytania AI), kontrola przypisań oraz ich trwałość po
restarcie aplikacji.

Konta: rejestracja, hashowanie hasła i tokenu sesji, błędne logowanie, wylogowanie,
wygaśnięcie sesji, sprawdzanie Origin, izolacja profili i historii, powiązanie
dotychczasowego profilu z kontem oraz odrzucanie późniejszych prób dostępu starym kluczem.

Ogłoszenia: izolacja kont organizatora i uczestnika, prywatność listy zgłoszeń,
przyjęcie/odrzucenie oczekującego zgłoszenia, wycofanie i ponowienie udziału,
zamknięcie naboru, jedna edytowalna opinia na uczestnika i poprawna średnia ocen.
Test współbieżności sprawdza zamknięcie naboru podczas zgłoszenia i równoległe
ponowienia żądania, także z inną wielkością liter w UUID.

Dane przykładowe: walidacja 210 profili oraz ponowny seed bez duplikatów,
nadpisania istniejących profili ani tworzenia fikcyjnych kont. Katalog i wyszukiwanie
mają regresje obejmujące dalsze strony danych oraz zapytanie jednowyrazowe.

## Web — unit (`apps/web`)

- Runner: **Karma + Jasmine** (domyślnie Angular CLI)
- Headless: `pnpm --filter web test`

```bash
pnpm --filter web test
pnpm --filter web test:watch   # watch mode
```

### Odbiór kont Testera i dostępności

Sprawdź w przeglądarce następujący przebieg z tymczasowym kontem:

1. „Dołącz jako tester” → rejestracja → zapis profilu w PostgreSQL.
2. Wylogowanie → logowanie w nowej sesji przeglądarki → edycja tego samego profilu.
3. Brak checkboxa zgody oraz przełącznika udostępniania w formularzu.
4. Obsługa samą klawiaturą: pominięcie nawigacji, zmiana strony, otwieranie okien,
   fokus na błędnym polu, zamknięcie przez Escape i powrót fokusu.
5. Przechodzenie klawiaturą między zakładkami Testera i odświeżenie własnej
   aktywności po powrocie do zakładki.
6. Katalog, logowanie, rejestracja, profil i ogłoszenia w dostępnych motywach,
   przy szerokości 320 px i zwiększonych odstępach tekstu. Sprawdź także samą
   powierzchnię okna dialogowego: brak przewijania poziomego strony nie wyklucza
   przycięcia jego zawartości.
7. Wyszukanie wymagania bez dopasowania → ogłoszenie z przeniesionym wymaganiem
   → publikacja. Sprawdź zachowanie formularza po logowaniu oraz jego anulowaniu.
8. Drugie konto → zgłoszenie udziału → utworzenie brakującego profilu → przyjęcie
   przez organizatora → ocena, opinia i usprawnienie → edycja tej samej opinii.
9. Zamknięcie naboru blokuje nowe zgłoszenia, zachowuje opinie i pozwala uczestnikowi
   poprawić własną ocenę. Wylogowanie usuwa z widoku prywatną aktywność.

Do kontroli automatycznej użyj axe-core z regułami `wcag2a`, `wcag2aa`,
`wcag21a`, `wcag21aa` po zakończeniu animacji interfejsu. Dla odstępów tekstu
sprawdź interlinię 1,5, odstęp po akapicie 2 em, między literami 0,12 em
i między słowami 0,16 em. Kontrolę automatyczną uzupełnij wizualną oraz próbą
z czytnikiem ekranu i użytkownikami docelowymi; sam wynik axe nie potwierdza
pełnej zgodności z WCAG 2.1 AA.

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
