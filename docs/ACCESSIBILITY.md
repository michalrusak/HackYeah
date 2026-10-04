# Dostępność Łącznika

Celem jest WCAG 2.1 poziom AA. Ten dokument opisuje wdrożone usprawnienia i sposób weryfikacji; nie jest deklaracją pełnej zgodności ani certyfikatem. Zgodność dotyczy całych stron i procesów, włącznie z ich treścią: https://www.w3.org/TR/WCAG21/#conformance-reqs.

## Zakres zmian

- Wszystkie widoki korzystają ze wspólnych reguł widocznego fokusu, zawijania przycisków i komunikatów, kolorów systemowych oraz ograniczenia animacji. Zachowano jasny motyw i boczną nawigację.
- Nawigacja aktualizuje tytuł strony i kieruje fokus do treści. Pomoc można zamknąć klawiszem Escape. Stronicowanie i daty mają polskie etykiety.
- Strony informacyjne, kontakt ROPS oraz stany ładowania/błędu szczegółów pomysłu i wniosku mają główny nagłówek. Dekoracyjne ikony nie dublują nazw kontrolek.
- Kreator używa dostępnych zakładek zamiast niepoprawnej struktury ARIA pionowego steppera. Wszystkie cztery kroki pozostają dostępne. Błąd prowadzi do właściwego kroku i pierwszego błędnego pola. Etykiety, limity i wskazówki są w tłumaczeniach.
- Asystent ma nazwany panel, zarządzanie fokusem, komunikaty i zwykłe przyciski pytań pomocniczych. Układ mieści się w wąskim oknie.
- Rozmowy ROPS są przyciskami dostępnymi z klawiatury. Formularz ma etykiety, autouzupełnianie danych osobowych, błędy i status wysyłania. Nieudana wysyłka zachowuje treść.
- Wniosek grantowy waliduje sekcje, wymaga sprawdzenia treści przed wysłaniem, zapisuje najnowsze odpowiedzi przed wysłaniem i przenosi fokus na potwierdzenie. Edycja lub wygenerowanie nowych odpowiedzi unieważnia wcześniejsze potwierdzenie sprawdzenia.
- Stopka prowadzi do `/dostepnosc` z instrukcją klawiatury i kontaktem do zgłaszania barier.

## Powtarzalne testy automatyczne

Uruchom aplikację pod `http://localhost:4200`. Testy wymagają zainstalowanego Chrome i Node. Zależności audytu są osobne od aplikacji:

```powershell
npm install --prefix tmp/a11y-tools --ignore-scripts --no-audit --no-fund playwright-core axe-core
$env:QA_TOOLS_PATH = Join-Path (Get-Location) 'tmp/a11y-tools'
$env:QA_OUTPUT = Join-Path (Get-Location) 'tmp/accessibility'
$env:CHROME_BIN = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
node scripts/accessibility/audit-pages.mjs
node scripts/accessibility/audit-flows.mjs
```

Na macOS/Linux ustaw te same zmienne dla swojej ścieżki Chrome. `WEB_URL` pozwala zmienić adres lokalnej aplikacji. Testy nie używają profilu przeglądarki użytkownika. Pierwszy skrypt odczytuje ekrany aplikacji, drugi podmienia odpowiedzi kluczowych API danymi testowymi i blokuje pozostałe zapisy. Nie wysyła wniosków, wiadomości ani zapytań do AI w prawdziwym backendzie.

Zakres: axe-core z tagami `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, szerokości 1280 i 320 CSS px, przepełnienie treści, formularze i błędy, stany z danymi oraz bez wyników, dialogi, fokus po walidacji, wysłanie testowego wniosku, pominięcie nawigacji, zwiększone odstępy tekstu i kolory wymuszone. Raporty zawierają także wyniki `incomplete`, które nie są automatycznym zaliczeniem. Szerokość 320 px sprawdza reflow, nie zastępuje wszystkich testów rzeczywistego powiększenia.

## Odbiór ręczny przed deklaracją zgodności

| Obszar WCAG              | Sprawdzenie                                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1.1, 1.3.1–1.3.5       | Trafność tekstów alternatywnych, kolejność czytania, etykiety, autouzupełnianie. Ocenić także treści tworzone przez użytkowników/AI.                                |
| 1.4.1, 1.4.3, 1.4.11     | Tekst min. 4,5:1, duży tekst min. 3:1, istotne granice kontrolek i stany min. 3:1. Sprawdzić elementy, dla których axe zwraca `incomplete`, oraz hover/fokus/błędy. |
| 1.4.4, 1.4.10, 1.4.12    | Rzeczywiste powiększenie przeglądarki 200% i 400%, powiększenie samego tekstu, odstępy, długie nazwy i odpowiedzi. Treści nie mogą znikać ani nakładać się.         |
| 2.1.1–2.1.2, 2.4.1–2.4.7 | Całe procesy wyłącznie klawiaturą, logiczny fokus, widoczny fokus, brak pułapek, powrót po zamknięciu dialogów.                                                     |
| 2.2, 2.3                 | Brak utraty danych przez timeouty, brak migania, ograniczone animacje. Zweryfikować przyszłe media i sesje.                                                         |
| 2.5.1–2.5.4              | Obsługa jednym wskaźnikiem i bez gestów złożonych; nazwa dostępności zawiera widoczny tekst.                                                                        |
| 3.1–3.3                  | Polski język, przewidywalność, konkretne błędy i instrukcje naprawy, sprawdzenie wniosku przed wysłaniem.                                                           |
| 4.1.1–4.1.3              | Semantyka DOM, nazwa/rola/stan, ogłaszanie statusów i błędów w NVDA + Firefox/Chrome oraz VoiceOver + Safari.                                                       |

Nie przeprowadzono odsłuchu w NVDA/VoiceOver ani testów z użytkownikami technologii asystujących. Zewnętrzna biblioteka ROPS, osadzone strony, pliki do pobrania oraz każda nowa treść wymagają osobnego sprawdzenia. Formularz kontaktu ROPS korzysta z istniejącej demonstracyjnej obsługi ról — stronę dostępności należy przed publicznym wdrożeniem uzupełnić o rzeczywisty, działający kanał kontaktu i formalną deklarację właściwą dla operatora.

## Utrzymanie

Nowa funkcjonalność powinna przejść test klawiatury, szerokości 320 px, błędów i oczekiwania na odpowiedź. Używaj semantycznych elementów HTML, widocznych etykiet, komunikatów w `pl.json`, statusów `role=status` i błędów `role=alert`. Nie ukrywaj błędów wyłącznie w konsoli i nie polegaj wyłącznie na kolorze. Przy zmianie procesu dodaj jego stan do skryptu audytu. Wynik „zero błędów axe” sam w sobie nie potwierdza zgodności WCAG.
