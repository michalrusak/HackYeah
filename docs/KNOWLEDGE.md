# Zasobnik wiedzy

Moduł Blisko prezentuje wybrane publiczne zasoby ROPS Kraków: wyzwania, raporty, innowacje i materiały edukacyjne. Zakres odpowiada modułowi II w `CRITERIA Wojewodztwo Malopolskie HUBMI.pdf`, wraz z administracją treścią i zestawieniami potrzeb. Dokument nie rozszerza zadania o kreator pomysłów, tester, granty, komunikację ani Control Layer.

## Korzystanie

Usprawnienia prezentacji (4 października 2026): trzy wejścia według celu (wyzwanie, rozwiązanie, nauka), skróty do sytuacji mieszkańca, rozwijane filtry oraz usuwanie pojedynczych aktywnych wyborów. Tematy są dostępne w rozwijanej sekcji przed wynikami. Karty innowacji pokazują od razu odbiorców, sposób działania i potrzeby; linki do tematów łączą rozwiązanie z danymi, raportami i edukacją. Filmy zachowują odtwarzanie na żądanie, a pozostałe zasoby mają ilustracje typograficzne z ikoną obszaru. Treść nadal pochodzi z API i jest edytowana w istniejącym panelu. Błąd opcjonalnych liczników tematów nie blokuje listy materiałów.

Audyt nowej ścieżki: `node scripts/knowledge-discovery-a11y.mjs`, z `QA_TOOLS_PATH`, `CHROME_BIN` jak w sekcji Weryfikacja oraz opcjonalnym `WEB_URL`. Publiczne odpowiedzi katalogu są atrapami na podstawie seeda: audyt nie zapisuje sygnałów potrzeb. Sprawdza skróty, filmy, usuwanie filtrów, odświeżenie adresu, błędy i ponowienie oraz wejście w temat klawiaturą; zapisuje zrzuty w `tmp/knowledge-discovery-qa/`.

- `/zasobnik`: osiem tematów, wyszukiwanie w nazwach i opisach, filtry rodzaju, odbiorców i zakresu danych, filtr „Tylko z filmem”, paginacja, źródła oraz daty weryfikacji. Karty innowacji pokazują potrzeby, na które odpowiadają, a zasoby z filmem mają wyróżnione wejście do strony ROPS z nagraniem.
- `/zasobnik/temat/:temat`: strona jednego tematu Mapy w układzie wyzwanie → kluczowe liczby → innowacje → raporty → materiały edukacyjne. Kafelki tematów na stronie głównej prowadzą do tego widoku.
- `/zasobnik/admin`: logowanie, edycja i publikacja, wycofanie do szkicu, import JSON i trendy dostępne wyłącznie po uwierzytelnieniu.
- `/matchmaking`: interpretacja AI i ranking bez zmiany wag. Produkcyjny backend używa opublikowanych innowacji z tej samej bazy; aktualizacja zasobu nie wymaga przebudowy. Szkice nie są rekomendowane. Przy pustym katalogu nie wymuszamy wyników.

Wyszukiwanie Zasobnika jest tekstowe, bez embeddings ani dodatkowych wywołań AI. Użytkownik może przejść do matchmakingu, jeśli chce opisać problem własnymi słowami. Samo przeglądanie tematów nie zapisuje potrzeb; wpisana fraza wyszukiwania jest zliczana w trendach (patrz „Potrzeby i trendy”).

## Katalog i źródła

Katalog początkowy `apps/api/src/modules/knowledge/resources.v1.json` zawiera 29 opracowań: 15 innowacji, 8 tematów Mapy Wyzwań, 3 raporty regionalne i 3 materiały edukacyjne. To wybór demonstracyjny, a nie całe portfolio ROPS. Opisy są własnymi krótkimi opracowaniami. Nie importujemy kontaktów osób ani danych wrażliwych z dokumentów.

Mapa Wyzwań wprost deklaruje dane **ogólnopolskie**. Jej rekordy są oznaczone „Polska”. Osobno oznaczamy „Małopolska” dla raportów regionalnych: usług społecznych, pieczy zastępczej i mieszkań wspomaganych. Nie tworzymy własnych wskaźników kondycji regionu bez źródłowych danych. Kluczowe liczby przy wyzwaniach (pole `facts`) są przepisane z Mapy Wyzwań i wyświetlane z zakresem danych „Polska” oraz nazwą źródła; temat „Integracja cudzoziemców” nie ma liczb, bo Mapa ich nie podaje. Materiały ogólne i innowacje nie są przedstawiane jako statystyki regionalne.

