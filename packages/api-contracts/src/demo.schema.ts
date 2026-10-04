import { z } from "zod";
import { AuthLoginSchema } from "./auth.schema.js";
import { ExpertGrantRequestSchema } from "./expert.schema.js";

export const DemoAccountRoleSchema = z.enum(["organizer", "tester", "expert"]);

export const DemoAccountSchema = z.object({
  login: AuthLoginSchema,
  password: z.string(),
  role: DemoAccountRoleSchema,
});

// Bez skonfigurowanych danych demo: wartości `null` i pusta lista kont.
export const DemoDataSchema = z.object({
  adminPassword: z.string().nullable(),
  accounts: z.array(DemoAccountSchema),
  // Gotowe dane do formularza nadawania roli eksperta w panelu administratora.
  expertGrant: ExpertGrantRequestSchema.nullable(),
});

export type DemoAccountRole = z.infer<typeof DemoAccountRoleSchema>;
export type DemoAccount = z.infer<typeof DemoAccountSchema>;
export type DemoData = z.infer<typeof DemoDataSchema>;
