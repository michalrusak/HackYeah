import { z } from "zod";
import { apiSuccessSchema } from "./response.types.js";

export const AudienceSchema = z.enum([
  "Osoby w spektrum autyzmu",
  "Seniorzy",
  "Dzieci, młodzież i rodzina",
  "Rynek pracy",
  "Osoby o ograniczonej mobilności",
  "Osoby z niepełnosprawnością sensoryczną",
  "Cudzoziemcy",
  "Osoby z niepełnosprawnością intelektualną",
  "Osoby w kryzysie bezdomności",
  "Zdrowie i medycyna",
]);
export const SocialAreaSchema = z.enum([
  "Rodzina i piecza zastępcza",
  "Bezdomność",
  "Niepełnosprawność",
  "Ubóstwo",
  "Integracja cudzoziemców",
  "Zdrowie",
  "Zdrowie psychiczne",
  "Seniorzy",
]);
export const NeedSchema = z.enum([
  "Relacje społeczne",
  "Aktywizacja społeczna",
  "Kompetencje cyfrowe",
  "Opieka domowa",
  "Wsparcie opiekunów",
  "Dostęp do usług",
  "Zdrowie psychiczne",
  "Wsparcie emocjonalne",
  "Powrót do szkoły",
  "Psychoedukacja",
  "Komunikacja międzykulturowa",
  "Integracja kulturowa",
  "Informacja o opiece zdrowotnej",
  "Rehabilitacja",
  "Ćwiczenie pamięci",
  "Prawa konsumenta",
  "Wsparcie rodziców adopcyjnych",
  "Kompetencje społeczne",
  "Aktywizacja zawodowa",
  "Dostępna komunikacja",
  "Dostęp do czytelnictwa",
]);
export const MAX_CLARIFICATION_ROUNDS = 3;
export const MATCHMAKING_RESULT_LIMIT = 5;
export const ClarificationAnswerSchema = z
  .object({
    question: z.string().trim().min(1).max(300),
    answer: z.string().trim().min(1).max(1000),
  })
  .strict();
export type ClarificationAnswer = z.infer<typeof ClarificationAnswerSchema>;
export const MatchmakingClarificationSchema = z
  .object({
    reason: z.enum(["no_matches", "too_many_matches"]),
    question: z.string().trim().min(1).max(300).nullable(),
    options: z.array(z.string().trim().min(1).max(180)).max(3).optional(),
    round: z.number().int().min(1).max(MAX_CLARIFICATION_ROUNDS),
    maxRounds: z.literal(MAX_CLARIFICATION_ROUNDS),
    totalMatches: z.number().int().nonnegative(),
  })
  .strict();
export type MatchmakingClarification = z.infer<
  typeof MatchmakingClarificationSchema
>;

export const MatchmakingRequestSchema = z
  .object({
    description: z.string().max(4000).trim().min(1),
    answers: z
      .array(ClarificationAnswerSchema)
      .max(MAX_CLARIFICATION_ROUNDS)
      .optional(),
  })
  .strict();

export const InterpretationSchema = z
  .object({
    summary: z.string().trim().min(1).max(800),
    audiences: z.array(AudienceSchema).max(10),
    areas: z.array(SocialAreaSchema).max(8),
    needs: z.array(NeedSchema).max(21),
    missingInformation: z.array(z.string().trim().min(1).max(300)).max(3),
    suggestedAnswers: z
      .array(z.string().trim().min(1).max(180))
      .max(3)
      .optional(),
  })
  .strict();

export const InnovationSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1),
    description: z.string().min(1),
    audiences: z.array(AudienceSchema).min(1),
    areas: z.array(SocialAreaSchema).min(1),
    needs: z.array(NeedSchema).min(1),
    sourceUrl: z
      .string()
      .url()
      .refine((url) => {
        const parsed = new URL(url);
        return (
          parsed.protocol === "https:" && parsed.hostname === "rops.krakow.pl"
        );
      }),
    verifiedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

export const InnovationCatalogSchema = z
  .object({
    version: z.literal(1),
    innovations: z.array(InnovationSchema).min(1),
  })
  .strict();

export const InnovationMatchSchema = InnovationSchema.extend({
  score: z.number().min(0).max(100),
  level: z.enum(["high", "medium", "partial"]),
  matchedNeeds: z.array(NeedSchema).min(1),
  explanation: z.string().min(1),
});

export const RelatedInformationSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string().min(1),
    summary: z.string().min(1),
    scope: z.enum(["national", "malopolska"]),
    sourceUrl: InnovationSchema.shape.sourceUrl,
    sourceLabel: z.string().min(1),
    verifiedAt: InnovationSchema.shape.verifiedAt,
    areas: z.array(SocialAreaSchema).min(1),
    needs: z.array(NeedSchema),
  })
  .strict();
export const InformationCatalogSchema = z
  .object({
    version: z.literal(1),
    information: z.array(RelatedInformationSchema).min(1),
  })
  .strict();

export const MatchmakingDataSchema = z
  .object({
    interpretation: InterpretationSchema,
    matches: z.array(InnovationMatchSchema).max(MATCHMAKING_RESULT_LIMIT),
    clarification: MatchmakingClarificationSchema.optional(),
    relatedInformation: z.array(RelatedInformationSchema).max(3),
    catalog: z
      .object({
        version: z.number().int().positive(),
        innovationCount: z.number().int().positive(),
      })
      .strict(),
  })
  .strict();
export const MatchmakingResponseSchema = apiSuccessSchema(
  MatchmakingDataSchema,
);

// The same closed vocabulary is sent to the provider and validated on return.
export const interpretationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "audiences",
    "areas",
    "needs",
    "missingInformation",
    "suggestedAnswers",
  ],
  properties: {
    summary: { type: "string", minLength: 1, maxLength: 800 },
    audiences: {
      type: "array",
      maxItems: 10,
      items: { type: "string", enum: AudienceSchema.options },
    },
    areas: {
      type: "array",
      maxItems: 8,
      items: { type: "string", enum: SocialAreaSchema.options },
    },
    needs: {
      type: "array",
      maxItems: 21,
      items: { type: "string", enum: NeedSchema.options },
    },
    suggestedAnswers: {
      type: "array",
      maxItems: 3,
      items: { type: "string", minLength: 1, maxLength: 180 },
    },
    missingInformation: {
      type: "array",
      maxItems: 3,
      items: { type: "string", minLength: 1, maxLength: 300 },
    },
  },
};

export const OpenRouterCompletionSchema = z.object({
  choices: z
    .array(
      z.object({
        finish_reason: z.string(),
        message: z.object({ content: z.string() }),
      }),
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().int().nonnegative(),
      completion_tokens: z.number().int().nonnegative(),
      total_tokens: z.number().int().nonnegative(),
    })
    .optional(),
});

export type Audience = z.infer<typeof AudienceSchema>;
export type SocialArea = z.infer<typeof SocialAreaSchema>;
export type Need = z.infer<typeof NeedSchema>;
export type MatchmakingRequest = z.infer<typeof MatchmakingRequestSchema>;
export type Interpretation = z.infer<typeof InterpretationSchema>;
export type Innovation = z.infer<typeof InnovationSchema>;
export type InnovationMatch = z.infer<typeof InnovationMatchSchema>;
export type MatchmakingData = z.infer<typeof MatchmakingDataSchema>;
export type RelatedInformation = z.infer<typeof RelatedInformationSchema>;
