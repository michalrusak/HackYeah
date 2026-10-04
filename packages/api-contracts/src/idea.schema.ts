import { z } from "zod";
import { apiSuccessSchema } from "./response.types.js";
import {
  AudienceSchema,
  NeedSchema,
  SocialAreaSchema,
} from "./matchmaking.schema.js";

/** Etap realizacji pomysłu — „na jakim etapie jest jego realizacji” z fiszki. */
export const IdeaStageSchema = z.enum([
  "POMYSL",
  "PROTOTYP",
  "TEST_MIKROSKALA",
  "WDROZONE",
  "SKALOWANIE",
]);

/** Fiszka zgłaszana oddolnie vs. prezentowana dobra praktyka / rozwiązanie z mikroskali. */
export const IdeaKindSchema = z.enum(["IDEA", "GOOD_PRACTICE"]);

// Autor wysyła szkic do ROPS (SUBMITTED); publiczna jest tylko fiszka PUBLISHED.
export const IdeaStatusSchema = z.enum([
  "DRAFT",
  "SUBMITTED",
  "NEEDS_CHANGES",
  "REJECTED",
  "PUBLISHED",
]);

export const IdeaInputSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    essence: z.string().trim().min(10).max(600),
    problem: z.string().trim().min(10).max(1500),
    targetAudience: z.string().trim().min(3).max(600),
    description: z.string().trim().max(4000).default(""),
    stage: IdeaStageSchema,
    kind: IdeaKindSchema.default("IDEA"),
    region: z.string().trim().max(120).default(""),
    contactEmail: z.string().trim().email().max(200).or(z.literal("")).default(""),
    audiences: z.array(AudienceSchema).max(9).default([]),
    areas: z.array(SocialAreaSchema).max(8).default([]),
    needs: z.array(NeedSchema).max(21).default([]),
  })
  .strict();

export const CreateIdeaRequestSchema = IdeaInputSchema;
export const UpdateIdeaRequestSchema = IdeaInputSchema.partial().strict();

/**
 * Reprezentacja publiczna. `contactEmail` celowo nie wychodzi na zewnątrz —
 * zamiast niego jest `hasContact`, żeby brief o danych osobowych był spełniony
 * także wtedy, gdy ktoś poda adres prywatny.
 */
export const IdeaSchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    essence: z.string(),
    problem: z.string(),
    targetAudience: z.string(),
    description: z.string(),
    stage: IdeaStageSchema,
    kind: IdeaKindSchema,
    status: IdeaStatusSchema,
    region: z.string(),
    hasContact: z.boolean(),
    audiences: z.array(AudienceSchema),
    areas: z.array(SocialAreaSchema),
    needs: z.array(NeedSchema),
    adoptedFromId: z.string().nullable(),
    plainLanguageSummary: z.string().nullable(),
    visualId: z.string().nullable(),
    visualAltText: z.string().nullable(),
    hasCanvas: z.boolean(),
    // Prawdziwe tylko dla właściciela tokenu edycji, gdy ROPS odpisał.
    unreadReply: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

export const IdeaMessageSchema = z
  .object({
    id: z.string().min(1),
    author: z.enum(["AUTHOR", "ROPS"]),
    content: z.string(),
    createdAt: z.string(),
  })
  .strict();
export const IdeaMessageRequestSchema = z
  .object({ content: z.string().trim().min(1).max(2000) })
  .strict();
export const IdeaThreadDataSchema = z
  .object({ status: IdeaStatusSchema, messages: z.array(IdeaMessageSchema) })
  .strict();
export const IdeaDecisionSchema = z.enum([
  "PUBLISH",
  "REQUEST_CHANGES",
  "REJECT",
]);
export const IdeaDecisionRequestSchema = z
  .object({
    decision: IdeaDecisionSchema,
    message: z.string().trim().max(2000).default(""),
  })
  .strict()
  .refine((value) => value.decision === "PUBLISH" || value.message.length > 0);
export const ModerationItemSchema = z
  .object({ idea: IdeaSchema, awaitsRops: z.boolean() })
  .strict();
export const ModerationListDataSchema = z
  .object({
    items: z.array(ModerationItemSchema),
    attention: z.number().int().nonnegative(),
  })
  .strict();
export const ModerationDetailDataSchema = z
  .object({
    idea: IdeaSchema,
    awaitsRops: z.boolean(),
    messages: z.array(IdeaMessageSchema),
  })
  .strict();

export const IdeaSummarySchema = IdeaSchema.pick({
  id: true,
  title: true,
  essence: true,
  targetAudience: true,
  stage: true,
  kind: true,
  region: true,
  audiences: true,
  areas: true,
  needs: true,
  visualId: true,
  visualAltText: true,
  createdAt: true,
});

export const IdeaListQuerySchema = z
  .object({
    kind: IdeaKindSchema.optional(),
    stage: IdeaStageSchema.optional(),
    audience: AudienceSchema.optional(),
    area: SocialAreaSchema.optional(),
    q: z.string().trim().max(200).default(""),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(12),
  })
  .strict();

export const IdeaListDataSchema = z
  .object({
    items: z.array(IdeaSummarySchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
  })
  .strict();

export const IdeaDataSchema = z.object({ idea: IdeaSchema }).strict();

/** `editToken` wraca wyłącznie tutaj — przy tworzeniu i adopcji. */
export const CreatedIdeaDataSchema = z
  .object({ idea: IdeaSchema, editToken: z.string().min(1) })
  .strict();

export const PlainLanguageDataSchema = z
  .object({ text: z.string().min(1) })
  .strict();

export const plainLanguageJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["text"],
  properties: {
    text: { type: "string", minLength: 1, maxLength: 1200 },
  },
};

export const IdeaListResponseSchema = apiSuccessSchema(IdeaListDataSchema);
export const IdeaResponseSchema = apiSuccessSchema(IdeaDataSchema);
export const CreatedIdeaResponseSchema = apiSuccessSchema(
  CreatedIdeaDataSchema,
);

export type IdeaStage = z.infer<typeof IdeaStageSchema>;
export type IdeaKind = z.infer<typeof IdeaKindSchema>;
export type IdeaStatus = z.infer<typeof IdeaStatusSchema>;
export type IdeaMessage = z.infer<typeof IdeaMessageSchema>;
export type IdeaMessageRequest = z.infer<typeof IdeaMessageRequestSchema>;
export type IdeaThreadData = z.infer<typeof IdeaThreadDataSchema>;
export type IdeaDecision = z.infer<typeof IdeaDecisionSchema>;
export type IdeaDecisionRequest = z.infer<typeof IdeaDecisionRequestSchema>;
export type ModerationListData = z.infer<typeof ModerationListDataSchema>;
export type ModerationDetailData = z.infer<typeof ModerationDetailDataSchema>;
export type IdeaInput = z.infer<typeof IdeaInputSchema>;
export type CreateIdeaRequest = z.infer<typeof CreateIdeaRequestSchema>;
export type UpdateIdeaRequest = z.infer<typeof UpdateIdeaRequestSchema>;
export type Idea = z.infer<typeof IdeaSchema>;
export type IdeaSummary = z.infer<typeof IdeaSummarySchema>;
export type IdeaListQuery = z.infer<typeof IdeaListQuerySchema>;
export type IdeaListData = z.infer<typeof IdeaListDataSchema>;
export type IdeaData = z.infer<typeof IdeaDataSchema>;
export type CreatedIdeaData = z.infer<typeof CreatedIdeaDataSchema>;
export type PlainLanguageData = z.infer<typeof PlainLanguageDataSchema>;
