# Tester innowacji — konta i dostępność

Zakładka `/tester-innowacji` łączy organizatorów testów innowacji społecznych z osobami opisującymi swoje doświadczenia, umiejętności i zasoby. Profile, wyszukiwania i przypisania są zapisywane w PostgreSQL. OpenRouter porównuje zapytanie z deklaracjami zapisanymi w profilach.

## Wymagania funkcjonalne

1. **Konto.** Rejestracja wymaga unikalnego loginu i hasła. Login ma 3–40 znaków: litery bez polskich znaków, cyfry, kropkę, podkreślenie lub myślnik; zaczyna się literą lub cyfrą. Wielkość liter nie ma znaczenia. Hasło ma 12–128 znaków i nie jest przycinane.
2. **Dodawanie i edycja profilu.** „Dołącz jako tester” prowadzi przez rejestrację lub logowanie do formularza profilu. Zalogowany właściciel może edytować ten sam profil na innym urządzeniu. Inne konta nie uzyskują dostępu do jego edycji.
3. **Publikacja.** Zapisany profil jest publiczny i może być analizowany przez AI. Formularz zawiera krótką informację o publikacji, bez checkboxa zgody i bez przełącznika wycofania udostępniania. Dane o dostępności pozostają opcjonalne. API nie przyjmuje w formularzu pól `consent` ani `isActive`; historyczne flagi pozostają w bazie.
4. **Dotychczasowe profile.** Rejestracja może przypisać istniejący profil i historię z bieżącej przeglądarki na podstawie jej starego prywatnego klucza. Klucz powiązany już z kontem nie daje anonimowego dostępu ani nie może zostać przypisany do drugiego konta.
5. **Wyszukiwanie.** Użytkownik opisuje wymagania własnymi słowami. AI analizuje rzeczywiste aktywne profile z bazy; wynik zawiera ocenę 1–100, uzasadnienie i pasujące deklaracje. Ocena opisuje dopasowanie, nie potwierdza kwalifikacji ani sukcesu testu. Awaria AI jest jawnym błędem.
6. **Gość i historia.** Katalog i wyszukiwanie są dostępne bez konta. Historia gościa jest związana z anonimowym kluczem przeglądarki; zalogowany użytkownik korzysta z historii konta. Dane konta nie są dostępne po wylogowaniu.
7. **Przypisania.** Wybrane osoby można przypisać do zapisanego wyszukiwania lub usunąć przypisanie. Unikalność pary wyszukiwanie/profil zapobiega duplikatom. Przypisanie nie wysyła zaproszenia.
8. **Aktualność.** Dopasowanie jest związane z wersją profilu. Edycja lub niedostępność profilu unieważnia poprzednią ocenę i wymaga nowego wyszukiwania.
9. **Dane demonstracyjne.** Seed dodaje oznaczone fikcyjne profile do PostgreSQL. Nie zastępuje API listą mocków i nie nadpisuje profili użytkowników.

## Dane i zabezpieczenia

| Zasób        | Zawartość                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| Konto        | UUID, unikalny login i identyfikator właściciela, hash hasła scrypt z indywidualną solą                 |
| Sesja        | Hash losowego tokenu, konto, czas wygaśnięcia                                                           |
| Profil       | UUID, identyfikator właściciela, deklarowane cechy, historyczne flagi publikacji, daty, oznaczenie demo |
| Wyszukiwanie | Właściciel, zapytanie, wyniki z wersjami profili, statystyki                                            |
| Przypisanie  | Klucze obce wyszukiwania i profilu; unikalna para                                                       |

Sesja trwa 7 dni. Token jest przekazywany wyłącznie przez cookie HttpOnly, SameSite=Lax, Path=/api; NODE_ENV=production włącza Secure. Baza przechowuje SHA-256 tokenu. Wylogowanie unieważnia bieżącą sesję. Hasła i tokeny sesji nie trafiają do localStorage ani do AI.

Profil wymaga sesji konta. Wyszukiwania gości używają nagłówka X-Tester-Key; uwierzytelnienie konta ma pierwszeństwo. Operacje sesji oraz zapis z konta sprawdzają Origin. WEB_ORIGIN określa dozwolone adresy frontendu (lista oddzielona przecinkami). CORS dopuszcza credentials tylko dla tych adresów. Produkcja wymaga HTTPS oraz frontendu i API w tej samej witrynie, zgodnie z SameSite=Lax.

