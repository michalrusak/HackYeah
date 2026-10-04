import type {
  DemoAccountRole,
  ExpertGrantRequest,
  TesterProfileInput,
  TesterProjectInput,
} from '@repo/api-contracts';

// Wszystkie dane są fikcyjne — brief ROPS zabrania prawdziwych danych osobowych.
export const demoAccounts: { login: string; role: DemoAccountRole }[] = [
  { login: 'demo-tester', role: 'tester' },
  { login: 'demo-organizator', role: 'organizer' },
  { login: 'demo-ekspert', role: 'expert' },
];

export const demoExpertName = 'Ekspert demonstracyjny';

// Podpowiedź do formularza „Nadaj rolę eksperta” w panelu administratora.
export const demoExpertGrant: ExpertGrantRequest = {
  login: 'demo-organizator',
  name: 'Drugi ekspert demonstracyjny',
  areas: ['Seniorzy', 'Zdrowie psychiczne'],
};

export const demoProfile: TesterProfileInput = {
  displayName: 'Tester demonstracyjny',
  city: 'Kraków',
  bio: 'Fikcyjny profil demonstracyjny. Sprawdzam, czy nowe usługi są zrozumiałe dla osób starszych i ich opiekunów.',
  skills: ['Ocena prostoty obsługi', 'Rozmowy z seniorami'],
  resources: ['Smartfon Android', 'Laptop'],
  accessibilityNeeds: '',
  interests: ['Seniorzy', 'Usługi sąsiedzkie'],
  availability: 'hybrid',
};

export const demoProject: TesterProjectInput & { id: string } = {
  id: '5f0d3e1a-7c2b-4a8e-9b1d-2e6f4a7c9d01',
  organizerName: 'Zespół demonstracyjny (fikcyjny)',
  title: 'Telefon zaufania sąsiedzkiego — test rozmów (demo)',
  description:
    'Fikcyjne ogłoszenie demonstracyjne. Szukamy osób, które sprawdzą scenariusz cotygodniowej rozmowy telefonicznej wolontariusza z samotnym seniorem i ocenią, czy instrukcja jest zrozumiała.',
  requirements:
    'Dwie rozmowy po 20 minut w ciągu tygodnia i krótka opinia. Nie podawaj danych prawdziwych osób.',
  location: 'Kraków',
  mode: 'hybrid',
  stage: 'prototype',
  status: 'open',
};

export const demoApplicationMessage =
  'Chętnie sprawdzę scenariusz rozmowy. Mam doświadczenie w pracy z seniorami (zgłoszenie fikcyjne).';

export const demoConversation = {
  id: 'demo-conversation-mentor',
  firstName: 'Jan',
  lastName: 'Demonstracyjny',
  organization: 'Fikcyjne Stowarzyszenie Sąsiedzkie',
  category: 'MENTOR',
  area: 'Seniorzy',
  subject: 'Szukam mentora do testu usługi dla seniorów (demo)',
  initialMessage:
    'Przygotowujemy test cotygodniowych rozmów telefonicznych z samotnymi seniorami. Jak dobrać wskaźnik, który pokaże, że usługa zmniejsza poczucie samotności? Wiadomość fikcyjna, przygotowana na potrzeby demo.',
} as const;

export const demoIdea = {
  id: 'demo-idea-telefon-sasiedzki',
  title: 'Telefon zaufania sąsiedzkiego (demo)',
  essence:
    'Przeszkoleni wolontariusze raz w tygodniu dzwonią do samotnych seniorów z tej samej gminy. Stała pora i ten sam rozmówca budują relację bez wychodzenia z domu.',
  problem:
    'Seniorzy o ograniczonej mobilności nie docierają do klubów seniora, a ośrodek pomocy nie ma zasobów na regularne wizyty. Zgłoszenie fikcyjne, przygotowane na potrzeby demo.',
  targetAudience:
    'Osoby powyżej 70. roku życia mieszkające samotnie oraz wolontariusze z tej samej miejscowości.',
  description:
    'Koordynator z ośrodka pomocy łączy wolontariusza z seniorem i raz w miesiącu zbiera krótką informację zwrotną od obu stron.',
  stage: 'POMYSL',
  kind: 'IDEA',
  region: 'gmina przykładowa',
  audiences: ['Seniorzy'],
  areas: ['Seniorzy'],
  needs: ['Relacje społeczne', 'Wsparcie emocjonalne'],
} as const;
