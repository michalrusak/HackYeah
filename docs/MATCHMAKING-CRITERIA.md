# Blisko — matchmaking społeczny dla Małopolskiego Hubu

Blisko pomaga mieszkańcowi, organizacji lub samorządowi przejść od opisu lokalnego problemu do istniejącego rozwiązania społecznego. Użytkownik opisuje sytuację własnymi słowami, sprawdza interpretację, ogląda innowacje ze źródłami ROPS i poznaje kontekst problemu. Może poprawić opis bez rejestracji.

Zakres tej iteracji wynika z prośby użytkownika: dopracowanie obligatoryjnego matchmakingu. Dokument `CRITERIA Wojewodztwo Malopolskie HUBMI.pdf` jest materiałem referencyjnym. Zasobnik wiedzy, panel administracyjny, kreator, tester, granty i komunikacja między użytkownikami nie są implementowane w tej iteracji. Nie deklarujemy realizacji wszystkich modułów ani gotowości całej platformy do wdrożenia produkcyjnego.

## Powiązanie z wymaganiami

| Kryterium                                           | Realizacja i dowód                                                                                                                                                                                                         |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Opis problemu własnymi słowami                      | Jedno pole, limit 4000 znaków; przykłady są edytowalne; strona główna otwiera formularz                                                                                                                                    |
| Automatyczne kojarzenie potrzeb z rozwiązaniami     | Jedno wywołanie AI interpretuje opis; backend wybiera tylko rekordy katalogowe                                                                                                                                             |
| Podobne przypadki / informacje o kwestii społecznej | Do trzech dopasowanych informacji z Mapy Wyzwań i raportów ROPS; nie są to historie prawdziwych użytkowników ani samodzielny moduł wiedzy                                                                                  |
| Gotowe innowacje społeczne                          | Do pięciu wyników ze źródłowym URL; katalog demonstracyjny zawiera 15 pozycji, nie całe portfolio ROPS                                                                                                                     |
| Trafność i przejrzystość                            | Wspólna potrzeba jest obowiązkowa; rozpoznani odbiorcy muszą pasować; wagi 50/30/20; uzasadnienia z rzeczywistych wspólnych tagów                                                                                          |
| Intuicyjność                                        | Trzy przykłady, krótki opis, stan oczekiwania, przycisk poprawienia opisu, pytania doprecyzowujące, ponowienie po błędzie                                                                                                  |
| Dostępność docelowo WCAG 2.1 AA                     | Etykiety, semantyczne nagłówki, link pomijający nawigację, widoczny fokus, przenoszenie fokusu do odpowiedzi/błędu, 44 px dla przycisków, kontrast obu motywów, reflow przy 320 px, obsługa preferencji ograniczenia ruchu |
| Bezpieczeństwo danych                               | Brak kont i trwałego zapisu opisów/wyników; brak ich w logach; klucz AI tylko w backendzie; zamknięte słowniki; walidacja odpowiedzi; źródła tylko z ROPS; limit zapytań                                                   |
| Skalowalność i integracja                           | NestJS Controller → Service → Repository; kontrakty Zod współdzielone z Angular; katalog wczytany w pamięci; lazy loading; jawne REST API; konfigurowalny adres API                                                        |
| Nazwa, opis, wizualizacja UX/UI                     | Nazwa Blisko; działający interfejs; skrypt QA zapisuje zrzuty formularza, wyników i stanów błędu                                                                                                                           |
| Koszt i utrzymanie                                  | Założenia i formuły poniżej; czas i tokeny są mierzone przez API                                                                                                                                                           |

## Sprawdzenie działania

Automatyczne testy używają fikcyjnych opisów i atrap odpowiedzi AI. Sprawdzają m.in. normalizację wag, remisy, nieznane tagi, zgodność odbiorców, źródła, brak rekomendacji, kontekst mimo braku innowacji, timeout, błędy, formularz, tłumaczenia, fokus i stan wyników.

`node scripts/matchmaking-demo.mjs` przeprowadza pięć rzeczywistych wywołań OpenRouter. Oczekiwane innowacje w pierwszej trójce: Senior CUDER, Health Guide PL, Bez presji z depresji, Merkury. Nieprecyzyjny opis ma zwrócić zero innowacji oraz pytanie. Próbę przeprowadzono 3 października 2026: 5/5 scenariuszy przeszło. To test demonstracyjny, nie pomiar trafności dla populacji użytkowników.