Źródła: [raporty ROPS](https://rops.krakow.pl/badania-analizy-raporty/raporty-z-badan), [biblioteka innowacji](https://rops.krakow.pl/innowacje-spoleczne/biblioteka-innowacji-spolecznych/kategorie), [publikacje](https://rops.krakow.pl/innowacje-spoleczne/publikacje-ze-swiata-innowacji), [Przewodnik](https://rops.krakow.pl/aktualnosci/przewodnik-po-innowacjach-spolecznych), [Połącz kropki](https://rops.krakow.pl/pliki-do-pobrania/wpis%2Cpolacz-kropki-publikacja-o-wlaczeniu-spolecznym%2C691), [ABC Diagnozy](https://rops.krakow.pl/aktualnosci/abc-diagnozy-badanie-podazy-i-popytu-na-uslugi-spoleczne-w-gminie-przewodnik-praktyczny). Strona modułu udostępnia także wejście do [Obserwatora](https://obserwator.rops.krakow.pl/).

Weryfikacja 3 października 2026 korzystała z przekazanej Mapy i oficjalnych stron dostępnych w indeksie wyszukiwarki. Bezpośredni odczyt serwisów ROPS zwracał 403; data oznacza sprawdzenie opisu i przypisania źródła, nie gwarancję dostępności każdego pliku. Nie deklarujemy pobrania danych z niedostępnego Obserwatora. Sześć innowacji z katalogu (Senior CUDER, Merkury, BaWita, Rodzina adopcyjna dorasta, Głuchy czytelnik w bibliotece, Innotextil) ma film z kanału ROPS Kraków na YouTube, podlinkowany na stronie innowacji w Bibliotece; adresy odczytano z tych stron 3 października 2026 i potwierdzono w YouTube. Film jest osadzony na karcie zasobu (pole `videoUrl`, tylko adresy YouTube): najpierw widać miniaturę z przyciskiem „Odtwórz film”, a odtwarzacz `youtube-nocookie.com` wczytuje się dopiero po kliknięciu. Miniatury pobierane są z serwera YouTube przy wyświetleniu karty. Administrator dodaje film w edytorze zasobu. Jedyne grafiki na stronach innowacji ROPS to kody QR, dlatego nie importujemy stamtąd ilustracji. Dostępność filmów, napisów i załączników zależy od ROPS.

## Uruchomienie

Projekt używa istniejącego PostgreSQL i Prisma 7. Pierwsza konfiguracja:

```text
pnpm install
pnpm setup
docker compose up -d postgres
pnpm --filter api exec prisma migrate deploy --config prisma7.config.ts
pnpm --filter @repo/api-contracts build
pnpm --filter api build
pnpm --filter api knowledge:seed
node scripts/knowledge-admin.mjs
pnpm dev
```

Seed jest idempotentny: dodaje brakujące wpisy i uzupełnia kluczowe liczby tylko w wpisach, których administrator jeszcze nie edytował (wersja 1, bez liczb); nie nadpisuje edycji administratora. Nie wykonuje DROP ani resetu bazy. Gdy pnpm nie jest w PATH, można użyć `npx --yes pnpm@11.25.0` zamiast `pnpm`. Przy blokadzie binarki Turbo przez Windows działają bezpośrednie polecenia: `node dist/main.js` w `apps/api` oraz `node scripts/web-dev.mjs` w katalogu głównym. API uruchamiaj w zwykłym trybie z bazą, nie z `NODE_ENV=test`; ten tryb służy izolowanym testom i pomija Zasobnik w głównym AppModule.

Skrypt administratora zapisuje wyłącznie hash scrypt w `.env`. Wygenerowane lokalne hasło znajduje się w ignorowanym przez Git `tmp/knowledge-admin.txt`. Skrypt nie wypisuje hasła. Po konfiguracji uruchom ponownie API. `node scripts/knowledge-admin.mjs --rotate` zmienia hasło; restart API unieważnia poprzednie sesje przez zmianę wersji poświadczeń. Nie publikuj lokalnego pliku z hasłem. W produkcji skonfiguruj hash przez sekret środowiska i HTTPS.

## Aktualizacja treści

Administrator uzupełnia nazwę, opis, rodzaj, zakres, obszary, odbiorców, potrzeby, źródło, datę weryfikacji, opcjonalny rok, stronę z filmem i do 6 kluczowych liczb (jedna w wierszu: `wartość | opis`). Adresy muszą używać HTTPS i wskazywać ROPS lub Obserwatora, bez poświadczeń w URL; innowacje wymagają głównej domeny ROPS. Dla innowacji odbiorcy i potrzeby są obowiązkowe. Przed publikacją administrator sprawdza fakty i działanie źródła. Teksty są renderowane jako zwykły tekst, bez HTML.

Panel (`/zasobnik/admin`, zakładka Zasoby) zaczyna się od czterech liczników, które są zarazem filtrami listy: wszystkie zasoby, szkice do weryfikacji, opublikowane i do ponownego sprawdzenia (data sprawdzenia źródła starsza niż 180 dni, stała `STALE_DAYS`). Każda karta pokazuje stan, datę sprawdzenia, wersję z datą ostatniej zmiany i link do źródła. Szybkie akcje bez otwierania edytora: „Zweryfikuj i opublikuj” (szkic → opublikowany z dzisiejszą datą sprawdzenia), „Potwierdź aktualność” (dzisiejsza data sprawdzenia) i „Wycofaj do szkicu”. Korzystają z tej samej kontroli wersji co edytor (409 przy konflikcie). Liczniki zwraca `GET /api/knowledge/admin/summary`; filtry `status` i `stale=1` działają tylko w API administratora.

Szkic jest prywatny. Zmiana na „Opublikowany” udostępnia rekord natychmiast; powrót do szkicu wycofuje go z katalogu publicznego i matchmakingu. Edycja przesyła numer wersji: API odrzuca konflikt 409 zamiast nadpisać nowszą zmianę. Formularz zachowuje niezapisane wartości.

Import: obiekt `{ "resources": [...] }` z polami jak w katalogu początkowym, bez jego pola `version`. Do 100 rekordów i limit żądania 512 KiB. Importowane nowe rekordy zawsze są szkicami; istniejące identyfikatory są pomijane. To nie mechanizm automatycznego scrapowania ani aktualizacji istniejących rekordów.

## Potrzeby i trendy

Sygnały potrzeb powstają automatycznie z aktywności użytkowników, z trzech źródeł:

- **Matchmaking** (główne źródło): po interpretacji opisu przez AI zliczane są rozpoznane obszary i potrzeby. Opis problemu ani wynik dopasowania nie są zapisywane. Dopasowanie wywoływane z Kreatora pomysłów nie jest zliczane.
- **Wyszukiwanie w Zasobniku**: zliczana jest wpisana fraza (małe litery, pierwsza strona wyników) oraz obszary rozpoznane po słowach kluczowych z `area-keywords.ts` i wybrany filtr tematu. Fraza „jak wspomóc młodzież w kryzysie zdrowia psychicznego” daje sygnał dla „Zdrowie psychiczne”, nawet gdy katalog nie zwraca wyników. Fraza bez rozpoznanego obszaru trafia tylko do listy fraz. Wyszukiwania administratora nie są zliczane.
- **Przeglądanie Zasobnika**: wejście na stronę tematu albo lista z filtrem tematu bez wpisanej frazy (pierwsza strona) daje sygnał dla tego obszaru. Kolejne zmiany filtrów przy tym samym temacie liczą się ponownie, więc to miara aktywności, a nie liczba wizyt.

W interfejsie nie ma formularza zgłaszania potrzeb. Endpoint `POST /api/knowledge/needs` (kategorie + zgoda, bez tekstu) pozostał w API jako nieużywany przez front.

Przechowujemy wyłącznie dzienne liczniki: wszystkich sygnałów, obszarów, tagów potrzeb, źródeł i fraz wyszukiwania. Nie ma rekordów pojedynczych zapytań, IP, kont ani identyfikatorów osób. Frazy wyszukiwania są zapisywane dosłownie, dlatego pod polem wyszukiwania jest prośba o niewpisywanie danych osobowych; pod formularzem matchmakingu jest informacja o zliczaniu kategorii. Ta sama osoba może wygenerować wiele sygnałów: to miara zainteresowania, nie liczba unikalnych mieszkańców. Błąd zapisu sygnału nie przerywa wyszukiwania ani matchmakingu.

Administrator widzi ostatnie 30 dni UTC (łącznie z bieżącym dniem) i poprzednie 30 dni: liczbę sygnałów, podział na źródła, porównanie obszarów, najczęściej wskazywane tagi, 10 najczęstszych fraz i tabelę dzienną. Obszar jest oznaczany jako **trend rosnący**, gdy ma co najmniej 5 sygnałów w ostatnich 30 dniach i co najmniej 1,5 raza więcej niż w poprzednich 30 dniach; takie obszary są wypisane w ramce „Rosnące zainteresowanie” na górze zakładki. Progi to stałe `RISING_MIN` i `RISING_RATIO` w `knowledge.service.ts`. Zestawienia nie są badaniem reprezentatywnym ani prognozą sytuacji Małopolski. Dane demonstracyjne w audycie UI są atrapami i nie trafiają do bazy aplikacji.

## Pomysły: powiadomienie administratora i odpowiedź autorowi

Odpowiedź na kryterium „Szybkość komunikacji” z CRITERIA. Kod: `apps/api/src/modules/idea-creator/moderation`, zakładka „Pomysły” w panelu (`idea-moderation.component`) i wątek na stronie fiszki (`idea-thread.component`).

1. Autor klika „Wyślij do ROPS”. Fiszka dostaje status `SUBMITTED` i nie jest jeszcze publiczna (wcześniej publikowała się sama).
2. Administrator dostaje powiadomienie: licznik na zakładce „Pomysły (n)” w panelu, odświeżany co 30 sekund, gdy panel jest otwarty, oraz e-mail na `ROPS_NOTIFY_EMAIL`.
3. Administrator otwiera zgłoszenie i wybiera: „Opublikuj pomysł”, „Poproś o uzupełnienie”, „Odrzuć” albo „Odpowiedz bez decyzji”. Prośba o uzupełnienie i odrzucenie wymagają wiadomości dla autora.
4. Autor widzi status i wiadomość ROPS na stronie swojej fiszki („Rozmowa z ROPS”) i może tam odpisać. W „Moich pomysłach” przy fiszce jest status i oznaczenie „Nowa odpowiedź od ROPS”. Jeśli podał e-mail, dostaje też wiadomość z linkiem do fiszki.
5. Odpowiedź autora albo ponowne wysłanie wraca do kolejki administratora jako „Czeka na reakcję”.

Tożsamość: autor to posiadacz kodu edycji fiszki (bez konta), administrator to sesja panelu Zasobnika. Dlatego endpointy administratora leżą pod `/api/knowledge/admin/ideas` (ciasteczko sesji jest ograniczone do tej ścieżki) i wymagają tokenu CSRF. Szkice są niewidoczne także dla administratora. Statusy: `DRAFT`, `SUBMITTED`, `NEEDS_CHANGES`, `REJECTED`, `PUBLISHED`.

E-mail: `MailService` (nodemailer) wysyła tylko wtedy, gdy ustawiono `SMTP_URL`; adresy `MAIL_FROM` i `ROPS_NOTIFY_EMAIL` opisuje `.env.example`. Bez konfiguracji API zapisuje w logu sam temat pominiętej wiadomości. Wysyłka nie blokuje żądania, a jej błąd nie przerywa operacji. Wysyłka przez prawdziwy serwer SMTP nie była testowana; testy e2e sprawdzają, kto i kiedy dostaje powiadomienie, na atrapie.

Ograniczenia: autor nie ma formularza edycji treści fiszki (uzupełnia w wiadomości), link z e-maila działa na urządzeniu, na którym zapisano kod edycji, a moduł Kontakt ROPS pozostał bez zmian i nie jest częścią tej ścieżki.

## Zabezpieczenia i integracja

Sesja trwa maksymalnie 8 godzin. Cookie HttpOnly, SameSite Strict, ograniczone do ścieżki administracyjnej, Secure w produkcji; w bazie jest hash tokenu. Zapisy wymagają sesji, tokenu CSRF i zgodnego `Origin`. Odczyty administracyjne mają `Cache-Control: no-store`. Endpoint trendów i wszystkie operacje administracyjne są chronione na backendzie, niezależnie od widoczności przycisków. MVP ma jedno skonfigurowane poświadczenie administratora, bez publicznych kont; docelowo można podłączyć tożsamość instytucjonalną i role.

Globalny limiter pozostaje procesowy: 100 żądań/min/IP; logowanie i zgłoszenie potrzeby mają po 5/min/IP, matchmaking 10/min/IP. Dla wielu instancji potrzebny jest wspólny limiter. Przeglądarkowe sesje wymagają wdrożenia API i frontendu pod tym samym site, najlepiej przez proxy `/api`, z poprawnym `WEB_ORIGIN`. Hasło, opisy, kategorie indywidualnych zgłoszeń i wyniki nie są logowane.

API: publiczne `GET /api/knowledge/overview`, `GET /resources` (m.in. `video=1` dla zasobów z filmem), `GET /resources/:id`, `POST /needs`; administracyjne pod `/api/knowledge/admin`: login, session, logout, resources (GET/POST/PUT), import i trends. Kontrakty Zod są wspólne z Angular. Serwisy korzystają z repozytorium; zapytania Prisma są wyłącznie w repozytorium, poza skryptem inicjalizacji i testami. Filtry, limit strony 30 i transakcyjne liczniki ograniczają pracę na żądanie. Nie przeprowadzono testu obciążeniowego całego województwa.

## Weryfikacja

Wynik 3 października 2026: **93 testy automatyczne przeszły** (28 jednostkowych API, 43 e2e API z osobną bazą, 22 UI). Typy, lint oraz build API i Angulara przeszły. Dziewięć stanów Zasobnika i sześć matchmakingu: zero wykrytych naruszeń axe WCAG 2.1 A/AA oraz brak przewijania całej strony w poziomie; tabela trendów ma własny dostępny obszar przewijania. Sprawdzono również obsługę wyszukiwania, ponowienia, formularza potrzeb, edycji i logowania/wylogowania w Chromium. Istniejąca demonstracja matchmakingu z rzeczywistym OpenRouter i katalogiem PostgreSQL: 5/5 scenariuszy. Żadne testowe potrzeby nie zostały zapisane w bazie aplikacji.

Build Angulara zgłasza ostrzeżenie rozmiaru początkowego pakietu: około 515 kB przy progu ostrzeżenia 500 kB (około 128 kB po kompresji). Nie przekracza progu błędu 1 MB. Nowe strony są ładowane osobno; nie zwiększano progów, aby ukryć ostrzeżenie. Pełna certyfikacja dostępności i test obciążenia nie były wykonane.

Backend: testy z atrapą AI oraz osobną lokalną bazą `hackyeah_knowledge_test`, w tym publiczne filtry, szkice, sesje, CSRF, wygaśnięcie, rotacja hasła, import, konflikty wersji, walidacja, zgoda, deduplikacja, granice okresów trendów i katalog matchmakingu. Uruchomienie `node scripts/knowledge-test.mjs` tworzy tę bazę, migruje ją i uruchamia testy e2e. Skrypt dopuszcza wyłącznie lokalny host i stałą nazwę bazy testowej; nie usuwa produkcyjnych danych. Testy jednostkowe API i Karma uruchamiają się poleceniami pakietów.

Audyt przeglądarki korzysta z prawdziwego API, więc jego wejścia w temat „Seniorzy” dodają kilka sygnałów „przeglądanie” do bazy, z którą działa API; poza tym nie wykonuje zapisów. Korzysta z działającego katalogu publicznego, a wyszukiwanie frazy testowej i operacje administratora mają atrapy odpowiedzi:

```powershell
npm install --prefix "$env:TEMP/hackyeah-web-qa" playwright-core axe-core --ignore-scripts
$env:QA_TOOLS_PATH = "$env:TEMP/hackyeah-web-qa"
$env:CHROME_BIN = 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe'
node scripts/knowledge-a11y.mjs
```

Sprawdza wyszukiwanie, brak wyników, błąd i ponowienie, dobrowolny formularz, edycję, logowanie/wylogowanie i trendy, klawiaturę, fokus, reflow 320 px oraz reguły axe WCAG 2.1 A/AA. Zrzuty pełne i widoku są w `tmp/knowledge-qa/`. Automatyczny audyt nie jest pełnym potwierdzeniem zgodności WCAG; pozostają testy z czytnikiem ekranu, powiększeniem tekstu i docelowymi użytkownikami.

Koszty: Zasobnik nie wywołuje modelu AI; wymaga istniejącego API, PostgreSQL, hostingu Angular i pracy redakcyjnej. Konieczne są kopie zapasowe bazy i utrzymanie źródeł. Publiczne wdrożenie, prezentacja konkursowa PDF/film oraz pełna ocena WCAG są osobnymi pracami, nie są deklarowane jako wykonane w tej iteracji.
