import { z } from "zod";

export const ADAPTABLE_INNOVATION_ID = "mobilne-centrum-pomocy";
export const AdaptationRequestSchema = z
  .object({
    innovationId: z.string().trim().min(1).max(100),
    need: z.string().trim().min(1).max(4000),
    turns: z
      .array(
        z
          .object({
            question: z.string().max(600),
            answer: z.string().trim().min(1).max(2000),
          })
          .strict(),
      )
      .max(16),
  })
  .strict()
  .refine(
    (value) =>
      value.need.length +
        value.turns.reduce(
          (sum, turn) => sum + turn.answer.length + turn.question.length,
          0,
        ) <=
      24000,
  );

const text = z.string().trim().min(1).max(600);
export const AdaptationSourceIdSchema = z.enum([
  "rops",
  "individual",
  "resources",
  "team",
  "model",
  "guidelines",
]);
export const AdaptationAdviceSchema = z
  .object({
    message: text,
    question: text.nullable(),
    suggestedAnswers: z.array(z.string().min(1).max(180)).max(3),
    objective: text,
    resources: z
      .array(
        z
          .object({
            name: z.string().min(1).max(100),
            detail: text,
            status: z.enum(["declared", "unconfirmed", "missing"]),
          })
          .strict(),
      )
      .max(8),
    proposals: z
      .array(
        z
          .object({
            change: text,
            tradeoff: text,
            sourceIds: z.array(AdaptationSourceIdSchema).min(1).max(4),
          })
          .strict(),
      )
      .max(4),
    gaps: z.array(text).max(6),
    nextSteps: z.array(text).max(4),
    budget: text,
    changes: z.array(text).max(3),
  })
  .strict();

export const AdaptationSourceSchema = z
  .object({
    id: AdaptationSourceIdSchema,
    label: z.string(),
    url: z.string().url(),
  })
  .strict();
export const AdaptationDataSchema = z
  .object({
    advice: AdaptationAdviceSchema,
    sources: z.array(AdaptationSourceSchema).min(1).max(4),
  })
  .strict();

const sentence = { type: "string", minLength: 1, maxLength: 600 };
const list = (items: object, maxItems: number) => ({
  type: "array",
  items,
  maxItems,
});
const object = (properties: Record<string, object>) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});
export const adaptationJsonSchema = object({
  message: sentence,
  question: { anyOf: [sentence, { type: "null" }] },
  suggestedAnswers: list({ type: "string", minLength: 1, maxLength: 180 }, 3),
  objective: sentence,
  resources: list(
    object({
      name: { type: "string", minLength: 1, maxLength: 100 },
      detail: sentence,
      status: { type: "string", enum: ["declared", "unconfirmed", "missing"] },
    }),
    8,
  ),
  proposals: list(
    object({
      change: sentence,
      tradeoff: sentence,
      sourceIds: {
        ...list({ type: "string", enum: AdaptationSourceIdSchema.options }, 4),
        minItems: 1,
      },
    }),
    4,
  ),
  gaps: list(sentence, 6),
  nextSteps: list(sentence, 4),
  budget: sentence,
  changes: list(sentence, 3),
});

export type AdaptationRequest = z.infer<typeof AdaptationRequestSchema>;
export type AdaptationAdvice = z.infer<typeof AdaptationAdviceSchema>;
export type AdaptationData = z.infer<typeof AdaptationDataSchema>;
export type AdaptationSource = z.infer<typeof AdaptationSourceSchema>;
