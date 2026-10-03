import { z } from 'zod';
import { apiSuccessSchema } from './response.types.js';

const traits = z.array(z.string().trim().min(1).max(120)).max(12);
export const TesterOwnerKeySchema = z.string().regex(/^[a-f0-9]{64}$/);
export const TesterIdSchema = z.string().uuid();
export const TesterAvailabilitySchema = z.enum(['remote', 'onsite', 'hybrid']);
export const TesterProfileInputSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(100),
  bio: z.string().trim().min(20).max(1200),
  skills: traits,
  resources: traits,
  accessibilityNeeds: z.string().trim().max(600).default(''),
  interests: traits,
  availability: TesterAvailabilitySchema,
  consent: z.literal(true),
  isActive: z.boolean().default(true),
}).strict();
export const TesterProfileSchema = TesterProfileInputSchema.extend({
  id: TesterIdSchema,
  isDemo: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export const TesterProfilesDataSchema = z.object({
  profiles: z.array(TesterProfileSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
});
export const MyTesterProfileDataSchema = z.object({
  profile: TesterProfileSchema.nullable(),
});
export const TesterSearchRequestSchema = z.object({
  query: z.string().trim().min(8).max(2000),
}).strict();
export const TesterMatchSchema = z.object({
  profile: TesterProfileSchema,
  score: z.number().int().min(1).max(100),
  reason: z.string().trim().min(1).max(800),
  matchedTraits: z.array(z.string().trim().min(1).max(160)).min(1).max(8),
});
export const TesterSearchSummarySchema = z.object({
  id: TesterIdSchema,
  query: z.string(),
  summary: z.string(),
  matchCount: z.number().int().nonnegative(),
  assignedCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});
export const TesterSearchDataSchema = z.object({
  id: TesterIdSchema,
  query: z.string(),
  summary: z.string(),
  matches: z.array(TesterMatchSchema).max(10),
  assignedProfileIds: z.array(TesterIdSchema),
  candidateCount: z.number().int().nonnegative(),
  totalProfiles: z.number().int().nonnegative(),
  candidateLimit: z.number().int().positive(),
  createdAt: z.string().datetime(),
});
export const TesterSearchesDataSchema = z.object({
  searches: z.array(TesterSearchSummarySchema),
});
export const TesterAssignmentInputSchema = z.object({ profileId: TesterIdSchema }).strict();
export const TesterAiResultSchema = z.object({
  summary: z.string().trim().min(1).max(800),
  matches: z.array(z.object({
    profileId: TesterIdSchema,
    score: z.number().int().min(1).max(100),
    reason: z.string().trim().min(1).max(800),
    matchedTraits: z.array(z.string().trim().min(1).max(160)).min(1).max(8),
  }).strict()).max(10),
}).strict();

export const TesterProfilesResponseSchema = apiSuccessSchema(TesterProfilesDataSchema);
export const MyTesterProfileResponseSchema = apiSuccessSchema(MyTesterProfileDataSchema);
export const TesterSearchResponseSchema = apiSuccessSchema(TesterSearchDataSchema);
export const TesterSearchesResponseSchema = apiSuccessSchema(TesterSearchesDataSchema);
export type TesterProfileInput = z.infer<typeof TesterProfileInputSchema>;
export type TesterProfile = z.infer<typeof TesterProfileSchema>;
export type TesterProfilesData = z.infer<typeof TesterProfilesDataSchema>;
export type MyTesterProfileData = z.infer<typeof MyTesterProfileDataSchema>;
export type TesterSearchRequest = z.infer<typeof TesterSearchRequestSchema>;
export type TesterMatch = z.infer<typeof TesterMatchSchema>;
export type TesterSearchSummary = z.infer<typeof TesterSearchSummarySchema>;
export type TesterSearchData = z.infer<typeof TesterSearchDataSchema>;
export type TesterSearchesData = z.infer<typeof TesterSearchesDataSchema>;
export type TesterAssignmentInput = z.infer<typeof TesterAssignmentInputSchema>;
export type TesterAiResult = z.infer<typeof TesterAiResultSchema>;
