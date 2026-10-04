import { z } from "zod";
import { apiSuccessSchema } from "./response.types.js";
import { SocialAreaSchema } from "./matchmaking.schema.js";
import { TesterOwnerKeySchema } from "./testers.schema.js";

export const AuthLoginSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9._-]{2,39}$/);

export const AuthLoginInputSchema = z
  .object({
    login: AuthLoginSchema,
    password: z.string().min(1).max(128),
  })
  .strict();

export const AuthRegisterInputSchema = AuthLoginInputSchema.extend({
  password: z.string().min(12).max(128),
  legacyKey: TesterOwnerKeySchema.optional(),
});

// Rola eksperta branżowego; `null` dla zwykłego konta.
export const AuthExpertSchema = z.object({
  name: z.string(),
  areas: z.array(SocialAreaSchema),
});

export const AuthUserSchema = z.object({
  id: z.string().uuid(),
  login: AuthLoginSchema,
  expert: AuthExpertSchema.nullable().default(null),
});

export const AuthSessionDataSchema = z.object({
  user: AuthUserSchema.nullable(),
});

export const AuthLogoutDataSchema = z.object({ loggedOut: z.literal(true) });
export const AuthSessionResponseSchema = apiSuccessSchema(
  AuthSessionDataSchema,
);
export const AuthLogoutResponseSchema = apiSuccessSchema(AuthLogoutDataSchema);

export type AuthLoginInput = z.infer<typeof AuthLoginInputSchema>;
export type AuthRegisterInput = z.infer<typeof AuthRegisterInputSchema>;
export type AuthExpert = z.infer<typeof AuthExpertSchema>;
export type AuthUser = z.infer<typeof AuthUserSchema>;
export type AuthSessionData = z.infer<typeof AuthSessionDataSchema>;
export type AuthLogoutData = z.infer<typeof AuthLogoutDataSchema>;
