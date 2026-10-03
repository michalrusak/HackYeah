# Tester innowacji — wyszukiwanie, ogłoszenia i udział w testach

Zakładka `/tester-innowacji` łączy organizatorów testów innowacji społecznych z osobami opisującymi swoje doświadczenia, umiejętności i zasoby. Profile, wyszukiwania, ogłoszenia, zgłoszenia udziału oraz opinie są zapisywane w PostgreSQL. OpenRouter porównuje zapytanie z deklaracjami zapisanymi w profilach.

Użytkownik wybiera jedną z trzech zakładek: wyszukiwanie osób, ogłoszenia testów lub własną aktywność. To samo konto służy do wystawienia ogłoszenia, zarządzania profilem testera, udziału w cudzych testach i wystawiania opinii. Nie trzeba zakładać osobnego konta organizatora.

## Wymagania funkcjonalne

1. **Konto.** Rejestracja wymaga unikalnego loginu i hasła. Login ma 3–40 znaków: litery bez polskich znaków, cyfry, kropkę, podkreślenie lub myślnik; zaczyna się literą lub cyfrą. Wielkość liter nie ma znaczenia. Hasło ma 12–128 znaków i nie jest przycinane.
2. **Dodawanie i edycja profilu.** „Dołącz jako tester” prowadzi przez rejestrację lub logowanie do formularza profilu. Zalogowany właściciel może edytować ten sam profil na innym urządzeniu. Inne konta nie uzyskują dostępu do jego edycji.
3. **Publikacja.** Zapisany profil jest publiczny i może być analizowany przez AI. Formularz zawiera krótką informację o publikacji, bez checkboxa zgody i bez przełącznika wycofania udostępniania. Dane o dostępności pozostają opcjonalne. API nie przyjmuje w formularzu pól `consent` ani `isActive`; historyczne flagi pozostają w bazie.
4. **Dotychczasowe profile.** Rejestracja może przypisać istniejący profil i historię z bieżącej przeglądarki na podstawie jej starego prywatnego klucza. Klucz powiązany już z kontem nie daje anonimowego dostępu ani nie może zostać przypisany do drugiego konta.
5. **Wyszukiwanie.** Użytkownik opisuje wymagania własnymi słowami, również pojedynczym słowem od 2 znaków. Podpowiedzi zachęcają do wypróbowania słowa. AI analizuje aktywne profile z bazy; wynik zawiera ocenę 1–100, uzasadnienie i pasujące deklaracje. Jedno zapytanie obejmuje do 250 kandydatów; interfejs pokazuje liczbę analizowanych profili i liczbę wszystkich profili, jeżeli katalog jest większy. Ocena opisuje dopasowanie, nie potwierdza kwalifikacji ani sukcesu testu. Awaria AI jest jawnym błędem. Katalog można przeglądać kolejnymi partiami po 60 profili.
6. **Gość i historia.** Katalog i wyszukiwanie są dostępne bez konta. Historia gościa jest związana z anonimowym kluczem przeglądarki; zalogowany użytkownik korzysta z historii konta. Dane konta nie są dostępne po wylogowaniu.
7. **Przypisania.** Wybrane osoby można przypisać do zapisanego wyszukiwania lub usunąć przypisanie. Unikalność pary wyszukiwanie/profil zapobiega duplikatom. Przypisanie nie wysyła zaproszenia.
8. **Aktualność.** Dopasowanie jest związane z wersją profilu. Edycja lub niedostępność profilu unieważnia poprzednią ocenę i wymaga nowego wyszukiwania.
9. **Przykładowe osoby.** Seed zapisuje 210 fikcyjnych profili w PostgreSQL: dotychczasowe 10 oraz 200 nowych, z odrębnymi nazwami i opisami. Obejmuje ponad 50 miejscowości, różny poziom umiejętności cyfrowych, potrzeby dostępności, opiekunów, edukatorów, wolontariat, czujniki, wydajne komputery, transport i inicjatywy sąsiedzkie. Interfejs oznacza je jako przykładowe, a techniczne pole `isDemo` zachowuje informację o pochodzeniu. To dane bazy obsługiwane przez rzeczywiste API, nie lista mocków. Nie powstają fikcyjne konta, hasła ani zgłoszenia udziału w imieniu tych osób.
10. **Ogłoszenia.** Zalogowany organizator może opisać pomysł, prototyp lub istniejące rozwiązanie, np. nowy czujnik. Podaje publiczną nazwę organizatora, tytuł, opis, wymagania, tryb testów i opcjonalnie miejsce. Może później edytować własne ogłoszenie oraz zamknąć lub ponownie otworzyć nabór. Login konta nie jest publiczną nazwą organizatora.
11. **Brak dopasowania.** Z wyników wyszukiwania można przejść do utworzenia ogłoszenia z przeniesionym opisem wymagań. Pozwala to zgłosić zapotrzebowanie, gdy w obecnym katalogu nie ma odpowiedniej osoby. Ogłoszenia są widoczne w publicznej zakładce; ich przeglądanie nie wymaga konta.
12. **Chęć udziału.** Zalogowana osoba z zapisanym profilem testera może zgłosić udział w otwartym teście i dodać krótką wiadomość. Organizator nie zgłasza się do własnego testu. Jedno konto ma najwyżej jedno zgłoszenie do danego ogłoszenia. Organizator widzi zgłoszenia wraz z profilami i przyjmuje lub odrzuca oczekujące osoby. Treść zgłoszeń jest dostępna właścicielowi ogłoszenia i zgłaszającemu, a nie całemu katalogowi.
13. **Cykl zgłoszenia.** Statusy to oczekujące, przyjęte, odrzucone i wycofane. Uczestnik może wycofać oczekujące lub przyjęte zgłoszenie przed wystawieniem opinii, a wycofane zgłoszenie ponowić, gdy nabór jest otwarty. Zamknięcie naboru blokuje nowe zgłoszenia; nie usuwa historii.
14. **Ocena i usprawnienia.** Przyjęty uczestnik może wystawić ocenę 1–5, napisać informację zwrotną i opcjonalnie zaproponować usprawnienie. Ma jedną opinię do danego testu i może ją poprawić, także po zamknięciu naboru. Opinie i średnia ocena są publiczne, podpisane nazwą z profilu testera. Organizator nie edytuje cudzej opinii ani nie wystawia własnej.
15. **Moja aktywność.** Prywatna zakładka zbiera własne ogłoszenia, zgłoszenia udziału ze statusami oraz wystawione opinie. Każdy element prowadzi do szczegółów i właściwego następnego działania. Dane pozostają powiązane z tym samym kontem po ponownym logowaniu i na innym urządzeniu.

