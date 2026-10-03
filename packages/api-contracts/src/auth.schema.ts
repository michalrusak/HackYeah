import { z } from "zod";
import { apiSuccessSchema } from "./response.types.js";
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

export const AuthUserSchema = z.object({
  id: z.string().uuid(),
  login: AuthLoginSchema,
});

export const AuthSessionDataSchema = z.object({
  user: AuthUserSchema.nullable(),
});

export const AuthLogoutDataSchema = z.object({ loggedOut: z.literal(true) });
export const AuthSessionResponseSchema = apiSuccessSchema(AuthSessionDataSchema);
export const AuthLogoutResponseSchema = apiSuccessSchema(AuthLogoutDataSchema);

export type AuthLoginInput = z.infer<typeof AuthLoginInputSchema>;
export type AuthRegisterInput = z.infer<typeof AuthRegisterInputSchema>;
export type AuthUser = z.infer<typeof AuthUserSchema>;
export type AuthSessionData = z.infer<typeof AuthSessionDataSchema>;
export type AuthLogoutData = z.infer<typeof AuthLogoutDataSchema>;
