import {
  AudienceSchema,
  NeedSchema,
  SocialAreaSchema,
  type Audience,
  type Idea,
  type IdeaKind,
  type IdeaStage,
  type IdeaStatus,
  type IdeaSummary,
  type Need,
  type SocialArea,
} from '@repo/api-contracts';

/**
 * Kształt wiersza potrzebny mapperowi. Własny interfejs zamiast typu z
 * wygenerowanego klienta Prismy pozwala testować mapowanie bez bazy.
 */
export interface IdeaRow {
  id: string;
  title: string;
  essence: string;
  problem: string;
  targetAudience: string;
  description: string;
  stage: string;
  kind: string;
  status: string;
  region: string;
  contactEmail: string | null;
  audiences: string[];
  areas: string[];
  needs: string[];
  plainLanguageSummary: string | null;
  editTokenHash: string;
  adoptedFromId: string | null;
  createdAt: Date;
  updatedAt: Date;
  visuals?: { id: string; altText: string }[];
  canvas?: { id: string } | null;
}

const AUDIENCES = new Set<string>(AudienceSchema.options);
const AREAS = new Set<string>(SocialAreaSchema.options);
const NEEDS = new Set<string>(NeedSchema.options);

// Tagi spoza zamkniętego słownika są odrzucane, tak samo jak w matchmakingu.
export function toAudiences(values: string[]): Audience[] {
  return values.filter((value): value is Audience => AUDIENCES.has(value));
}

export function toAreas(values: string[]): SocialArea[] {
  return values.filter((value): value is SocialArea => AREAS.has(value));
}

export function toNeeds(values: string[]): Need[] {
  return values.filter((value): value is Need => NEEDS.has(value));
}

export function toIdea(row: IdeaRow): Idea {
  const visual = row.visuals?.[0] ?? null;
  return {
    id: row.id,
    title: row.title,
    essence: row.essence,
    problem: row.problem,
    targetAudience: row.targetAudience,
    description: row.description,
    stage: row.stage as IdeaStage,
    kind: row.kind as IdeaKind,
    status: row.status as IdeaStatus,
    region: row.region,
    // Adres kontaktowy nie opuszcza backendu — na zewnątrz idzie sama flaga.
    hasContact: Boolean(row.contactEmail),
    audiences: toAudiences(row.audiences),
    areas: toAreas(row.areas),
    needs: toNeeds(row.needs),
    adoptedFromId: row.adoptedFromId,
    plainLanguageSummary: row.plainLanguageSummary,
    visualId: visual?.id ?? null,
    visualAltText: visual?.altText ?? null,
    hasCanvas: Boolean(row.canvas),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toIdeaSummary(row: IdeaRow): IdeaSummary {
  const idea = toIdea(row);
  return {
    id: idea.id,
    title: idea.title,
    essence: idea.essence,
    targetAudience: idea.targetAudience,
    stage: idea.stage,
    kind: idea.kind,
    region: idea.region,
    audiences: idea.audiences,
    areas: idea.areas,
    needs: idea.needs,
    visualId: idea.visualId,
    visualAltText: idea.visualAltText,
    createdAt: idea.createdAt,
  };
}
