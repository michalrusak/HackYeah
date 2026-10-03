import { z } from "zod";
import { apiSuccessSchema } from "./response.types.js";

export const MaterialKindSchema = z.enum(["canvas", "guide", "template"]);

export const MaterialSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string().min(1),
    description: z.string().min(1),
    kind: MaterialKindSchema,
    format: z.string().min(1),
    /** Ścieżka w `apps/web/public/materials/` albo adres zewnętrzny. */
    url: z.string().min(1),
    /** Materiał opisany w manifeście, ale jeszcze bez pliku w repo. */
    pending: z.boolean().default(false),
  })
  .strict();

export const MaterialCatalogSchema = z
  .object({
    version: z.literal(1),
    materials: z.array(MaterialSchema).min(1),
  })
  .strict();

export const MaterialListDataSchema = z
  .object({ materials: z.array(MaterialSchema) })
  .strict();

export const MaterialListResponseSchema = apiSuccessSchema(
  MaterialListDataSchema,
);

export type MaterialKind = z.infer<typeof MaterialKindSchema>;
export type Material = z.infer<typeof MaterialSchema>;
export type MaterialCatalog = z.infer<typeof MaterialCatalogSchema>;
export type MaterialListData = z.infer<typeof MaterialListDataSchema>;