AI otrzymuje wyłącznie zapytanie i publiczne deklaracje potrzebne do dopasowania. Nie ma zgadywać zdrowia, niepełnosprawności ani cech niepodanych przez użytkownika. Odpowiedź jest walidowana przez Zod, a identyfikatory muszą należeć do przekazanego zestawu kandydatów.

## API

Kontrakty: `packages/api-contracts/src/auth.schema.ts` i `testers.schema.ts`.

| Metoda i ścieżka                                        | Działanie                                                 |
| ------------------------------------------------------- | --------------------------------------------------------- |
| POST /api/auth/register                                 | Rejestracja, opcjonalne powiązanie starego profilu, sesja |
| POST /api/auth/login                                    | Logowanie i nowa sesja                                    |
| GET /api/auth/me                                        | Bieżący użytkownik lub null                               |
| POST /api/auth/logout                                   | Unieważnienie sesji                                       |
| GET /api/testers/profiles                               | Publiczny katalog                                         |
| GET /api/testers/profile/me                             | Własny profil lub null; wymaga konta                      |
| PUT /api/testers/profile/me                             | Zapis własnego profilu; wymaga konta                      |
| POST /api/testers/search                                | Analiza AI i zapis wyniku                                 |
| GET /api/testers/searches                               | Własna historia                                           |
| GET /api/testers/searches/:id                           | Własny wynik                                              |
| POST /api/testers/searches/:id/assignments              | Przypisanie osoby z wyniku                                |
| DELETE /api/testers/searches/:id/assignments/:profileId | Usunięcie przypisania                                     |

## Dostępność i intuicyjność — kryterium konkursowe 20%

Projekt kieruje się [WCAG 2.1 na poziomie AA](https://www.w3.org/TR/WCAG21/).

- Czytelne nazwy i etykiety pól, rozdzielenie danych wymaganych i opcjonalnych, wskazówki przed wysłaniem formularza.
- Tekstowe komunikaty błędów i fokus na pierwszym nieprawidłowym polu (3.3.1, 3.3.2).
- Obsługa klawiatury, widoczny fokus, pomijanie nawigacji, logiczny fokus po zmianie strony i zamknięciu okna (2.1.1, 2.1.2, 2.4.1, 2.4.3, 2.4.7).
- Semantyczne etykiety i autocomplete; możliwość wklejenia hasła oraz jego pokazania (1.3.1, 1.3.5).
- Kontrast jasnego i ciemnego motywu, układ przy 320 px, powiększeniu i zwiększonych odstępach tekstu (1.4.3, 1.4.4, 1.4.10, 1.4.12).
- Menu rozwijane na hover i fokus można zwinąć klawiszem Escape bez ukrycia całej nawigacji; na telefonie otwiera się przyciskiem (1.4.13).
- Dynamiczne błędy i statusy używają komunikatów dostępnych dla czytnika ekranu (4.1.3).

Automatyczny skan nie jest potwierdzeniem pełnej zgodności. Odbiór wymaga również prób z czytnikiem ekranu i przedstawicielami docelowych grup, w tym osobami starszymi i o mniejszych umiejętnościach cyfrowych.

## Uruchomienie i testy

Projekt używa Node 22 przypiętego przez pnpm, PostgreSQL i Prisma 7.

```bash
pnpm install
pnpm setup
pnpm docker:up
pnpm db:migrate
pnpm db:seed
pnpm start
```

Migracje dodają tabele bez resetowania danych; migracja kont to `20261003000200_tester_accounts`. Seed jest opcjonalny. Sekrety są czytane z głównego .env i pozostają na backendzie.

Testy opisano w [TESTING.md](TESTING.md). Sprawdzamy m.in. rejestrację, ponowne logowanie, izolację kont, wygaśnięcie i wylogowanie sesji, przejęcie własnego wcześniejszego profilu oraz rzeczywisty zapis w PostgreSQL.

Poza zakresem pozostają odzyskiwanie hasła, weryfikacja deklaracji, komunikator i wysyłanie zaproszeń. Zmiana obejmuje konta profili Testera; Kreator pomysłów zachowuje własny istniejący mechanizm dostępu.
