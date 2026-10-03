import type { AdaptationData } from '@repo/api-contracts';

const guide =
  'https://innowacjewsamorzadzie.pl/wp-content/uploads/2026/06/16.2_Mobilne_Centrum_Pomocy_dla_Osob_Starszych_Instrukcja.pdf';
export const adaptationSources: AdaptationData['sources'] = [
  {
    id: 'rops',
    label: 'ROPS Kraków — Mobilne centrum pomocy dla osób starszych',
    url: 'https://rops.krakow.pl/innowacje-spoleczne/biblioteka-innowacji-spolecznych/dla-seniorow%2Cmobilne-centrum-pomocy-dla-osob-starszych',
  },
  {
    id: 'individual',
    label: 'Instrukcja wdrożenia — s. 12 i 18: indywidualne wsparcie',
    url: `${guide}#page=12`,
  },
  {
    id: 'resources',
    label: 'Instrukcja wdrożenia — s. 24–27: zasoby i przygotowanie',
    url: `${guide}#page=24`,
  },
  {
    id: 'team',
    label: 'Instrukcja wdrożenia — s. 28: zespół',
    url: `${guide}#page=28`,
  },
];

// Curated evidence, reviewed 2026-10-03. Model never supplies source URLs.
// Innovation: Stowarzyszenie „Klucz”, oddział Pałecznica. Guide: Fundacja
// Fundusz Współpracy, based on Małopolski Inkubator Innowacji Społecznych, CC BY 4.0.
export const adaptationEvidence = `
[rops] Mobilne centrum pomocy wspiera seniorów o ograniczonej samodzielności,
szczególnie na wsi. Usługi docierają do ich domów. Autor: Stowarzyszenie „Klucz”,
oddział Pałecznica. Wdrożenie mogą prowadzić samorządy, OPS i NGO.
[individual] Dobór usług wynika z indywidualnej diagnozy i planu działania.
Pakiety można dostosować do lokalnych potrzeb. Zachowaj dostęp do wsparcia
w domu i sprawczość seniora; spotkania grupowe nie zastępują wizyt domowych.
[resources] Instrukcja zaleca konsultanta minimum 0,25 etatu na 10 uczestników.
To zalecenie modelu, nie ustawowy próg ani dowód, że mniejszy pilotaż jest wykonalny.
Należy rozpoznać potrzeby, zasoby i partnerów oraz wskazać operatora.
Wolontariusze wymagają przygotowania i koordynacji. Zaplanuj bezpieczną organizację
wizyt, uzgodnienie zasad i przestrzeń dla zespołu, także w istniejącym lokalu.
[team] Konsultant może być obecnym pracownikiem o odpowiednich kompetencjach.
Specjalistów dobiera się do potrzeb i budżetu. Wolontariusz nie zastępuje
kwalifikacji specjalisty. Warunki konkretnego konkursu nie są uniwersalnymi
warunkami wdrożenia. Brak w tych źródłach aktualnych stawek i ofert partnerów.
`;
