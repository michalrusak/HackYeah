import { z } from "zod";
import {
  AudienceSchema,
  NeedSchema,
  SocialAreaSchema,
  InterpretationSchema,
} from "./matchmaking.schema.js";
import { TesterIdSchema, TesterAvailabilitySchema } from "./testers.schema.js";

export const PilotConditionsSchema = z
  .object({
    isDemo: z.boolean().default(false),
    audiences: z.array(AudienceSchema).min(1).max(10),
    needs: z.array(NeedSchema).min(1).max(21),
    areas: z.array(SocialAreaSchema).min(1).max(8),
    recruitmentEndsAt: z.string().datetime().nullable(),
    testSchedule: z.string().trim().min(5).max(300),
    commitment: z.string().trim().min(5).max(500),
    participants: z.enum(["person", "organization", "either"]),
  })
  .strict();
export const PilotMatchRequestSchema = z
  .object({
    interpretation: InterpretationSchema,
  })
  .strict();
export const PilotMatchSchema = z
  .object({
    id: TesterIdSchema,
    title: z.string(),
    description: z.string(),
    organizerName: z.string(),
    requirements: z.string(),
    location: z.string(),
    mode: TesterAvailabilitySchema.nullable(),
    conditions: PilotConditionsSchema,
    matchedNeeds: z.array(NeedSchema).min(1),
    matchedAudiences: z.array(AudienceSchema),
    status: z.literal("testing"),
    deploymentApproved: z.literal(false),
    external: z
      .object({
        sourceUrl: z
          .string()
          .url()
          .refine((url) => new URL(url).protocol === "https:"),
        sourceLabel: z.string().min(1),
        verifiedAt: z.string().date(),
      })
      .strict()
      .optional(),
  })
  .strict();
export const PilotMatchesDataSchema = z
  .object({ matches: z.array(PilotMatchSchema).max(3) })
  .strict();
export type PilotMatch = z.infer<typeof PilotMatchSchema>;
export type PilotConditions = z.infer<typeof PilotConditionsSchema>;
export type PilotMatchesData = z.infer<typeof PilotMatchesDataSchema>;
export type PilotMatchRequest = z.infer<typeof PilotMatchRequestSchema>;

export const ExternalPilotSchema = PilotMatchSchema.omit({
  matchedNeeds: true,
  matchedAudiences: true,
}).extend({
  external: PilotMatchSchema.shape.external.unwrap(),
  recheckAfter: z.string().datetime(),
});
export const ExternalPilotCatalogSchema = z.array(ExternalPilotSchema);
export type ExternalPilot = z.infer<typeof ExternalPilotSchema>;
