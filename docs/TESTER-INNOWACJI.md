# Tester innowacji

Zakładka `/tester-innowacji` łączy organizatorów testów innowacji społecznych z osobami, które dobrowolnie opisują swoje doświadczenia, umiejętności i zasoby. Profile, wyniki wyszukiwań i przypisania są przechowywane w PostgreSQL. OpenRouter ocenia zgodność zapytania z deklaracjami zapisanymi w profilach.

## Wymagania funkcjonalne

1. **Wyszukiwanie osób.** Organizator wpisuje wymaganie własnymi słowami, np. „Szukamy osoby z mocnym komputerem do przetestowania aplikacji edukacyjnej” albo „Szukamy testerów korzystających z czytnika ekranu”. Wysłanie formularza uruchamia analizę AI rzeczywistych profili z bazy.
2. **Wyjaśnione dopasowania.** Wynik zawiera profil, ocenę zgodności 1–100, uzasadnienie oraz pasujące deklaracje. Ocena nie jest statystycznym prawdopodobieństwem ani potwierdzeniem kwalifikacji. Brak dopasowania daje pustą listę, a awaria AI jawny błąd.
3. **Dodanie profilu.** Przycisk na tej samej stronie otwiera formularz z nazwą publiczną, miejscowością, opisem, umiejętnościami, zasobami, zainteresowaniami, trybem udziału i opcjonalnym opisem potrzeb dostępnościowych. Wymagana jest zgoda na publikację i analizę tych informacji przez AI.
4. **Edycja i widoczność.** Właściciel może edytować swój profil i wyłączyć jego widoczność. Nieaktywne profile nie uczestniczą w nowych wyszukiwaniach. Pozostali użytkownicy nie mogą edytować cudzego profilu.
5. **Zachowanie dostępu.** Ponieważ projekt nie ma kont, przeglądarka generuje prywatny klucz dostępu. Klucz można skopiować i przywrócić na innym urządzeniu. Utrata klucza oznacza utratę dostępu; znajomość klucza daje dostęp do profilu i własnych wyszukiwań. Serwer zapisuje wyłącznie SHA-256 klucza.
6. **Historia testów.** Zapytanie i wyniki zostają zapisane dla właściciela klucza. Użytkownik może ponownie otworzyć zapisane wyszukiwanie po odświeżeniu strony. Ocena jest związana z wersją profilu poddaną analizie. Jeśli profil zmieni się podczas lub po analizie, stary wynik zostaje ukryty z komunikatem o potrzebie ponownego wyszukania.
7. **Przypisanie testerów.** Osobę z wyników można przypisać do danego zapytania testowego lub usunąć przypisanie. Powtórzenie przypisania nie tworzy duplikatu. Jest to lista uczestników wybranych przez organizatora, nie wysyłka zaproszenia ani potwierdzenie udziału testera.
8. **Dane demonstracyjne.** Seed dodaje fikcyjne, jednoznacznie oznaczone profile do PostgreSQL. Kolejne uruchomienie nie duplikuje rekordów i nie nadpisuje profili użytkowników. Interfejs pobiera dane z API; nie zawiera zastępczej listy wyników.

## Model danych i dostęp

| Zasób          | Zawartość i relacje                                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Profil testera | UUID, hash klucza właściciela, deklarowane cechy, zgoda, aktywność, oznaczenie demonstracyjne, daty utworzenia i zmiany    |
| Wyszukiwanie   | UUID, hash klucza właściciela, zapytanie, podsumowanie, dopasowania wraz z wersjami profili i liczba analizowanych profili |
| Przypisanie    | Wyszukiwanie i profil połączone kluczami obcymi; unikalność pary zapobiega duplikatom                                      |

Publiczny katalog zawiera wyłącznie aktywne profile. Profil właściciela, historia i przypisania wymagają nagłówka `X-Tester-Key` z losowym kluczem 32-bajtowym zapisanym jako 64 znaki szesnastkowe. Wdrożenie publiczne wymaga HTTPS. Klucz nie jest wysyłany do modelu AI.

AI otrzymuje zapytanie i deklarowane informacje potrzebne do dopasowania. Nie otrzymuje kluczy właścicieli. Nie ma zgadywać stanu zdrowia, niepełnosprawności ani innych niepodanych cech. Odpowiedź jest walidowana schematem Zod, a identyfikatory muszą należeć do przekazanego zestawu kandydatów. Liczba profili analizowanych w jednym zapytaniu jest ograniczona i jawna w odpowiedzi API oraz interfejsie.

## Interfejs API

Wspólne schematy i typy: `packages/api-contracts/src/testers.schema.ts`.

| Metoda i ścieżka                                          | Działanie                                       |
| --------------------------------------------------------- | ----------------------------------------------- |
| `GET /api/testers/profiles`                               | Publiczne aktywne profile i liczebność katalogu |
| `GET /api/testers/profile/me`                             | Własny profil albo `null`                       |
| `PUT /api/testers/profile/me`                             | Utworzenie lub edycja własnego profilu          |
| `POST /api/testers/search`                                | Analiza AI i zapis wyszukiwania                 |
| `GET /api/testers/searches`                               | Własna historia                                 |
| `GET /api/testers/searches/:id`                           | Zapisany wynik i przypisane osoby               |
| `POST /api/testers/searches/:id/assignments`              | Przypisanie osoby z wyników                     |
| `DELETE /api/testers/searches/:id/assignments/:profileId` | Usunięcie własnego przypisania                  |

## Uruchomienie

Wymagane są Node.js 22 lub nowszy, pnpm i PostgreSQL. Konfiguracja bazy i `OPENROUTER_API_KEY` oraz `OPENROUTER_MODEL` są odczytywane z głównego `.env`; sekretów nie umieszcza się w Angularze.

```bash
pnpm install
pnpm setup
pnpm docker:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Migracja dodaje wyłącznie tabele funkcji i nie resetuje istniejącej bazy. Seed jest operacją jawną, oddzieloną od startu aplikacji. Przy wdrożeniu produkcyjnym migrację uruchamia się przed API; profile demonstracyjne nie są wymagane do działania.

Warstwa danych korzysta z Prisma 7: `apps/api/prisma/schema.prisma` i addytywnej migracji `20261003180000_create_testers`. Polecenie `pnpm db:migrate` stosuje istniejące migracje przez `prisma migrate deploy`, bez tworzenia migracji ani resetowania schematu.

## Kryteria odbioru

- Dodany profil jest widoczny po ponownym pobraniu danych; edycja zmienia ten sam rekord.
- Inny klucz nie uzyskuje dostępu do cudzej historii i przypisań.
- Wyłączenie profilu usuwa go z publicznego katalogu i nowych analiz.
- Wyszukiwanie pokazuje tylko osoby istniejące w bazie; niepoprawna odpowiedź AI nie tworzy pozornych wyników.
- Przypisania są odczytywane z bazy po ponownym otwarciu wyszukiwania.
- Błędy walidacji, połączenia, limitu zapytań i AI są widoczne w interfejsie.
- Testy integracyjne używają prawdziwego PostgreSQL w osobnym schemacie; zastępowany jest wyłącznie transport AI, aby wynik testu był powtarzalny.

Poza zakresem tej wersji pozostają konta z odzyskiwaniem hasła, weryfikacja deklaracji, komunikator oraz automatyczne wysyłanie zaproszeń.