## Dane i zabezpieczenia

| Zasób              | Zawartość                                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Konto              | UUID, unikalny login i identyfikator właściciela, hash hasła scrypt z indywidualną solą                                     |
| Sesja              | Hash losowego tokenu, konto, czas wygaśnięcia                                                                               |
| Profil             | UUID, identyfikator właściciela, deklarowane cechy, historyczne flagi publikacji, daty, oznaczenie profilu przykładowego    |
| Wyszukiwanie       | Właściciel, zapytanie, wyniki z wersjami profili, statystyki                                                                |
| Przypisanie        | Klucze obce wyszukiwania i profilu; unikalna para                                                                           |
| Ogłoszenie         | Właściciel konta, publiczna nazwa organizatora, opis, wymagania, tryb, etap rozwiązania, stan naboru                        |
| Zgłoszenie udziału | Konto uczestnika, ogłoszenie, wiadomość, status; unikalna para konto/ogłoszenie                                             |
| Opinia             | Konto przyjętego uczestnika, ogłoszenie, ocena, opis doświadczenia, propozycja usprawnienia; unikalna para konto/ogłoszenie |

Sesja trwa 7 dni. Token jest przekazywany wyłącznie przez cookie HttpOnly, SameSite=Lax, Path=/api; NODE_ENV=production włącza Secure. Baza przechowuje SHA-256 tokenu. Wylogowanie unieważnia bieżącą sesję. Hasła i tokeny sesji nie trafiają do localStorage ani do AI.

Profil wymaga sesji konta. Wyszukiwania gości używają nagłówka X-Tester-Key; uwierzytelnienie konta ma pierwszeństwo. Operacje sesji oraz zapis z konta sprawdzają Origin. WEB_ORIGIN określa dozwolone adresy frontendu (lista oddzielona przecinkami). CORS dopuszcza credentials tylko dla tych adresów. Produkcja wymaga HTTPS oraz frontendu i API w tej samej witrynie, zgodnie z SameSite=Lax.

AI otrzymuje wyłącznie zapytanie i publiczne deklaracje potrzebne do dopasowania. Nie ma zgadywać zdrowia, niepełnosprawności ani cech niepodanych przez użytkownika. Odpowiedź jest walidowana przez Zod, a identyfikatory muszą należeć do przekazanego zestawu kandydatów.

## API

Kontrakty: `packages/api-contracts/src/auth.schema.ts`, `testers.schema.ts` i `tester-projects.schema.ts`.

