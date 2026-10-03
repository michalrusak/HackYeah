import {
  TesterProfileInputSchema,
  type TesterProfileInput,
} from '@repo/api-contracts';

const profiles: TesterProfileInput[] = [
  {
    displayName: 'Maja Nowak',
    city: 'Kraków',
    bio: 'Poruszam się na wózku. Chętnie sprawdzę dostępność miejsc, aplikacji i rozwiązań ułatwiających codzienną samodzielność.',
    skills: ['Testowanie dostępności', 'Dokładny opis barier'],
    resources: ['Wózek aktywny', 'Smartfon Android'],
    accessibilityNeeds:
      'Potrzebuję wejścia bez schodów i dostosowanej toalety.',
    interests: ['Dostępność miasta', 'Samodzielność'],
    availability: 'hybrid',
  },
  {
    displayName: 'Kamil Zieliński',
    city: 'Warszawa',
    bio: 'Mam wydajny komputer do grafiki 3D i obliczeń. Mogę sprawdzać prototypy aplikacji, narzędzia AI i wymagające symulacje.',
    skills: ['Testy wydajności', 'Python', 'Grafika 3D'],
    resources: [
      'Komputer stacjonarny RTX 4090',
      '64 GB RAM',
      'Internet światłowodowy',
    ],
    accessibilityNeeds: '',
    interests: ['Technologie społeczne', 'AI', 'Edukacja'],
    availability: 'remote',
  },
  {
    displayName: 'Anna Wójcik',
    city: 'Gdańsk',
    bio: 'Jestem osobą niewidomą i korzystam z czytnika ekranu. Mogę testować aplikacje i materiały edukacyjne obsługiwane bez wzroku.',
    skills: ['Testy z czytnikiem ekranu', 'Ocena dostępności dokumentów'],
    resources: ['iPhone z VoiceOver', 'Laptop z NVDA'],
    accessibilityNeeds:
      'Potrzebuję materiałów dostępnych dla czytnika ekranu i tekstowych opisów grafiki.',
    interests: ['Edukacja', 'Dostępne usługi cyfrowe'],
    availability: 'remote',
  },
  {
    displayName: 'Piotr Wiśniewski',
    city: 'Wrocław',
    bio: 'Jestem osobą słabosłyszącą. Chętnie sprawdzę napisy, komunikację tekstową i rozwiązania wspierające udział w wydarzeniach.',
    skills: ['Ocena napisów', 'Testowanie aplikacji komunikacyjnych'],
    resources: ['Smartfon Android', 'Laptop'],
    accessibilityNeeds:
      'Preferuję kontakt tekstowy i napisy podczas spotkań online.',
    interests: ['Kultura dostępna', 'Komunikacja'],
    availability: 'hybrid',
  },
  {
    displayName: 'Ewa Kamińska',
    city: 'Łódź',
    bio: 'Mam 68 lat. Korzystam ze smartfona i chcę sprawdzać, czy nowe usługi są zrozumiałe dla seniorów zaczynających przygodę z technologią.',
    skills: ['Ocena prostoty obsługi', 'Organizacja spotkań sąsiedzkich'],
    resources: ['Smartfon Android', 'Tablet'],
    accessibilityNeeds:
      'Wygodniej czytam duży tekst i instrukcje pisane prostym językiem.',
    interests: ['Relacje sąsiedzkie', 'Usługi dla seniorów'],
    availability: 'hybrid',
  },
  {
    displayName: 'Tomasz Lewandowski',
    city: 'Poznań',
    bio: 'Jestem rodzicem dwójki dzieci i prowadzę warsztaty w lokalnej świetlicy. Mogę testować narzędzia pomagające rodzicom i edukatorom.',
    skills: ['Prowadzenie warsztatów', 'Planowanie zajęć'],
    resources: ['Projektor', 'Laptop', 'Sala warsztatowa po uzgodnieniu'],
    accessibilityNeeds: '',
    interests: ['Wsparcie rodzin', 'Edukacja dzieci'],
    availability: 'onsite',
  },
  {
    displayName: 'Oliwia Mazur',
    city: 'Katowice',
    bio: 'Tworzę interaktywne materiały edukacyjne. Posiadam gogle VR i kontrolery, które mogę wykorzystać do testów prototypów społecznych.',
    skills: ['Testowanie VR', 'Projektowanie zajęć'],
    resources: ['Gogle Meta Quest 3', 'Kontrolery VR', 'Laptop do grafiki'],
    accessibilityNeeds: '',
    interests: ['Wirtualna rzeczywistość', 'Edukacja', 'Integracja społeczna'],
    availability: 'hybrid',
  },
  {
    displayName: 'Jakub Dąbrowski',
    city: 'Nowy Sącz',
    bio: 'Mieszkam poza centrum i działam w lokalnej grupie wolontariackiej. Chętnie sprawdzę rozwiązania ułatwiające transport i dostęp do usług na wsi.',
    skills: ['Koordynacja wolontariatu', 'Testy w terenie'],
    resources: ['Rower elektryczny', 'Smartfon Android'],
    accessibilityNeeds: '',
    interests: [
      'Transport lokalny',
      'Wolontariat',
      'Usługi na obszarach wiejskich',
    ],
    availability: 'onsite',
  },
  {
    displayName: 'Zofia Lis',
    city: 'Lublin',
    bio: 'Pracuję z polskim i ukraińskim tekstem. Pomagam oceniać, czy komunikaty dla osób przyjeżdżających do Polski są zrozumiałe i użyteczne.',
    skills: ['Język polski', 'Język ukraiński', 'Redakcja prostego języka'],
    resources: ['Laptop', 'Smartfon'],
    accessibilityNeeds: '',
    interests: ['Integracja międzykulturowa', 'Dostęp do informacji'],
    availability: 'remote',
  },
  {
    displayName: 'Michał Król',
    city: 'Kraków',
    bio: 'Jestem testerem oprogramowania. Sprawdzam obsługę klawiaturą i kontrast interfejsów oraz pomagam opisywać błędy w prototypach.',
    skills: ['Testy manualne', 'Dostępność WCAG', 'Raportowanie błędów'],
    resources: ['Laptop Windows', 'Telefon iOS', 'Telefon Android'],
    accessibilityNeeds: '',
    interests: ['Dostępność cyfrowa', 'Otwarte technologie'],
    availability: 'remote',
  },
];

export const testerSeedProfiles: TesterProfileInput[] = profiles.map(
  (profile) =>
    TesterProfileInputSchema.parse({
      ...profile,
    }),
);
