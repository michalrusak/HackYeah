import { RopsUrlSchema } from '@repo/api-contracts';

const EMBEDDABLE_ORIGINS = [
  'https://rops.krakow.pl',
  'https://obserwator.rops.krakow.pl',
];

/** Adres źródła, który wolno osadzić w ramce — wyłącznie strony ROPS. */
export function ropsEmbedHref(sourceUrl: string): string | null {
  const parsed = RopsUrlSchema.safeParse(sourceUrl);
  if (!parsed.success) return null;
  const url = new URL(parsed.data);
  return EMBEDDABLE_ORIGINS.includes(url.origin) ? url.href : null;
}
