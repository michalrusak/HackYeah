import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { Pool } from 'pg';

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
config({ path: path.join(apiDir, '../../.env') });
config({ path: path.join(apiDir, '.env') });

// Wszystkie dane są fikcyjne. Brief ROPS (sekcja 9) zabrania używania
// prawdziwych danych osobowych i wrażliwych w prototypie.
const ideas = [
  {
    id: 'seed-idea-sasiedzka-lawka',
    title: 'Sąsiedzka ławka rozmów',
    essence:
      'Oznaczone ławki w przestrzeni publicznej, przy których siadają osoby otwarte na rozmowę z nieznajomym. Prosty sygnał wizualny zastępuje trudny pierwszy krok.',
    problem:
      'Starsi mieszkańcy małych gmin spędzają większość dnia samotnie. Istniejące kluby seniora wymagają zapisów i regularności, przez co odpadają osoby nieśmiałe lub rzadko wychodzące z domu.',
    targetAudience:
      'Osoby powyżej 65. roku życia mieszkające samotnie, a także młodsi mieszkańcy chcący pomóc, ale niewiedzący, jak zacząć rozmowę.',
    description:
      'Gmina wyznacza cztery ławki w miejscach o naturalnym ruchu pieszym: przy bibliotece, ośrodku zdrowia, targu i kościele. Każda ma tabliczkę z czytelnym opisem i piktogramem. Raz w tygodniu dyżuruje przeszkolony wolontariusz, żeby inicjatywa nie zgasła po pierwszym miesiącu.',
    stage: 'TEST_MIKROSKALA',
    kind: 'GOOD_PRACTICE',
    region: 'powiat przykładowy',
    audiences: ['Seniorzy'],
    areas: ['Seniorzy'],
    needs: ['Relacje społeczne', 'Aktywizacja społeczna'],
  },
  {
    id: 'seed-idea-cyfrowy-wnuk',
    title: 'Cyfrowy wnuk na dyżurze',
    essence:
      'Uczniowie szkoły średniej prowadzą stały dyżur w bibliotece i pomagają seniorom w jednej konkretnej sprawie cyfrowej na raz: e-recepta, bankowość, wideorozmowa.',
    problem:
      'Kursy komputerowe dla seniorów uczą ogólnych umiejętności, które szybko się zapominają. Mieszkańcy potrzebują pomocy w konkretnym momencie, w którym utknęli przy urzędowej sprawie.',
    targetAudience:
      'Seniorzy bez doświadczenia cyfrowego oraz ich opiekunowie, którzy dziś wykonują te czynności za nich.',
    description:
      'Dyżur trwa dwie godziny dwa razy w tygodniu. Uczniowie dostają za to wolontariat wliczany do oceny z zachowania, a biblioteka udostępnia stanowisko z dużym monitorem.',
    stage: 'WDROZONE',
    kind: 'GOOD_PRACTICE',
    region: 'gmina przykładowa',
    audiences: ['Seniorzy', 'Dzieci, młodzież i rodzina'],
    areas: ['Seniorzy'],
    needs: ['Kompetencje cyfrowe', 'Dostęp do usług', 'Relacje społeczne'],
  },
  {
    id: 'seed-idea-mapa-dostepnosci',
    title: 'Mapa dostępności rysowana przez mieszkańców',
    essence:
      'Mieszkańcy z ograniczoną mobilnością zgłaszają przeszkody w przestrzeni publicznej przez formularz z jednym zdjęciem i jednym zdaniem, a gmina dostaje gotową listę punktów do naprawy.',
    problem:
      'Audyty dostępności są drogie i robione raz na kilka lat. Codzienne bariery, jak wysoki krawężnik czy zepsuty podjazd, nie trafiają nigdzie poza rozmowy sąsiedzkie.',
    targetAudience:
      'Osoby poruszające się na wózku, rodzice z wózkami dziecięcymi oraz urzędnicy odpowiedzialni za inwestycje drogowe.',
    description:
      'Zgłoszenie zajmuje poniżej minuty. Co kwartał powstaje zestawienie z priorytetami ustalanymi przez liczbę zgłoszeń, nie przez kolejność wpłynięcia.',
    stage: 'PROTOTYP',
    kind: 'IDEA',
    region: 'miasto przykładowe',
    audiences: ['Osoby o ograniczonej mobilności'],
    areas: ['Niepełnosprawność'],
    needs: ['Dostęp do usług', 'Aktywizacja społeczna'],
  },
  {
    id: 'seed-idea-przewodnik-przychodnia',
    title: 'Przewodnik po przychodni w dwóch językach',
    essence:
      'Zestaw ilustrowanych kart opisujących krok po kroku wizytę u lekarza rodzinnego, po polsku i po ukraińsku, wykładany w rejestracji.',
    problem:
      'Rodziny z doświadczeniem migracji mają prawo do publicznej opieki zdrowotnej, ale nie znają procedury: jak wybrać lekarza, co to jest deklaracja, gdzie odebrać skierowanie.',
    targetAudience:
      'Rodziny z doświadczeniem migracji korzystające z publicznej opieki zdrowotnej oraz personel rejestracji.',
    description:
      'Karty są projektowane tak, żeby dało się je zrozumieć bez czytania całości: piktogram, jedno zdanie, numer kroku. Wersja do druku jest czarno-biała, żeby każda przychodnia mogła ją wydrukować u siebie.',
    stage: 'TEST_MIKROSKALA',
    kind: 'GOOD_PRACTICE',
    region: 'miasto przykładowe',
    audiences: ['Cudzoziemcy', 'Zdrowie i medycyna'],
    areas: ['Integracja cudzoziemców', 'Zdrowie'],
    needs: [
      'Informacja o opiece zdrowotnej',
      'Komunikacja międzykulturowa',
      'Dostęp do usług',
    ],
  },
  {
    id: 'seed-idea-skrzynka-powrotu',
    title: 'Skrzynka powrotu do klasy',
    essence:
      'Pudełko z materiałami dla nauczyciela, rodzica i klasy, przygotowujące grupę na powrót ucznia po długiej nieobecności zdrowotnej.',
    problem:
      'Uczeń wracający po leczeniu trafia do klasy, która nie wie, jak się zachować. Nauczyciele improwizują, a dziecko często rezygnuje po kilku dniach.',
    targetAudience:
      'Uczniowie w wieku 10-13 lat wracający po długiej nieobecności, ich rodzice, wychowawcy i rówieśnicy.',
    description:
      'Skrzynka zawiera scenariusz godziny wychowawczej, list do rodziców i zestaw ćwiczeń dla klasy. Nie wymaga obecności psychologa, bo w małych szkołach go po prostu nie ma.',
    stage: 'POMYSL',
    kind: 'IDEA',
    region: 'powiat przykładowy',
    audiences: ['Dzieci, młodzież i rodzina'],
    areas: ['Zdrowie psychiczne', 'Rodzina i piecza zastępcza'],
    needs: ['Powrót do szkoły', 'Psychoedukacja', 'Wsparcie emocjonalne'],
  },
  {
    id: 'seed-idea-wytchnienie-opiekuna',
    title: 'Cztery godziny wytchnienia',
    essence:
      'Sąsiedzka sieć zastępstw dająca opiekunowi osoby zależnej cztery godziny wolnego w tygodniu, bez formalności i bez orzeczenia.',
    problem:
      'Opiekunowie rodzinni nie korzystają z opieki wytchnieniowej, bo wnioski wymagają dokumentów i czekania. Potrzebują kilku godzin w konkretnym tygodniu, a nie turnusu za pół roku.',
    targetAudience:
      'Osoby opiekujące się na co dzień bliskim z niepełnosprawnością lub w podeszłym wieku.',
    description:
      'Koordynator z ośrodka pomocy łączy opiekunów w pary i szkoli ich wzajemnie. Para wymienia się dyżurami, więc koszt sprowadza się do czasu koordynatora.',
    stage: 'SKALOWANIE',
    kind: 'GOOD_PRACTICE',
    region: 'gmina przykładowa',
    audiences: ['Seniorzy', 'Osoby z niepełnosprawnością intelektualną'],
    areas: ['Niepełnosprawność', 'Seniorzy'],
    needs: ['Wsparcie opiekunów', 'Opieka domowa', 'Wsparcie emocjonalne'],
  },
];

