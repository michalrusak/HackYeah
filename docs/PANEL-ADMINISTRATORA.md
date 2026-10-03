# Panel administratora — plan modułu

Plan punktu **VI** z sekcji 2 briefu ROPS („Panel administratora – pozwalający w szybki sposób modyfikowanie, weryfikację i udostępnianie wiedzy") wraz z administracyjną częścią punktu II (agregacja potrzeb i trendy). Dokument jest przeznaczony dla zespołu, który podejmie ten moduł — nie jest realizowany razem z Kreatorem pomysłów.

Stan na dziś: zrobiony jest punkt I (matchmaking, `docs/MATCHMAKING.md`), w realizacji punkt III (Kreator pomysłów). Panel administratora jest konsumentem danych tworzonych przez te moduły.

## Dlaczego to jest punktowane

Brief w sekcji 6 („Sposób testowania i/lub walidacji") pyta wprost: *„W jaki sposób system powiadamia administratora o nowym pomyśle i jak wygląda ścieżka odpowiedzi do autora?"*. To jest serce tego modułu i powinno być pierwszą rzeczą, którą widać na demo — ważniejszą niż kompletność CRUD-ów. Drugie zdanie z briefu, które wyznacza priorytet, to wymóg z punktu II: agregacja potrzeb i trendy widoczne **wyłącznie dla administratora**.

W kryteriach oceny moduł liczy się jako kolejna funkcjonalność (+5% w kryterium 40%) oraz podbija „potencjał wdrożeniowy" (20%), bo bez panelu ROPS nie ma jak utrzymywać treści.

## Uwierzytelnianie — pierwsza realna przeszkoda

Reszta platformy działa bez logowania. Kreator pomysłów autoryzuje edycję anonimowym `editToken` (sekret losowany przy tworzeniu, w bazie trzymany jako hash SHA-256, przesyłany w nagłówku `X-Edit-Token`). Dla panelu to nie wystarczy — potrzebna jest tożsamość z rolą.

Rekomendacja dla prototypu: osobny, minimalny moduł `auth` z logowaniem e-mail + hasło (Argon2), sesją w httpOnly cookie i jedną rolą `ADMIN`, plus `AdminGuard` nakładany na cały kontroler panelu. Konto zakładane wyłącznie seedem — bez publicznej rejestracji. To wystarcza na demo i nie zmusza do przebudowy Kreatora.

Wariant awaryjny na sam hackathon: statyczny `ADMIN_API_KEY` z `.env` weryfikowany w guardzie. Szybsze, ale nie da się pokazać „kto zatwierdził" w audycie, więc traci punkty za potencjał wdrożeniowy.

Czego nie robić: dopinania roli do `editToken`. Token jest sekretem per zasób, nie per użytkownik, i nie unieważnia się go bez usunięcia zasobu.

## Zakres funkcjonalny

### 1. Moderacja zgłoszeń i ścieżka odpowiedzi do autora

Najważniejsza część. Fiszka z Kreatora ma pole `status` zaprojektowane jako enum właśnie po to, żeby dało się je tu rozszerzyć bez migracji danych — do istniejących `DRAFT`/`PUBLISHED` dochodzą `SUBMITTED`, `IN_REVIEW`, `NEEDS_INFO`, `REJECTED`.

Przepływ: autor publikuje fiszkę → trafia do kolejki `SUBMITTED` → administrator ją otwiera (`IN_REVIEW`) → zatwierdza, odrzuca z uzasadnieniem albo prosi o uzupełnienie (`NEEDS_INFO`). Każda zmiana statusu może nieść wiadomość do autora.

Ścieżka powrotna do autora bez kont: wątek komentarzy przypięty do fiszki, widoczny dla autora po tym samym `X-Edit-Token`, którym edytuje fiszkę, oraz wysyłany na `contactEmail`, jeśli autor go podał. Autor odpowiada w tym samym wątku. Dzięki temu „ścieżka odpowiedzi" jest demonstrowalna bez budowania kont dla mieszkańców.

### 2. Powiadomienia

Brief wymaga automatyzacji powiadamiania o nowych pomysłach **oraz o zmianach w naborach** (sekcja 5).

- Do administratora: nowa fiszka, nowy wniosek złożony w naborze, odpowiedź autora w wątku. W panelu licznik nieprzeczytanych i feed; dodatkowo zbiorczy e-mail.
- Do autora: zmiana statusu fiszki, wiadomość od ROPS.
- Do subskrybentów: otwarcie naboru, zmiana terminu, zamknięcie. Subskrypcja przez sam adres e-mail z potwierdzeniem i linkiem wypisu — bez konta.

Implementacyjnie warto od razu wprowadzić interfejs `NotificationTransport` z implementacjami `LogTransport` (domyślna, zero konfiguracji — działa na demo) i `SmtpTransport` (włączana zmienną środowiskową). Wysyłka zawsze przez kolejkę rekordów `Notification` w bazie ze statusem `PENDING`/`SENT`/`FAILED`, nie strzałem w locie z requestu — inaczej padający SMTP wywraca zapis fiszki.

### 3. Zarządzanie naborami

CRUD na modelu `GrantCall` z Kreatora: nazwa, operator, opis, `opensAt`/`closesAt`, budżet, maksymalna kwota grantu i — najtrudniejsze — `sections`, czyli definicja pól wniosku w JSON. Edycja sekcji przez surowy JSON jest nieakceptowalna dla pracownika ROPS; potrzebny prosty builder (dodaj sekcję, typ pola, limit znaków, pytanie pomocnicze, wymagalność) z podglądem wniosku takim, jaki zobaczy wnioskodawca.

Reguła bezpieczeństwa: zmiana `sections` naboru z już złożonymi wnioskami musi tworzyć nową wersję definicji, a nie nadpisywać starą — inaczej złożone wnioski przestają się renderować.

Przegląd złożonych wniosków: lista per nabór, podgląd, eksport do CSV/Markdown.

### 4. Zarządzanie wiedzą (Zasobnik, punkt II)

Katalog innowacji żyje dziś w pliku `apps/api/src/modules/matchmaking/catalog.v1.json` — 15 rekordów wczytywanych przez `CatalogRepository`. Brief wymaga „sprawnej i szybkiej aktualizacji danych", a ROPS ma blisko 200 innowacji, więc katalog musi przejść do bazy.

Migracja: model `Innovation` w Prismie o kształcie zgodnym z `InnovationSchema` z `@repo/api-contracts`, jednorazowy import z JSON-a jako seed, podmiana `CatalogRepository` na odczyt z bazy przy zachowaniu sygnatury `findAll()`. Logika rankingu w `ranking.ts` i jej testy zostają nietknięte. Plik JSON zostaje w repo jako źródło seeda.

Dalej: CRUD innowacji z tagowaniem słownikami z `@repo/api-contracts`, pole na materiał wideo, zarządzanie materiałami edukacyjnymi i planszami Canw (te same, które Kreator serwuje przez `GET /materials`), publikacja/wycofanie.

### 5. Trendy potrzeb

Punkt II briefu, jawnie oznaczony jako widoczny wyłącznie dla administratora: agregacja zgłaszanych potrzeb w obszarach i wyznaczanie trendów.

Źródła: tagi z interpretacji matchmakingu oraz tagi fiszek z Kreatora. **Uwaga na konflikt z prywatnością** — `docs/MATCHMAKING.md` deklaruje, że opisy i wyniki nie są zapisywane do bazy ani logów, a użytkownik widzi tę informację przy formularzu. Agregacja wymaga więc zapisu wyłącznie zanonimizowanych liczników: `(data, obszar, potrzeba, odbiorca) → licznik`, bez treści opisu, bez identyfikatora sesji i bez możliwości odtworzenia pojedynczego zapytania. Komunikat przy formularzu matchmakingu trzeba wtedy zaktualizować.

Widok: najczęstsze potrzeby i obszary w oknie czasowym, zmiana względem poprzedniego okresu, rozbicie na regiony, eksport CSV. Wystarczą wykresy słupkowe — nie warto na tym etapie dokładać ciężkiej biblioteki wykresów.

### 6. Dziennik zdarzeń

Kto, kiedy i co zmienił: `AuditLog` z `actorId`, `action`, `entityType`, `entityId`, `metadata`, `createdAt`. Zapis przy każdej mutacji z panelu. Tani w implementacji, a wprost podbija „potencjał wdrożeniowy".

## Model danych do dołożenia

Na bazie schematu z Kreatora pomysłów:

- `AdminUser` — `email`, `passwordHash`, `role`, `isActive`, `lastLoginAt`.
- Rozszerzenie enuma `IdeaStatus` o `SUBMITTED`, `IN_REVIEW`, `NEEDS_INFO`, `REJECTED`.
- `IdeaReviewMessage` — `ideaId`, `authorType` (`ADMIN` | `SUBMITTER`), `adminUserId?`, `body`, `createdAt`, `readAt?`.
- `Notification` — `channel`, `recipient`, `template`, `payload Json`, `status`, `attempts`, `sentAt?`, `error?`.
- `CallSubscription` — `grantCallId?` (null = wszystkie nabory), `email`, `confirmedAt?`, `unsubscribeTokenHash`.
- `Innovation` — przeniesienie `catalog.v1.json` do bazy, kształt zgodny z `InnovationSchema`.
- `GrantCallSectionsVersion` — wersjonowanie definicji pól wniosku.
- `NeedTrendDaily` — zanonimizowane liczniki `(date, area, need, audience, region, count)`, klucz unikalny na komplecie wymiarów.
- `AuditLog` — jak wyżej.

## API

Moduł `apps/api/src/modules/admin/`, prefiks `/api/admin`, cały za `AdminGuard`, w układzie Controller → Service → Repository → Prisma zgodnie z `ai-rules/playbooks/03-api.md`. Kontrakty Zod w `packages/api-contracts/src/admin.schema.ts`, koperta `{ success, data | error }` jak w pozostałych modułach.

- `POST /admin/auth/login`, `POST /admin/auth/logout`, `GET /admin/auth/me`
- `GET /admin/ideas` z filtrem statusu, `POST /admin/ideas/:id/status`, `GET|POST /admin/ideas/:id/messages`
- `GET /admin/notifications`, `POST /admin/notifications/:id/read`
- `GET|POST|PATCH /admin/calls`, `GET /admin/calls/:id/applications`, `GET /admin/calls/:id/applications/export`
- `GET|POST|PATCH|DELETE /admin/innovations`, `GET|POST /admin/materials`
- `GET /admin/trends` z parametrami okna czasowego i wymiaru
- `GET /admin/audit-log`

Publicznie, poza guardem: `POST /calls/subscriptions` i `GET /calls/subscriptions/confirm`, `GET /calls/subscriptions/unsubscribe` — zapisy na powiadomienia o naborach. Po stronie autora fiszki: `GET|POST /ideas/:id/messages` autoryzowane nagłówkiem `X-Edit-Token`.

## Frontend

Feature `apps/web/src/app/features/admin/` pod trasą `/admin`, lazy-loaded, chroniony `authGuard` przekierowującym na `/admin/logowanie`. Standalone komponenty, Angular Material, wszystkie napisy przez ngx-translate w `apps/web/public/i18n/pl.json` w namespace `admin.*`.

Widoki: pulpit (liczniki i ostatnie zgłoszenia), kolejka moderacji z panelem bocznym podglądu i wątkiem odpowiedzi, nabory z builderem sekcji, wnioski, baza innowacji, materiały, trendy, dziennik zdarzeń.

Układ: osobna powłoka z `MatSidenav` zamiast obecnego `AppLayoutComponent` — panel ma inną nawigację niż część publiczna.

## Dostępność i bezpieczeństwo

Panel też podlega WCAG 2.1 AA — to kryterium z briefu nie wyłącza widoków administracyjnych. Tabele potrzebują nagłówków `scope`, sortowanie musi być obsługiwalne z klawiatury i ogłaszane, a zmiany statusu potwierdzane komunikatem w `aria-live`.

Bezpieczeństwo: ciasny rate limit na logowaniu (osobny `@Throttle`, znacznie poniżej globalnych 100/min z `app.module.ts`), cookie `httpOnly` + `SameSite=Strict` + `Secure` poza developmentem, ochrona CSRF dla mutacji, brak informacji w komunikacie błędu logowania o tym, czy konto istnieje. Zgodnie z sekcją 9 briefu w seedzie i materiałach demonstracyjnych nie mogą pojawić się prawdziwe dane osobowe.

## Proponowana kolejność prac

1. Moduł `auth` z rolą `ADMIN`, `AdminGuard`, seed konta, powłoka `/admin` z logowaniem. Bez tego nic dalej nie da się bezpiecznie wystawić.
2. Kolejka moderacji + wątek odpowiedzi do autora + feed powiadomień w panelu. To jest demo odpowiadające wprost na pytanie z sekcji 6 briefu.
3. Kolejka `Notification` z `LogTransport`, potem `SmtpTransport` i subskrypcje naborów.
4. Zarządzanie naborami z builderem sekcji i wersjonowaniem oraz przegląd wniosków.
5. Przeniesienie katalogu innowacji z `catalog.v1.json` do bazy i CRUD wiedzy wraz z materiałami.
6. Trendy potrzeb — dopiero po ustaleniu z zespołem, jak pogodzić agregację z deklaracją prywatności matchmakingu.
7. Dziennik zdarzeń — można wpinać przyrostowo od kroku 2.

## Zależności od Kreatora pomysłów

Panel nie ruszy przed scaleniem Kreatora, bo opiera się na jego modelach `Idea`, `GrantCall` i `Application` oraz na konwencji `editToken`. Elementy, których panel potrzebuje, a które Kreator już dostarcza: enum `IdeaStatus` zamiast flagi logicznej, `contactEmail` na fiszce, `GrantCall.sections` jako JSON, generyczny `ZodValidationPipe` i globalny filtr wyjątków w `apps/api/src/shared/`.

Jedyna zmiana w Kreatorze, o którą warto poprosić z wyprzedzeniem, to niewyświetlanie fiszek o statusie innym niż `PUBLISHED` w publicznej galerii — żeby włączenie moderacji nie wymagało przerabiania zapytań listujących.
