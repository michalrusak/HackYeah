# Demo aplikacji

Poniższe kroki przygotowują i sprawdzają aplikację. Nie wykonują deploymentu.

## Przygotowanie lokalne

```sh
pnpm setup
pnpm docker:up
pnpm db:migrate
pnpm db:seed
pnpm build
pnpm start
```

`db:seed` dodaje katalog ROPS, 210 fikcyjnych testerów, 6 opublikowanych pomysłów
i 2 przykładowe nabory. Jest idempotentny: nie usuwa ani nie nadpisuje istniejących
wpisów. Nie tworzy kont demo i nie publikuje zgłoszeń użytkowników — konta demo
przygotowuje tryb demo opisany niżej.
Istniejące pomysły oczekujące na moderację nadal wymagają decyzji administratora.

Przykładowy otwarty nabór kończy się 21 dni po pierwszym seedowaniu.
Ponowny seed nie przesuwa tego terminu. Przed późniejszą prezentacją sprawdź
datę naboru; nie zmieniaj dat rzeczywistych konkursów w celu prezentacji.

## Tryb demo: gotowe dane logowania

Tryb demo jest domyślnie włączony; wyłącza go `DEMO_MODE=false` w środowisku
API. Bez `DEMO_ADMIN_PASSWORD` i `DEMO_ACCOUNT_PASSWORD` niczego nie tworzy
ani nie podaje. Przy starcie API:

- tworzy (lub przywraca) konta `demo-tester`, `demo-organizator` i `demo-ekspert`
  ze wspólnym hasłem `DEMO_ACCOUNT_PASSWORD`; konto eksperta dostaje rolę
  eksperta we wszystkich dziedzinach,
- dodaje brakujące fikcyjne treści: profil testera, otwarte ogłoszenie testu
  z jednym oczekującym zgłoszeniem, prośbę o mentora w skrzynce ROPS i eksperta
  oraz pomysł czekający na moderację. Istniejących wpisów nie nadpisuje,
- udostępnia dane logowania pod `GET /api/demo`. Frontend uzupełnia nimi hasło
  w panelu administratora, okno logowania (z wyborem konta) i formularz
  nadawania roli eksperta, dodając informację, że to dane na potrzeby demo.

| Zmienna | Znaczenie |
|---------|-----------|
| `DEMO_MODE` | `false` wyłącza tryb demo; brak zmiennej lub inna wartość zostawia go włączonym |
| `DEMO_ADMIN_PASSWORD` | jawne hasło administratora; musi pasować do `KNOWLEDGE_ADMIN_PASSWORD_HASH` |
| `DEMO_ACCOUNT_PASSWORD` | hasło trzech kont demo, 12–128 znaków |

`pnpm setup` kopiuje z `.env.example` włączony tryb demo i hasło kont demo.
`node scripts/knowledge-admin.mjs` ustawia hasło administratora i wpisuje je
do `DEMO_ADMIN_PASSWORD` w `.env` (z `--rotate` zmienia istniejące). Jeśli hasło nie
pasuje do hasha albo hasło kont jest za krótkie, API zapisuje błąd w logu
i nie podaje tych danych w formularzu.

**Uwaga:** w trybie demo hasło administratora i hasła kont demo są publiczne —
każdy, kto zna adres, może moderować treści. Po zakończeniu oceny ustaw
`DEMO_MODE=false`, zmień hasło administratora (`--rotate`) i uruchom API ponownie.

Gdzie używa się tych danych:

| Miejsce | Dane |
|---------|------|
| „Administrator” (`/zasobnik/admin`) | hasło uzupełnione, wystarczy „Zaloguj się” |
| „Administrator” → „Eksperci” | formularz roli eksperta uzupełniony kontem `demo-organizator` |
| „Panel eksperta” (`/ekspert`) | formularz logowania na stronie, uzupełniony kontem `demo-ekspert`; w panelu jest „Wyloguj się” |
| „Tester innowacji”, „Kontakt z ROPS” | okno logowania z kontem `demo-tester`; `demo-organizator` jest właścicielem ogłoszenia testu |

Klucz `OPENROUTER_API_KEY` i wybrany model muszą działać na backendzie.
Bez SMTP powiadomienia pozostają w aplikacji; nie są wysyłane e-maile.
Nie używaj prawdziwych danych osobowych w scenariuszach demo.

## Kontrola przed przekazaniem linku

```sh
pnpm demo:check
node scripts/matchmaking-demo.mjs
pnpm test:db
pnpm --filter web test
```

`demo:check` sprawdza bezpośrednie wejścia na strony, publiczny adres API,
CORS przy oddzielnym API, połączenie z PostgreSQL, niepuste katalogi i otwarty nabór.
Sprawdza też tryb demo: loguje się hasłem administratora i każdym kontem demo
dokładnie tak, jak zrobi to formularz. Poza tymi sesjami logowania nie wykonuje
zapisów, nie wywołuje AI i nie zastępuje kontroli interfejsu.
Można sprawdzić wskazany adres: `pnpm demo:check https://adres-demo.example`.