const sections = [
  {
    id: 'opis-innowacji',
    title: 'Opis innowacji',
    question:
      'Na czym polega Twoje rozwiązanie? Opisz je tak, jakbyś tłumaczył je osobie spoza branży.',
    help: 'Unikaj ogólników. Napisz, co dokładnie się wydarzy i kto to zrobi.',
    maxLength: 2500,
    required: true,
    order: 1,
  },
  {
    id: 'problem',
    title: 'Problem i jego skala',
    question:
      'Jaki problem społeczny rozwiązujesz i skąd wiesz, że on istnieje?',
    help: 'Podaj źródło: obserwacja, rozmowy z odbiorcami, dane z instytucji.',
    maxLength: 2000,
    required: true,
    order: 2,
  },
  {
    id: 'odbiorcy',
    title: 'Odbiorcy',
    question: 'Kto skorzysta z rozwiązania i ilu osób dotyczy test?',
    help: 'Opisz odbiorcę bezpośredniego i pośredniego.',
    maxLength: 1500,
    required: true,
    order: 3,
  },
  {
    id: 'innowacyjnosc',
    title: 'Na czym polega innowacyjność',
    question:
      'Czym Twoje rozwiązanie różni się od tego, co już funkcjonuje w regionie?',
    help: 'Wskaż konkretną różnicę, nie deklarację nowatorskości.',
    maxLength: 1500,
    required: true,
    order: 4,
  },
  {
    id: 'test',
    title: 'Plan testu w mikroskali',
    question: 'Jak przetestujesz rozwiązanie i po czym poznasz, że działa?',
    help: 'Podaj czas trwania, liczbę uczestników i mierzalny wskaźnik.',
    maxLength: 2500,
    required: true,
    order: 5,
  },
  {
    id: 'budzet',
    title: 'Budżet i zasoby',
    question: 'Jakie koszty i zasoby są potrzebne do przeprowadzenia testu?',
    help: 'Wymień główne pozycje. Szczegółowy kosztorys dołączysz później.',
    maxLength: 1500,
    required: true,
    order: 6,
  },
];

