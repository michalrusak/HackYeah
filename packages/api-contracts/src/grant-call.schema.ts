import { z } from "zod";
import { apiSuccessSchema } from "./response.types.js";

export const CallSectionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string().min(1),
    question: z.string().min(1),
    help: z.string().default(""),
    maxLength: z.number().int().min(100).max(6000),
    required: z.boolean().default(true),
    order: z.number().int().min(1),
  })
  .strict();

/**
 * Status jest liczony z `opensAt`/`closesAt`, nie przechowywany — „czasowa
 * dostępność” generatora wniosków z briefu wynika wprost z okna naboru.
 */
export const CallStatusSchema = z.enum(["upcoming", "open", "closed"]);

export const GrantCallSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    operator: z.string().min(1),
    description: z.string().min(1),
    opensAt: z.string(),
    closesAt: z.string(),
    budget: z.string().nullable(),
    maxGrant: z.string().nullable(),
    status: CallStatusSchema,
    sections: z.array(CallSectionSchema),
  })
  .strict();

export const GrantCallListDataSchema = z
  .object({
    calls: z.array(GrantCallSchema),
    hasOpenCall: z.boolean(),
    nextOpeningAt: z.string().nullable(),
  })
  .strict();

export const GrantCallDataSchema = z.object({ call: GrantCallSchema }).strict();

export const GrantCallListResponseSchema = apiSuccessSchema(
  GrantCallListDataSchema,
);

export const GrantAlertSubscriptionRequestSchema = z
  .object({
    email: z.string().trim().email(),
    areas: z.array(z.string().trim().min(1)).default([]),
  })
  .strict();

export const CreateGrantCallRequestSchema = z
  .object({
    name: z.string().trim().min(3).max(200),
    operator: z.string().trim().min(2).max(100),
    description: z.string().trim().min(5).max(4000),
    opensAt: z.string(),
    closesAt: z.string(),
    budget: z.string().trim().nullable().optional(),
    maxGrant: z.string().trim().nullable().optional(),
    sections: z.array(CallSectionSchema).min(1),
    isPublished: z.boolean().default(true),
  })
  .strict();

export const AdminGrantCallSchema = GrantCallSchema.extend({
  isPublished: z.boolean(),
  applicationCount: z.number().int().nonnegative().optional(),
});

export const AdminGrantCallListDataSchema = z
  .object({
    calls: z.array(AdminGrantCallSchema),
  })
  .strict();

export type CallSection = z.infer<typeof CallSectionSchema>;
export type CallStatus = z.infer<typeof CallStatusSchema>;
export type GrantCall = z.infer<typeof GrantCallSchema>;
export type GrantCallListData = z.infer<typeof GrantCallListDataSchema>;
export type GrantCallData = z.infer<typeof GrantCallDataSchema>;
export type GrantAlertSubscriptionRequest = z.infer<
  typeof GrantAlertSubscriptionRequestSchema
>;
export type CreateGrantCallRequest = z.infer<
  typeof CreateGrantCallRequestSchema
>;
export type AdminGrantCall = z.infer<typeof AdminGrantCallSchema>;
export type AdminGrantCallListData = z.infer<
  typeof AdminGrantCallListDataSchema
>;
