import { z } from 'zod'
import { apiSuccessSchema } from './response.types.js'

export const UserRoleSchema = z.enum(['CITIZEN', 'ROPS_EMPLOYEE'])

export const UserSchema = z.object({
	id: z.string(),
	email: z.string().email(),
	firstName: z.string().nullable().optional(),
	lastName: z.string().nullable().optional(),
	role: UserRoleSchema,
})

export const MessageSchema = z.object({
	id: z.string(),
	content: z.string().min(1),
	conversationId: z.string(),
	senderId: z.string(),
	sender: UserSchema.optional(),
	createdAt: z.string(),
})

export const ConversationSchema = z.object({
	id: z.string(),
	subject: z.string().min(1),
	citizenId: z.string(),
	citizen: UserSchema.optional(),
	employeeId: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
	messages: z.array(MessageSchema).optional(),
})

export const CreateConversationSchema = z.object({
	firstName: z.string().min(1).max(100),
	lastName: z.string().min(1).max(100),
	subject: z.string().min(1).max(200),
	initialMessage: z.string().min(1).max(4000),
})

export const SendMessageSchema = z.object({
	content: z.string().min(1).max(4000),
})

export const ConversationListResponseSchema = apiSuccessSchema(z.array(ConversationSchema))
export const ConversationResponseSchema = apiSuccessSchema(ConversationSchema)
export const MessageListResponseSchema = apiSuccessSchema(z.array(MessageSchema))
export const MessageResponseSchema = apiSuccessSchema(MessageSchema)

export type CreateConversation = z.infer<typeof CreateConversationSchema>
export type SendMessage = z.infer<typeof SendMessageSchema>
export type Conversation = z.infer<typeof ConversationSchema>
export type Message = z.infer<typeof MessageSchema>
export type User = z.infer<typeof UserSchema>

export type ConversationListResponse = z.infer<typeof ConversationListResponseSchema>
export type ConversationResponse = z.infer<typeof ConversationResponseSchema>
export type MessageListResponse = z.infer<typeof MessageListResponseSchema>
export type MessageResponse = z.infer<typeof MessageResponseSchema>