`matchmaking-demo.mjs` wykonuje 5 rzeczywistych zapytań do AI i zużywa tokeny
OpenRouter. Korzysta z `API_URL` z otoczenia procesu lub `.env`.
Sprawdza seniorów, migrantów, powrót ucznia do szkoły, kompetencje cyfrowe oraz
nieprecyzyjny opis wymagający doprecyzowania.

`test:db` uruchamia wszystkie testy integracyjne API, także testy kont i testerów.
Używa lokalnej bazy `hackyeah_knowledge_test` i oddzielnych schematów testowych.
To baza wyłącznie testowa — zestawy testów czyszczą jej dane.
Na Windows bez Chrome można ustawić `CHROME_BIN` na zainstalowany `msedge.exe`
przed uruchomieniem testów Angulara.

## Scenariusz do przejścia w czystej sesji przeglądarki

1. Matchmaking: wybierz przykład wsparcia seniorów, wyślij opis, sprawdź wyniki
   oraz linki do zasobów. Sprawdź również krótki, nieprecyzyjny opis i doprecyzowanie.
2. Zasobnik: otwórz temat, przefiltruj wyniki i przejdź do źródła materiału.
3. Pomysły: obejrzyj opublikowaną dobrą praktykę, skopiuj ją jako własną adaptację.
   Sprawdź uproszczenie języka szkicu, Canvę i rozmowę z asystentem.
4. Nowy pomysł: rozwiń opis przez AI, zapisz szkic, odśwież stronę i wróć
   do niego przez „Moje pomysły”. Wysłanie do ROPS kieruje go do moderacji;
   nie oznacza natychmiastowej publikacji.
5. Otwarty nabór: z własnego pomysłu utwórz wniosek, uzupełnij sekcje, zapisz
   i wyeksportuj. Sprawdź komunikat przy próbie wysłania niepełnego wniosku.
6. Tester: zaloguj się kontem `demo-tester` (albo zarejestruj własne), otwórz
   profil, wyloguj się i zaloguj ponownie. Sprawdź wyszukiwanie testerów
   i utworzenie ogłoszenia.
7. Ogłoszenie testu: konto `demo-tester` ma już zgłoszenie do ogłoszenia konta
   `demo-organizator`. Jako organizator przyjmij zgłoszenie; jako tester dodaj opinię.
8. Administrator: zaloguj się uzupełnionym hasłem. Opublikuj lub odeślij do
   poprawy pomysł czekający na moderację, odpowiedz na wiadomość w skrzynce,
   sprawdź zasoby, ekspertów i trendy potrzeb.
9. Ekspert: zaloguj się kontem `demo-ekspert`, przejmij sprawę z kolejki,
   odpowiedz i dodaj opinię do pomysłu.
10. Powtórz wejście z bezpośredniego linku do pomysłu, odświeżenie strony i
    podstawową nawigację na telefonie oraz samą klawiaturą.

„Moje pomysły” i uprawnienia do szkiców są zapisywane w lokalnej pamięci
przeglądarki. Konto testera nie przenosi pomysłów między urządzeniami.
Historia asystenta jest prywatna dla autora; osoba oglądająca opublikowany
pomysł prowadzi rozmowę bez dostępu do historii autora.

## Konfiguracja przyszłego publicznego adresu

- `WEB_ORIGIN`: dokładny adres frontendu, np. `https://demo.example.org`.
- `WEB_API_URL`: adres API widziany przez przeglądarkę, z prefiksem `/api`.
  Może być `/api`, jeżeli serwer pod tym samym adresem przekazuje żądania do API.
  Sam `scripts/web-serve.mjs` jest serwerem plików i nie zapewnia takiego proxy.
- `API_URL`: adres backendu używany m.in. przez skrypty kontrolne.
- Dla HTTPS ustaw `NODE_ENV=production`, aby ciasteczka sesji miały flagę Secure.
- Frontend i API powinny należeć do tej samej witryny (np. poddomeny tej samej
  domeny). Obecne ciasteczka SameSite nie obsługują sesji między niezależnymi
  domenami. Po ustaleniu adresów obowiązkowo sprawdź logowanie w przeglądarce.
- Nie umieszczaj klucza OpenRouter, hasła bazy ani hasła administratora
  w `api-config.json` ani w konfiguracji frontendu. Dane logowania demo podaje
  wyłącznie API (`DEMO_*` w jego środowisku).
- Zmienne `DEMO_*` ustaw w środowisku API razem z `KNOWLEDGE_ADMIN_PASSWORD_HASH`.
  Przy starcie przez `pnpm start` Turbo przekazuje je do API (`passThroughEnv`).
  W Dockerze (`docs/DEPLOY.md`) wpisz je do `.env` obok pozostałych zmiennych —
  `docker-compose.prod.yml` przekazuje je do kontenera API.

Do ustalenia z zespołem: ostateczny scenariusz prezentacji oraz czas dostępności
demonstracyjnego naboru.
