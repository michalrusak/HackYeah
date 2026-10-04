import { z } from 'zod'
import { SocialAreaSchema } from './matchmaking.schema.js'
import { apiSuccessSchema } from './response.types.js'

export const ContactCategorySchema = z.enum([
	'QUESTION',
	'MENTOR',
	'JST_ADVICE',
	'PARTNERSHIP',
])
// Te sprawy trafiają do ekspertów branżowych, pozostałe obsługuje ROPS.
export const EXPERT_CATEGORIES: readonly ContactCategory[] = ['MENTOR', 'JST_ADVICE']
export const ContactStatusSchema = z.enum(['AWAITING_ROPS', 'ANSWERED', 'CLOSED'])

export const ContactMessageSchema = z.object({
	id: z.string(),
	author: z.enum(['USER', 'ROPS', 'EXPERT']),
	authorName: z.string().nullable().default(null),
	content: z.string(),
	createdAt: z.string(),
})

export const ContactConversationSchema = z.object({
	id: z.string(),
	subject: z.string(),
	category: ContactCategorySchema,
	status: ContactStatusSchema,
	firstName: z.string(),
	lastName: z.string(),
	organization: z.string().nullable(),
	area: SocialAreaSchema.nullable().default(null),
	// Ekspert, który przejął sprawę.
	expertName: z.string().nullable().default(null),
	createdAt: z.string(),
	updatedAt: z.string(),
})

export const CreateConversationSchema = z.object({
	firstName: z.string().trim().min(1).max(100),
	lastName: z.string().trim().min(1).max(100),
	organization: z.string().trim().max(200).optional(),
	category: ContactCategorySchema,
	area: SocialAreaSchema.optional(),
	subject: z.string().trim().min(1).max(200),
	initialMessage: z.string().trim().min(1).max(4000),
})

export const SendMessageSchema = z.object({
	content: z.string().trim().min(1).max(4000),
})

export const ContactListDataSchema = z.object({
	items: z.array(ContactConversationSchema),
})
export const ContactThreadDataSchema = z.object({
	conversation: ContactConversationSchema,
	messages: z.array(ContactMessageSchema),
})
export const ContactQueueDataSchema = z.object({
	items: z.array(ContactConversationSchema),
	attention: z.number().int().nonnegative(),
})

export const ContactListResponseSchema = apiSuccessSchema(ContactListDataSchema)
export const ContactThreadResponseSchema = apiSuccessSchema(ContactThreadDataSchema)
export const ContactQueueResponseSchema = apiSuccessSchema(ContactQueueDataSchema)

export type ContactCategory = z.infer<typeof ContactCategorySchema>
export type ContactStatus = z.infer<typeof ContactStatusSchema>
export type ContactMessage = z.infer<typeof ContactMessageSchema>
export type ContactConversation = z.infer<typeof ContactConversationSchema>
export type CreateConversation = z.infer<typeof CreateConversationSchema>
export type SendMessage = z.infer<typeof SendMessageSchema>
export type ContactListData = z.infer<typeof ContactListDataSchema>
export type ContactThreadData = z.infer<typeof ContactThreadDataSchema>
export type ContactQueueData = z.infer<typeof ContactQueueDataSchema>