const day = 24 * 60 * 60 * 1000;

function randomTokenHash() {
  return createHash('sha256').update(randomBytes(32)).digest('hex');
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Brak DATABASE_URL. Uruchom pnpm setup i pnpm docker:up.');
  }
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const idea of ideas) {
      await client.query(
        `INSERT INTO "Idea" (
           "id", "title", "essence", "problem", "targetAudience", "description",
           "stage", "kind", "status", "region", "audiences", "areas", "needs",
           "editTokenHash", "updatedAt"
         ) VALUES ($1,$2,$3,$4,$5,$6,$7::"IdeaStage",$8::"IdeaKind",'PUBLISHED',$9,$10,$11,$12,$13, NOW())
         ON CONFLICT ("id") DO NOTHING`,
        [
          idea.id,
          idea.title,
          idea.essence,
          idea.problem,
          idea.targetAudience,
          idea.description,
          idea.stage,
          idea.kind,
          idea.region,
          idea.audiences,
          idea.areas,
          idea.needs,
          randomTokenHash(),
        ],
      );
    }

    const now = Date.now();
    const calls = [
      {
        id: 'seed-call-otwarty',
        name: 'Nabór na innowacje społeczne — edycja wiosenna',
        operator: 'Przykładowy Operator Innowacji (dane fikcyjne)',
        description:
          'Nabór na testowanie w mikroskali nowych rozwiązań odpowiadających na wyzwania zdiagnozowane w regionie. Finansujemy przygotowanie i przetestowanie prototypu, nie wdrożenie na pełną skalę.',
        opensAt: new Date(now - 7 * day),
        closesAt: new Date(now + 21 * day),
        budget: '600 000 zł',
        maxGrant: '50 000 zł',
      },
      {
        id: 'seed-call-zamkniety',
        name: 'Nabór na innowacje dostępnościowe — edycja zakończona',
        operator: 'Przykładowy Operator Innowacji (dane fikcyjne)',
        description:
          'Zakończony nabór na rozwiązania zwiększające dostępność usług publicznych. Pozostawiony w systemie jako archiwum i przykład formularza.',
        opensAt: new Date(now - 180 * day),
        closesAt: new Date(now - 120 * day),
        budget: '400 000 zł',
        maxGrant: '40 000 zł',
      },
    ];

    for (const call of calls) {
      await client.query(
        `INSERT INTO "GrantCall" (
           "id", "name", "operator", "description", "opensAt", "closesAt",
           "budget", "maxGrant", "sections", "isPublished", "updatedAt"
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb, true, NOW())
         ON CONFLICT ("id") DO NOTHING`,
        [
          call.id,
          call.name,
          call.operator,
          call.description,
          call.opensAt,
          call.closesAt,
          call.budget,
          call.maxGrant,
          JSON.stringify(sections),
        ],
      );
    }

    await client.query('COMMIT');
    console.log(
      `Seed zakończony: ${ideas.length} fiszek i ${calls.length} nabory.`,
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

await main();
