import { z } from "zod";
import {
  AudienceSchema,
  NeedSchema,
  SocialAreaSchema,
} from "./matchmaking.schema.js";

export const KnowledgeKindSchema = z.enum([
  "challenge",
  "report",
  "innovation",
  "education",
]);
export const KnowledgeScopeSchema = z.enum([
  "national",
  "malopolska",
  "general",
]);
export const KnowledgeStatusSchema = z.enum(["draft", "published"]);
export const NeedSourceSchema = z.enum([
  "matchmaking",
  "search",
  "browse",
  "form",
]);
export const RopsUrlSchema = z
  .string()
  .url()
  .max(2000)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        ["rops.krakow.pl", "obserwator.rops.krakow.pl"].includes(
          url.hostname,
        ) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  });
export function youtubeId(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    const id =
      url.hostname === "youtu.be"
        ? url.pathname.slice(1)
        : ["www.youtube.com", "youtube.com"].includes(url.hostname) &&
            url.pathname === "/watch"
          ? url.searchParams.get("v")
          : null;
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
export const YoutubeUrlSchema = z
  .string()
  .max(200)
  .refine((value) => youtubeId(value) !== null);
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(value);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  });
const unique = <T>(items: T[]): T[] => [...new Set(items)];
export const KnowledgeFactSchema = z
  .object({
    value: z.string().trim().min(1).max(24),
    label: z.string().trim().min(1).max(160),
  })
  .strict();
export const KnowledgeInputSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/),
    title: z.string().trim().min(1).max(180),
    summary: z.string().trim().min(1).max(2000),
    kind: KnowledgeKindSchema,
    scope: KnowledgeScopeSchema,
    areas: z.array(SocialAreaSchema).min(1).max(8).transform(unique),
    audiences: z.array(AudienceSchema).max(9).transform(unique),
    needs: z.array(NeedSchema).max(21).transform(unique),
    sourceUrl: RopsUrlSchema,
    sourceLabel: z.string().trim().min(1).max(200),
    verifiedAt: dateSchema,
    publicationYear: z.number().int().min(1900).max(2100).nullable(),
    videoPageUrl: RopsUrlSchema.nullable(),
    videoUrl: YoutubeUrlSchema.nullable().default(null),
    facts: z.array(KnowledgeFactSchema).max(6).default([]),
    status: KnowledgeStatusSchema,
  })
  .strict()
  .superRefine((item, ctx) => {
    if (
      item.kind === "innovation" &&
      (!item.audiences.length || !item.needs.length)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Innowacja wymaga odbiorców i potrzeb.",
      });
    }
    if (
      item.kind === "innovation" &&
      !item.sourceUrl.startsWith("https://rops.krakow.pl/")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sourceUrl"],
        message: "Innowacja wymaga źródła w bibliotece ROPS.",
      });
    }
    if (item.verifiedAt > new Date().toISOString().slice(0, 10)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["verifiedAt"],
        message: "Data weryfikacji nie może być przyszła.",
      });
    }
  });
export const KnowledgeResourceSchema = z
  .object({
    ...KnowledgeInputSchema.innerType().shape,
    revision: z.number().int().positive(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export const KnowledgeUpdateSchema = z
  .object({
    resource: KnowledgeInputSchema,
    revision: z.number().int().positive(),
  })
  .strict();
export const KnowledgeQuerySchema = z
  .object({
    q: z.string().trim().max(200).default(""),
    kind: KnowledgeKindSchema.optional(),
    area: SocialAreaSchema.optional(),
    audience: AudienceSchema.optional(),
    scope: KnowledgeScopeSchema.optional(),
    video: z.literal("1").optional(),
    // Tylko panel administratora; publiczne API zawsze zwraca opublikowane zasoby.
    status: KnowledgeStatusSchema.optional(),
    stale: z.literal("1").optional(),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    pageSize: z.coerce.number().int().min(1).max(30).default(12),
  })
  .strict();
export const KnowledgeListSchema = z
  .object({
    resources: z.array(KnowledgeResourceSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
  })
  .strict();
export const KnowledgeOverviewSchema = z
  .object({
    total: z.number().int().nonnegative(),
    areas: z.array(
      z
        .object({
          area: SocialAreaSchema,
          count: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    updatedAt: z.string().datetime().nullable(),
  })
  .strict();
export const KnowledgeSummarySchema = z
  .object({
    published: z.number().int().nonnegative(),
    draft: z.number().int().nonnegative(),
    stale: z.number().int().nonnegative(),
    staleBefore: dateSchema,
  })
  .strict();
export const NeedSignalSchema = z
  .object({
    id: z.string().uuid(),
    areas: z.array(SocialAreaSchema).min(1).max(8).transform(unique),
    needs: z.array(NeedSchema).max(21).transform(unique),
    consent: z.literal(true),
  })
  .strict();
export const AcknowledgementSchema = z
  .object({ accepted: z.literal(true) })
  .strict();
export const AdminLoginSchema = z
  .object({ password: z.string().min(1).max(256) })
  .strict();
export const AdminSessionSchema = z
  .object({ csrfToken: z.string().min(32), expiresAt: z.string().datetime() })
  .strict();
export const KnowledgeImportSchema = z
  .object({ resources: z.array(KnowledgeInputSchema).min(1).max(100) })
  .strict()
  .refine(
    (value) =>
      new Set(value.resources.map((item) => item.id)).size ===
      value.resources.length,
  );
export const ImportResultSchema = z
  .object({ imported: z.number().int().nonnegative() })
  .strict();
export const KnowledgeTrendsSchema = z
  .object({
    from: dateSchema,
    until: dateSchema,
    currentTotal: z.number().int().nonnegative(),
    previousTotal: z.number().int().nonnegative(),
    areas: z.array(
      z
        .object({
          area: SocialAreaSchema,
          current: z.number().int().nonnegative(),
          previous: z.number().int().nonnegative(),
          rising: z.boolean(),
        })
        .strict(),
    ),
    sources: z.array(
      z
        .object({
          source: NeedSourceSchema,
          count: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    phrases: z.array(
      z
        .object({ phrase: z.string(), count: z.number().int().positive() })
        .strict(),
    ),
    needs: z.array(
      z
        .object({ need: NeedSchema, count: z.number().int().nonnegative() })
        .strict(),
    ),
    daily: z.array(
      z
        .object({ day: dateSchema, count: z.number().int().nonnegative() })
        .strict(),
    ),
  })
  .strict();
export type KnowledgeInput = z.infer<typeof KnowledgeInputSchema>;
export type KnowledgeResource = z.infer<typeof KnowledgeResourceSchema>;
export type KnowledgeQuery = z.infer<typeof KnowledgeQuerySchema>;
export type KnowledgeList = z.infer<typeof KnowledgeListSchema>;
export type KnowledgeOverview = z.infer<typeof KnowledgeOverviewSchema>;
export type KnowledgeSummary = z.infer<typeof KnowledgeSummarySchema>;
export type KnowledgeTrends = z.infer<typeof KnowledgeTrendsSchema>;
export type NeedSignal = z.infer<typeof NeedSignalSchema>;
export type NeedSource = z.infer<typeof NeedSourceSchema>;
export type AdminSession = z.infer<typeof AdminSessionSchema>;
