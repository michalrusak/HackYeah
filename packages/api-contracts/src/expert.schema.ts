import { z } from "zod";
import { AuthLoginSchema } from "./auth.schema.js";
import {
  ContactConversationSchema,
  ContactMessageSchema,
} from "./contact.schema.js";
import { IdeaMessageSchema, IdeaSchema } from "./idea.schema.js";
import { SocialAreaSchema } from "./matchmaking.schema.js";

/** Konto z rolą eksperta — rolę nadaje ROPS w panelu administratora. */
export const ExpertAccountSchema = z
  .object({
    id: z.string().uuid(),
    login: AuthLoginSchema,
    name: z.string(),
    areas: z.array(SocialAreaSchema),
  })
  .strict();
export const ExpertListDataSchema = z
  .object({ experts: z.array(ExpertAccountSchema) })
  .strict();
export const ExpertGrantRequestSchema = z
  .object({
    login: AuthLoginSchema,
    name: z.string().trim().min(2).max(100),
    areas: z
      .array(SocialAreaSchema)
      .min(1)
      .max(8)
      .transform((areas) => [...new Set(areas)]),
  })
  .strict();

// `mine` odróżnia sprawy przejęte przez eksperta od wolnych w jego dziedzinach.
export const ExpertConversationSchema = ContactConversationSchema.extend({
  mine: z.boolean(),
});
export const ExpertQueueDataSchema = z.object({
  items: z.array(ExpertConversationSchema),
  attention: z.number().int().nonnegative(),
});
export const ExpertThreadDataSchema = z.object({
  conversation: ExpertConversationSchema,
  messages: z.array(ContactMessageSchema),
});

export const ExpertIdeaItemSchema = z
  .object({ idea: IdeaSchema, opinions: z.number().int().nonnegative() })
  .strict();
export const ExpertIdeaListDataSchema = z
  .object({ items: z.array(ExpertIdeaItemSchema) })
  .strict();
export const ExpertIdeaDetailDataSchema = z
  .object({ idea: IdeaSchema, messages: z.array(IdeaMessageSchema) })
  .strict();

export type ExpertAccount = z.infer<typeof ExpertAccountSchema>;
export type ExpertListData = z.infer<typeof ExpertListDataSchema>;
export type ExpertGrantRequest = z.infer<typeof ExpertGrantRequestSchema>;
export type ExpertConversation = z.infer<typeof ExpertConversationSchema>;
export type ExpertQueueData = z.infer<typeof ExpertQueueDataSchema>;
export type ExpertThreadData = z.infer<typeof ExpertThreadDataSchema>;
export type ExpertIdeaListData = z.infer<typeof ExpertIdeaListDataSchema>;
export type ExpertIdeaDetailData = z.infer<typeof ExpertIdeaDetailDataSchema>;
