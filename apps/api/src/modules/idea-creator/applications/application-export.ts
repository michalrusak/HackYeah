import type {
  ApplicationAnswers,
  GrantCall,
  IdeaSummary,
} from '@repo/api-contracts';

function slugify(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ł/gi, 'l')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'wniosek'
  );
}

/**
 * Eksport wniosku do Markdown. Zachowuje kolejność i pytania sekcji naboru,
 * żeby dokument dało się wkleić do oficjalnego formularza operatora.
 */
export function buildApplicationExport(
  call: GrantCall,
  idea: IdeaSummary,
  answers: ApplicationAnswers,
): { filename: string; markdown: string } {
  const lines: string[] = [
    `# Wniosek: ${idea.title}`,
    '',
    `**Nabór:** ${call.name}`,
    `**Operator:** ${call.operator}`,
    `**Termin naboru:** ${call.opensAt.slice(0, 10)} – ${call.closesAt.slice(0, 10)}`,
  ];
  if (call.maxGrant) lines.push(`**Maksymalna kwota grantu:** ${call.maxGrant}`);
  lines.push('');

  for (const section of call.sections) {
    const answer = answers[section.id]?.trim();
    lines.push(`## ${section.title}`, '', `_${section.question}_`, '');
    lines.push(answer && answer.length > 0 ? answer : '_(do uzupełnienia)_');
    lines.push('');
  }

  lines.push(
    '---',
    '',
    'Dokument wygenerowany w Kreatorze pomysłów. Przed wysłaniem sprawdź limity znaków i wymagane załączniki w regulaminie naboru.',
    '',
  );

  return {
    filename: `wniosek-${slugify(idea.title)}.md`,
    markdown: lines.join('\n'),
  };
}