Audyt dostępności (opcjonalne zależności QA poza repozytorium), PowerShell:

```powershell
npm install --prefix "$env:TEMP/hackyeah-web-qa" playwright-core axe-core --ignore-scripts
$env:QA_TOOLS_PATH = "$env:TEMP/hackyeah-web-qa"
$env:CHROME_BIN = 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe'
node scripts/matchmaking-a11y.mjs
```

Można wskazać inny zainstalowany Chromium w `CHROME_BIN` i inny frontend w `WEB_URL`. Frontend musi działać. Skrypt używa atrapy endpointu matchmakingu; nie wysyła opisów do modelu. Sprawdza formularz, wyniki, brak wyników i błąd, desktop, 320 px i ciemny motyw; sprawdza fokus, poziome przewijanie, błędy JavaScript oraz reguły axe WCAG 2.1 A/AA. Zrzuty są w `tmp/matchmaking-qa/`. Wynik 3 października 2026: zero wykrytych naruszeń w sześciu widokach. Automatyczny audyt nie zastępuje pełnej oceny WCAG ani testów z czytnikiem ekranu.

Do walidacji z użytkownikami: mieszkaniec opisuje problem bez instruktażu; osoba starsza korzysta wyłącznie z klawiatury; pracownik JST ocenia trafność odbiorców i warunki wykorzystania źródłowej innowacji. Należy jeszcze wykonać te testy, próbę z czytnikiem ekranu i z powiększeniem tekstu 200%.

## Koszt i wymagane zasoby

Jeden opis to jedno wywołanie AI, bez automatycznych ponowień, z timeoutem 30 sekund i limitem 2000 tokenów wyjściowych. Tylko słowniki i opis trafiają do modelu, bez całego katalogu. Liczba wejściowych i wyjściowych tokenów jest w telemetrii.

Koszt modelu: `liczba wyszukiwań × (tokeny wejściowe × stawka wejściowa + tokeny wyjściowe × stawka wyjściowa) / 1 000 000`.

Ilustracyjne założenie: 1000 tokenów wejściowych i 300 wyjściowych. Przy stawkach wyświetlanych na [stronie Qwen3.8 27B w OpenRouter](https://openrouter.ai/qwen/qwen3.8-27b) 3 października 2026 (0,094 USD / mln wejściowych oraz 4,40 USD / mln wyjściowych) daje to około 0,001414 USD za wyszukiwanie, 1,41 USD za 1000 wyszukiwań i 14,14 USD za 10 000. Rzeczywiste rozliczenie zależy od dostawcy, liczby tokenów, aktualnej taryfy i opłat platformy; przy rozbudowie należy ponownie sprawdzić cennik i zestawić go z telemetrią.

Budżet planistyczny dla pilota: 20–40 USD miesięcznie na mały serwer API i statyczny frontend, plus zużycie AI, domena i praca redakcyjna. To założenie kosztorysowe, nie oferta dostawcy ani wynik testu obciążeniowego. Obecny matchmaking nie potrzebuje bazy danych; główna aplikacja może używać Postgresa dla innych modułów. Zasoby: Node.js zgodny z projektem, proces API, hosting plików Angular, HTTPS/reverse proxy, klucz OpenRouter i osoba weryfikująca katalog.

## Dalsza rozbudowa

Katalogi JSON mają wspólną walidację i jawne wersje; obecne repozytorium można zastąpić repozytorium TypeORM bez zmiany formularza. Przy zwiększeniu katalogu należy ponownie zweryfikować klasyfikację i przygotować większy zbiór testowy. Brak wyników jest dopuszczalny i nie oznacza braku rozwiązania w pełnej bibliotece ROPS.

Przy większym ruchu: wspólny rate limiter między instancjami, limit współbieżnych wywołań modelu i test obciążenia. Obecny limit 10 zapytań/min/IP jest przechowywany w procesie. Nie deklarujemy zmierzonej obsługi całego województwa. Późniejsze integracje z katalogiem grantów mogą korzystać z identyfikatorów innowacji i tagów w odpowiedzi REST. Automatyczne powiadomienia i trwałe zgłoszenia wymagają odrębnego modułu oraz ustalenia podstaw przetwarzania danych.

Publiczne demo, prezentacja PDF lub film do zgłoszenia konkursowego wymagają osobnego przygotowania; lokalny adres `http://localhost:4200/matchmaking` nie jest publicznym linkiem demo. Działający interfejs i zrzuty QA są podstawą makiet UX/UI.
