import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  Inject,
} from '@nestjs/common';
import { ContactService } from './contact.service.js';
import { ContactValidationPipe } from './contact-validation.pipe.js';
import {
  CreateConversationSchema,
  SendMessageSchema,
} from '@repo/api-contracts';
import type {
  CreateConversation,
  SendMessage,
  ConversationResponse,
  MessageResponse,
  ConversationListResponse,
  MessageListResponse,
} from '@repo/api-contracts';
import { UserRole } from '../../generated/prisma/client.js';

@Controller('contact')
export class ContactController {
  constructor(
    @Inject(ContactService) private readonly contactService: ContactService,
  ) {}

  @Post('conversations')
  async createConversation(
    @Headers('user-id') userId: string,
    @Body(new ContactValidationPipe(CreateConversationSchema))
    body: CreateConversation,
  ) {
    // Fallback logic for prototyping without auth
    const uid = userId || 'mock-citizen-123';
    const conversation = await this.contactService.createConversation(
      uid,
      body,
    );
    return { data: conversation, status: 200, success: true };
  }

  @Get('conversations')
  async getConversations(
    @Headers('user-id') userId: string,
    @Headers('user-role') role: string,
  ) {
    const uid = userId || 'mock-citizen-123';
    const r = role || UserRole.CITIZEN;
    const conversations = await this.contactService.getConversations(uid, r);
    return { data: conversations, status: 200, success: true };
  }

  @Get('conversations/:id/messages')
  async getMessages(@Param('id') id: string) {
    const messages = await this.contactService.getMessages(id);
    return { data: messages, status: 200, success: true };
  }

  @Post('conversations/:id/messages')
  async addMessage(
    @Param('id') id: string,
    @Headers('user-id') userId: string,
    @Body(new ContactValidationPipe(SendMessageSchema)) body: SendMessage,
  ) {
    const uid = userId || 'mock-citizen-123';
    const message = await this.contactService.addMessage(id, uid, body);
    return { data: message, status: 200, success: true };
  }
}
