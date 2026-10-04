# Pilotaże w matchmakingu

Brak wyników uruchamia osobne wyszukiwanie projektów testowych. Przy istniejących wynikach użytkownik wybiera „Żadna propozycja nie odpowiada mojej potrzebie”. Zapytanie wykorzystuje interpretację bieżącej potrzeby bez ponownego wywołania AI. Błąd pobierania pilotaży nie usuwa wyników ROPS.

## Dopuszczenie rzeczywistego projektu

Ogłoszenie musi mieć etap `prototype`, otwarty nabór oraz osobny wpis `TesterPilotListing`. Użytkownik tworzący projekt nie może sam nadać dopuszczenia przez API. W pierwszej wersji upoważniony operator publikuje wpis za pomocą skryptu uruchamianego po rzeczywistej ocenie Hubu. Wpis dotyczy dopuszczenia do prezentowania testów, nigdy zatwierdzenia rozwiązania do wdrożenia.

1. Utwórz projekt w module Tester innowacji.
2. Przygotuj JSON zgodny z `PilotConditionsSchema` (odbiorcy, potrzeby, obszary, koniec naboru w UTC, termin testu, zaangażowanie i rodzaj uczestników). Dla prawdziwego projektu `isDemo` musi wynosić `false`.
3. Po przeglądzie uruchom `node scripts/publish-pilot.mjs <project-id> <conditions.json> <reviewer>` z katalogu repo. Pakiet api-contracts musi być skompilowany.

Zmiana treści projektu unieważnia dopuszczenie, ponieważ przechowujemy datę wersji zaakceptowanej przez operatora. Zamknięte nabory, pomysły, gotowe rozwiązania, wpisy bez przeglądu i nabory po terminie nie są proponowane. Dopuszczenie można cofnąć, usuwając wpis w `tester_pilot_listings`; ogłoszenie i zgłoszenia pozostają.

## Dopasowanie i zgłoszenie

Wymagana jest co najmniej jedna wspólna potrzeba i zgodność odbiorców, gdy odbiorcy zostali rozpoznani. Wynik nie oznacza spełnienia wszystkich warunków udziału: użytkownik widzi wymagania i organizator podejmuje decyzję. Nie wnioskujemy uprawnień osoby z samego tekstu opisującego społeczność.

Formularz zainteresowania pozostaje w kafelku. Logowanie i profil testera wykorzystują istniejące okna, zachowując wiadomość. Wysyłka trafia do dotychczasowego procesu zgłoszeń, ze statusem `pending`. Serwer ponownie sprawdza aktualność dopuszczenia i termin naboru pod blokadą projektu. Powtórne wysłanie nie duplikuje zgłoszenia. Organizator odczytuje wiadomość w swoich zgłoszeniach; aplikacja nie wysyła automatycznego e-maila.

## Demonstracja lokalna

`node scripts/seed-demo-pilot.mjs` dodaje jeden jawnie fikcyjny projekt oraz fikcyjne konto organizatora z losowym, nieudostępnianym hasłem. Skrypt działa tylko z bazą na localhost i nie nadpisuje istniejących wpisów. Przykład „Chcę przetestować nowy pomysł” po prawej stronie wypełnia opis do tego scenariusza. To nie jest prawdziwy nabór ani zatwierdzenie ROPS. Okno demonstracyjne wygasa po 90 dniach od utworzenia.

Migracja dodaje wyłącznie tabelę dopuszczeń. Nie zmienia katalogu ROPS, rankingu dotychczasowych innowacji ani ich iframe.

## Rzeczywisty przykład zewnętrzny: NeuroSTART

Przykład po prawej dotyczy przygotowania młodych osób w spektrum autyzmu do pracy. Rekord w `external-pilots.v1.json` opisuje rzeczywisty narzędziownik NeuroSTART na podstawie [zaproszenia autorki](https://www.linkedin.com/feed/update/urn:li:activity:7509705729986101248/), sprawdzonego 04.10.2026. Źródło opisuje projekt w TransferHUB, nie w Małopolskim Hubie. Nie potwierdzamy nieobecności w całej bibliotece ROPS — projekt nie znajduje się w lokalnym katalogu 15 rozwiązań.

Brak daty końca naboru, trybu i czasu udziału jest pokazywany jawnie. Data `recheckAfter` jest wewnętrznym terminem ponownej weryfikacji źródła, nie terminem rekrutacji. Po tej dacie rekord przestaje być proponowany. Nie tworzymy konta w imieniu autorki i nie zapisujemy zainteresowania do fikcyjnego organizatora. Szczegóły rozwijają się w kafelku, a zgłoszenie wymaga skorzystania z kontaktu w oryginalnym ogłoszeniu.

`node scripts/retire-demo-pilot.mjs` zamyka wyłącznie poprzedni fikcyjny projekt mapy pomocy w lokalnej bazie, zachowując historię. Zewnętrzny rekord nie wymaga seeda ani migracji.
