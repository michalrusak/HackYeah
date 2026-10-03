import { z } from "zod";
import { apiSuccessSchema } from "./response.types.js";
import { GrantCallSchema } from "./grant-call.schema.js";
import { IdeaSummarySchema } from "./idea.schema.js";

export const ApplicationStatusSchema = z.enum(["DRAFT", "SUBMITTED"]);

export const ApplicationAnswersSchema = z.record(
  z.string().regex(/^[a-z0-9-]+$/),
  z.string().max(6000),
);

export const ApplicationSchema = z
  .object({
    id: z.string().min(1),
    ideaId: z.string().min(1),
    grantCallId: z.string().min(1),
    answers: ApplicationAnswersSchema,
    status: ApplicationStatusSchema,
    submittedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

export const CreateApplicationRequestSchema = z
  .object({ ideaId: z.string().min(1) })
  .strict();

export const UpdateApplicationRequestSchema = z
  .object({ answers: ApplicationAnswersSchema })
  .strict();

export const ApplicationDataSchema = z
  .object({
    application: ApplicationSchema,
    call: GrantCallSchema,
    idea: IdeaSummarySchema,
  })
  .strict();

export const CreatedApplicationDataSchema = ApplicationDataSchema.extend({
  editToken: z.string().min(1),
}).strict();

export const GeneratedAnswersDataSchema = z
  .object({ answers: ApplicationAnswersSchema })
  .strict();

/**
 * Kształt, który zwraca model: lista par, nie rekord. `strict` w OpenRouterze
 * nie pozwala na obiekt o dynamicznych kluczach sekcji.
 */
export const ModelApplicationAnswersSchema = z
  .object({
    answers: z.array(
      z
        .object({
          sectionId: z.string().min(1),
          content: z.string().trim().min(1).max(6000),
        })
        .strict(),
    ),
  })
  .strict();

export const ApplicationExportDataSchema = z
  .object({ filename: z.string().min(1), markdown: z.string().min(1) })
  .strict();

/**
 * Sekcje naboru są dynamiczne, więc model zwraca listę par zamiast obiektu
 * o stałych kluczach — inaczej nie dałoby się użyć `strict: true` w OpenRouter.
 */
export const applicationAnswersJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["answers"],
  properties: {
    answers: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sectionId", "content"],
        properties: {
          sectionId: { type: "string", minLength: 1 },
          content: { type: "string", minLength: 1, maxLength: 6000 },
        },
      },
    },
  },
};

export const ApplicationResponseSchema = apiSuccessSchema(ApplicationDataSchema);

export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;
export type ApplicationAnswers = z.infer<typeof ApplicationAnswersSchema>;
export type Application = z.infer<typeof ApplicationSchema>;
export type CreateApplicationRequest = z.infer<
  typeof CreateApplicationRequestSchema
>;
export type UpdateApplicationRequest = z.infer<
  typeof UpdateApplicationRequestSchema
>;
export type ApplicationData = z.infer<typeof ApplicationDataSchema>;
export type CreatedApplicationData = z.infer<
  typeof CreatedApplicationDataSchema
>;
export type GeneratedAnswersData = z.infer<typeof GeneratedAnswersDataSchema>;
export type ModelApplicationAnswers = z.infer<
  typeof ModelApplicationAnswersSchema
>;
export type ApplicationExportData = z.infer<typeof ApplicationExportDataSchema>;
