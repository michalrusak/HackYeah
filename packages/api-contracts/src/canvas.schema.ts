import { z } from "zod";
import { apiSuccessSchema } from "./response.types.js";

/**
 * Canva innowacji społecznych. Szablon jest wersjonowany i serwowany z JSON-a,
 * żeby podmiana na oficjalne plansze ROPS nie wymagała migracji bazy ani zmian
 * w kodzie — zapisane odpowiedzi trzymają własny numer wersji.
 */
export const CanvasFieldSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string().min(1),
    question: z.string().min(1),
    hint: z.string().default(""),
    maxLength: z.number().int().min(80).max(2000),
    column: z.number().int().min(1).max(3),
    order: z.number().int().min(1),
  })
  .strict();

export const CanvasTemplateSchema = z
  .object({
    version: z.number().int().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    fields: z.array(CanvasFieldSchema).min(1),
  })
  .strict();

export const CanvasAnswersSchema = z.record(
  z.string().regex(/^[a-z0-9-]+$/),
  z.string().max(2000),
);

export const CanvasDataSchema = z
  .object({
    version: z.number().int().min(1),
    answers: CanvasAnswersSchema,
    updatedAt: z.string().nullable(),
  })
  .strict();

export const CanvasTemplateDataSchema = z
  .object({ template: CanvasTemplateSchema })
  .strict();

export const SaveCanvasRequestSchema = z
  .object({ answers: CanvasAnswersSchema })
  .strict();

export const CanvasSuggestionSchema = z
  .object({
    fieldId: z.string().min(1),
    content: z.string().trim().min(1).max(2000),
  })
  .strict();

export const CanvasSuggestionsDataSchema = z
  .object({ suggestions: z.array(CanvasSuggestionSchema) })
  .strict();

export const canvasSuggestionsJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["suggestions"],
  properties: {
    suggestions: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["fieldId", "content"],
        properties: {
          fieldId: { type: "string", minLength: 1 },
          content: { type: "string", minLength: 1, maxLength: 2000 },
        },
      },
    },
  },
};

export const CanvasResponseSchema = apiSuccessSchema(CanvasDataSchema);

export type CanvasField = z.infer<typeof CanvasFieldSchema>;
export type CanvasTemplate = z.infer<typeof CanvasTemplateSchema>;
export type CanvasAnswers = z.infer<typeof CanvasAnswersSchema>;
export type CanvasData = z.infer<typeof CanvasDataSchema>;
export type CanvasTemplateData = z.infer<typeof CanvasTemplateDataSchema>;
export type SaveCanvasRequest = z.infer<typeof SaveCanvasRequestSchema>;
export type CanvasSuggestion = z.infer<typeof CanvasSuggestionSchema>;
export type CanvasSuggestionsData = z.infer<typeof CanvasSuggestionsDataSchema>;
