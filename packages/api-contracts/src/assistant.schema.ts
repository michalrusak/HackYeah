import { z } from "zod";
import { apiSuccessSchema } from "./response.types.js";
import {
  AudienceSchema,
  NeedSchema,
  SocialAreaSchema,
} from "./matchmaking.schema.js";
import { IdeaStageSchema } from "./idea.schema.js";

export const AssistantRoleSchema = z.enum(["user", "assistant"]);

export const AssistantMessageSchema = z
  .object({
    role: AssistantRoleSchema,
    content: z.string().min(1),
    createdAt: z.string(),
  })
  .strict();

export const AssistantChatRequestSchema = z
  .object({
    ideaId: z.string().min(1).optional(),
    message: z.string().trim().min(1).max(2000),
  })
  .strict();

export const AssistantChatDataSchema = z
  .object({
    reply: z.string().min(1),
    followUps: z.array(z.string().min(1)).max(3),
  })
  .strict();

export const assistantChatJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "followUps"],
  properties: {
    reply: { type: "string", minLength: 1, maxLength: 2500 },
    followUps: {
      type: "array",
      maxItems: 3,
      items: { type: "string", minLength: 1, maxLength: 160 },
    },
  },
};

export const AssistantSeedRequestSchema = z
  .object({ idea: z.string().trim().min(10).max(2000) })
  .strict();

/** Asystent rozwija jedno zdanie w szkic fiszki — pola odpowiadają formularzowi. */
export const AssistantExpandDataSchema = z
  .object({
    title: z.string().min(1).max(120),
    essence: z.string().min(1).max(600),
    problem: z.string().min(1).max(1500),
    targetAudience: z.string().min(1).max(600),
    stage: IdeaStageSchema,
    audiences: z.array(AudienceSchema).max(9),
    areas: z.array(SocialAreaSchema).max(8),
    needs: z.array(NeedSchema).max(21),
    nextSteps: z.array(z.string().min(1).max(300)).max(5),
  })
  .strict();

export const assistantExpandJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "essence",
    "problem",
    "targetAudience",
    "stage",
    "audiences",
    "areas",
    "needs",
    "nextSteps",
  ],
  properties: {
    title: { type: "string", minLength: 1, maxLength: 120 },
    essence: { type: "string", minLength: 1, maxLength: 600 },
    problem: { type: "string", minLength: 1, maxLength: 1500 },
    targetAudience: { type: "string", minLength: 1, maxLength: 600 },
    stage: { type: "string", enum: IdeaStageSchema.options },
    audiences: {
      type: "array",
      maxItems: 9,
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
    nextSteps: {
      type: "array",
      maxItems: 5,
      items: { type: "string", minLength: 1, maxLength: 300 },
    },
  },
};

export const WildcardVariantSchema = z
  .object({
    title: z.string().min(1).max(120),
    description: z.string().min(1).max(800),
    whyUnusual: z.string().min(1).max(400),
    firstTest: z.string().min(1).max(400),
  })
  .strict();

export const AssistantWildcardsDataSchema = z
  .object({ variants: z.array(WildcardVariantSchema).max(4) })
  .strict();

export const assistantWildcardsJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["variants"],
  properties: {
    variants: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "whyUnusual", "firstTest"],
        properties: {
          title: { type: "string", minLength: 1, maxLength: 120 },
          description: { type: "string", minLength: 1, maxLength: 800 },
          whyUnusual: { type: "string", minLength: 1, maxLength: 400 },
          firstTest: { type: "string", minLength: 1, maxLength: 400 },
        },
      },
    },
  },
};

export const VisualRequestSchema = z
  .object({ hint: z.string().trim().max(500).default("") })
  .strict();

/**
 * `altText` powstaje w tym samym wywołaniu co obraz. Bez opisu alternatywnego
 * grafika łamałaby WCAG 1.1.1, więc endpoint nie zwraca obrazu bez tego pola.
 */
export const VisualDataSchema = z
  .object({
    id: z.string().min(1),
    altText: z.string().min(1),
    url: z.string().min(1),
  })
  .strict();

export const AssistantChatResponseSchema = apiSuccessSchema(
  AssistantChatDataSchema,
);

export type AssistantRole = z.infer<typeof AssistantRoleSchema>;
export type AssistantMessage = z.infer<typeof AssistantMessageSchema>;
export type AssistantChatRequest = z.infer<typeof AssistantChatRequestSchema>;
export type AssistantChatData = z.infer<typeof AssistantChatDataSchema>;
export type AssistantSeedRequest = z.infer<typeof AssistantSeedRequestSchema>;
export type AssistantExpandData = z.infer<typeof AssistantExpandDataSchema>;
export type WildcardVariant = z.infer<typeof WildcardVariantSchema>;
export type AssistantWildcardsData = z.infer<
  typeof AssistantWildcardsDataSchema
>;
export type VisualRequest = z.infer<typeof VisualRequestSchema>;
export type VisualData = z.infer<typeof VisualDataSchema>;
