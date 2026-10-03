import { z } from "zod";
import { apiSuccessSchema } from "./response.types.js";
import {
  TesterAvailabilitySchema,
  TesterIdSchema,
  TesterProfileSchema,
} from "./testers.schema.js";

export const TesterProjectStageSchema = z.enum([
  "idea",
  "prototype",
  "solution",
]);
export const TesterProjectStatusSchema = z.enum(["open", "closed"]);
export const TesterApplicationStatusSchema = z.enum([
  "pending",
  "accepted",
  "declined",
  "withdrawn",
]);

export const TesterProjectInputSchema = z
  .object({
    organizerName: z.string().trim().min(2).max(100),
    title: z.string().trim().min(5).max(160),
    description: z.string().trim().min(20).max(4000),
    requirements: z.string().trim().min(5).max(2000),
    location: z.string().trim().max(160).default(""),
    mode: TesterAvailabilitySchema,
    stage: TesterProjectStageSchema,
    status: TesterProjectStatusSchema.default("open"),
  })
  .strict();

export const TesterProjectSchema = TesterProjectInputSchema.extend({
  id: TesterIdSchema,
  isOwner: z.boolean(),
  applicationCount: z.number().int().nonnegative(),
  acceptedCount: z.number().int().nonnegative(),
  feedbackCount: z.number().int().nonnegative(),
  averageRating: z.number().min(1).max(5).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const TesterProjectsQuerySchema = z
  .object({
    query: z.string().trim().max(200).default(""),
    status: TesterProjectStatusSchema.optional(),
    stage: TesterProjectStageSchema.optional(),
    mode: TesterAvailabilitySchema.optional(),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    pageSize: z.coerce.number().int().min(1).max(60).default(20),
  })
  .strict();

export const TesterApplicationInputSchema = z
  .object({
    message: z.string().trim().max(1000).default(""),
  })
  .strict();
export const TesterApplicationStatusInputSchema = z
  .object({
    status: z.enum(["accepted", "declined"]),
  })
  .strict();
export const TesterApplicationSchema = z.object({
  id: TesterIdSchema,
  projectId: TesterIdSchema,
  message: z.string(),
  status: TesterApplicationStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const TesterFeedbackInputSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    review: z.string().trim().min(10).max(3000),
    improvement: z.string().trim().max(2000).default(""),
  })
  .strict();
export const TesterFeedbackSchema = TesterFeedbackInputSchema.extend({
  id: TesterIdSchema,
  projectId: TesterIdSchema,
  authorName: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const TesterProjectsDataSchema = z.object({
  projects: z.array(TesterProjectSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});
export const TesterProjectDetailDataSchema = z.object({
  project: TesterProjectSchema,
  myApplication: TesterApplicationSchema.nullable(),
  myFeedback: TesterFeedbackSchema.nullable(),
  feedback: z.array(TesterFeedbackSchema),
});
export const TesterApplicationsDataSchema = z.object({
  applications: z.array(
    z.object({
      application: TesterApplicationSchema,
      profile: TesterProfileSchema,
    }),
  ),
});
export const TesterActivityDataSchema = z.object({
  projects: z.array(TesterProjectSchema),
  applications: z.array(
    z.object({
      project: TesterProjectSchema,
      application: TesterApplicationSchema,
    }),
  ),
  feedback: z.array(
    z.object({ project: TesterProjectSchema, feedback: TesterFeedbackSchema }),
  ),
});

export const TesterProjectsResponseSchema = apiSuccessSchema(
  TesterProjectsDataSchema,
);
export const TesterProjectDetailResponseSchema = apiSuccessSchema(
  TesterProjectDetailDataSchema,
);
export const TesterApplicationsResponseSchema = apiSuccessSchema(
  TesterApplicationsDataSchema,
);
export const TesterActivityResponseSchema = apiSuccessSchema(
  TesterActivityDataSchema,
);

export type TesterProjectInput = z.infer<typeof TesterProjectInputSchema>;
export type TesterProject = z.infer<typeof TesterProjectSchema>;
export type TesterProjectsQuery = z.infer<typeof TesterProjectsQuerySchema>;
export type TesterApplicationInput = z.infer<
  typeof TesterApplicationInputSchema
>;
export type TesterApplicationStatusInput = z.infer<
  typeof TesterApplicationStatusInputSchema
>;
export type TesterApplication = z.infer<typeof TesterApplicationSchema>;
export type TesterFeedbackInput = z.infer<typeof TesterFeedbackInputSchema>;
export type TesterFeedback = z.infer<typeof TesterFeedbackSchema>;
export type TesterProjectsData = z.infer<typeof TesterProjectsDataSchema>;
export type TesterProjectDetailData = z.infer<
  typeof TesterProjectDetailDataSchema
>;
export type TesterApplicationsData = z.infer<
  typeof TesterApplicationsDataSchema
>;
export type TesterActivityData = z.infer<typeof TesterActivityDataSchema>;
