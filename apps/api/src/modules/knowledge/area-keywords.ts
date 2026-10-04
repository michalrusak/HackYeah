import { SocialAreaSchema, type SocialArea } from '@repo/api-contracts';

// Rdzenie słów bez polskich znaków; fraza jest normalizowana tak samo przed porównaniem.
const KEYWORDS: Record<SocialArea, string[]> = {
  'Rodzina i piecza zastępcza': [
    'piecz',
    'rodzin',
    'rodzic',
    'adopc',
    'zastepcz',
    'dzieck',
    'dzieci',
  ],
  Bezdomność: ['bezdomn', 'nocleg', 'schronisk', 'eksmis'],
  Niepełnosprawność: [
    'niepelnospraw',
    'wozk',
    'gluch',
    'niewidom',
    'niedoslysz',
    'dostepnosc',
  ],
  Ubóstwo: ['ubostw', 'ubog', 'bied', 'zadluz', 'niedozywi'],
  'Integracja cudzoziemców': [
    'cudzoziem',
    'migra',
    'uchodz',
    'ukrain',
    'obcokraj',
  ],
  Zdrowie: [
    'chorob',
    'leczen',
    'lekar',
    'rehabilit',
    'medycz',
    'zdrowotn',
    'profilaktyk',
  ],
  'Zdrowie psychiczne': [
    'psychiczn',
    'psycholog',
    'psychiatr',
    'depres',
    'samoboj',
    'emocj',
    'terapi',
  ],
  Seniorzy: ['senior', 'starsz', 'emeryt', 'starzen', 'starosc'],
};

export function areasForPhrase(phrase: string): SocialArea[] {
  const text = phrase
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replaceAll('ł', 'l');
  return SocialAreaSchema.options.filter((area) =>
    KEYWORDS[area].some((keyword) => text.includes(keyword)),
  );
}