| Metoda i ścieżka                                            | Działanie                                                      |
| ----------------------------------------------------------- | -------------------------------------------------------------- |
| POST /api/auth/register                                     | Rejestracja, opcjonalne powiązanie starego profilu, sesja      |
| POST /api/auth/login                                        | Logowanie i nowa sesja                                         |
| GET /api/auth/me                                            | Bieżący użytkownik lub null                                    |
| POST /api/auth/logout                                       | Unieważnienie sesji                                            |
| GET /api/testers/profiles                                   | Publiczny katalog                                              |
| GET /api/testers/profile/me                                 | Własny profil lub null; wymaga konta                           |
| PUT /api/testers/profile/me                                 | Zapis własnego profilu; wymaga konta                           |
| POST /api/testers/search                                    | Analiza AI i zapis wyniku                                      |
| GET /api/testers/searches                                   | Własna historia                                                |
| GET /api/testers/searches/:id                               | Własny wynik                                                   |
| POST /api/testers/searches/:id/assignments                  | Przypisanie osoby z wyniku                                     |
| DELETE /api/testers/searches/:id/assignments/:profileId     | Usunięcie przypisania                                          |
| GET /api/testers/projects                                   | Publiczna lista ogłoszeń, wyszukiwanie, filtry i stronicowanie |
| POST /api/testers/projects                                  | Utworzenie ogłoszenia z konta                                  |
| GET /api/testers/projects/:id                               | Szczegóły, publiczne opinie i własne zgłoszenie                |
| PUT /api/testers/projects/:id                               | Edycja własnego ogłoszenia i stanu naboru                      |
| GET /api/testers/projects/:id/applications                  | Zgłoszenia uczestników; tylko organizator                      |
| PUT /api/testers/projects/:id/applications/me               | Zgłoszenie udziału lub ponowienie wycofanego zgłoszenia        |
| DELETE /api/testers/projects/:id/applications/me            | Wycofanie własnego zgłoszenia przed wystawieniem opinii        |
| PATCH /api/testers/projects/:id/applications/:applicationId | Przyjęcie lub odrzucenie oczekującego zgłoszenia               |
| PUT /api/testers/projects/:id/feedback/me                   | Dodanie lub edycja własnej opinii przez przyjętego uczestnika  |
| GET /api/testers/activity                                   | Prywatne ogłoszenia, zgłoszenia i opinie danego konta          |

## Dostępność i intuicyjność — kryterium konkursowe 20%

Projekt kieruje się [WCAG 2.1 na poziomie AA](https://www.w3.org/TR/WCAG21/).

- Czytelne nazwy i etykiety pól, rozdzielenie danych wymaganych i opcjonalnych, wskazówki przed wysłaniem formularza.
- Tekstowe komunikaty błędów i fokus na pierwszym nieprawidłowym polu (3.3.1, 3.3.2).
- Obsługa klawiatury, widoczny fokus, pomijanie nawigacji, logiczny fokus po zmianie strony i zamknięciu okna (2.1.1, 2.1.2, 2.4.1, 2.4.3, 2.4.7).
- Semantyczne etykiety i autocomplete; możliwość wklejenia hasła oraz jego pokazania (1.3.1, 1.3.5).
- Kontrast jasnego i ciemnego motywu, układ przy 320 px, powiększeniu i zwiększonych odstępach tekstu (1.4.3, 1.4.4, 1.4.10, 1.4.12).
- Trzy zakładki Testera mają nazwy, stan wyboru i obsługę klawiatury; okna formularzy utrzymują fokus i można je zamknąć klawiszem Escape, gdy zapis nie trwa (2.1.1, 4.1.2).
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

Migracje dodają tabele bez resetowania danych; migracja kont to `20261003000200_tester_accounts`. Sekrety są czytane z głównego .env i pozostają na backendzie.

Polecenie **`pnpm db:seed` z katalogu głównego** zasila katalog testerów. Zachowuje stałe tożsamości i kolejność istniejących przykładów; dodaje jedynie brakujące rekordy przez `createMany` z `skipDuplicates`. Ponowne uruchomienie nie dodaje kopii, nie nadpisuje opisów ani profili użytkowników. Polecenie `pnpm --filter api db:seed` dotyczy osobno danych Kreatora pomysłów.

Testy opisano w [TESTING.md](TESTING.md). Sprawdzamy m.in. rejestrację, ponowne logowanie, izolację kont, wygaśnięcie i wylogowanie sesji, przejęcie własnego wcześniejszego profilu oraz rzeczywisty zapis w PostgreSQL.

Testy danych sprawdzają walidację wszystkich profili, unikalność nazw i opisów oraz zachowanie wcześniejszych tożsamości. Test PostgreSQL uruchamia seed dwukrotnie w odizolowanym schemacie i potwierdza brak duplikatów, brak nadpisywania istniejących rekordów i brak tworzonych kont.

Poza zakresem pozostają odzyskiwanie hasła, weryfikacja deklaracji i automatyczne wysyłanie zaproszeń. Przypisanie osoby do wyniku wyszukiwania nie zgłasza tej osoby do testu; uczestnik sam zgłasza udział z własnego konta. Kreator pomysłów zachowuje własny istniejący mechanizm dostępu.
