import { Injectable } from '@nestjs/common';
import { ContactRepository } from './contact.repository.js';
import type {
  CreateConversation,
  SendMessage,
  Conversation,
  Message,
} from '@repo/api-contracts';

@Injectable()
export class ContactService {
  constructor(private readonly repository: ContactRepository) {}

  async createConversation(userId: string, data: CreateConversation) {
    const convo = await this.repository.createConversation({
      subject: data.subject,
      citizenId: userId,
      firstName: data.firstName,
      lastName: data.lastName,
      initialMessage: data.initialMessage,
    });

    const citizenMapped = {
      id: convo.citizen.id,
      email: convo.citizen.email,
      firstName: convo.citizen.firstName,
      lastName: convo.citizen.lastName,
      role: convo.citizen.role,
    };

    return {
      id: convo.id,
      subject: convo.subject,
      citizenId: convo.citizenId,
      citizen: citizenMapped,
      employeeId: convo.employeeId,
      createdAt: convo.createdAt.toISOString(),
      updatedAt: convo.updatedAt.toISOString(),
      messages: convo.messages.map((m) => ({
        id: m.id,
        content: m.content,
        conversationId: m.conversationId,
        senderId: m.senderId,
        sender: m.senderId === convo.citizenId ? citizenMapped : undefined,
        createdAt: m.createdAt.toISOString(),
      })),
    } satisfies Conversation;
  }

  async getConversations(userId: string, role: string) {
    const convos = await this.repository.getConversations(userId, role);
    return convos.map((c) => ({
      id: c.id,
      subject: c.subject,
      citizenId: c.citizenId,
      citizen: {
        id: c.citizen.id,
        email: c.citizen.email,
        firstName: c.citizen.firstName,
        lastName: c.citizen.lastName,
        role: c.citizen.role,
      },
      employeeId: c.employeeId,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })) satisfies Conversation[];
  }

  async getMessages(conversationId: string) {
    const messages = await this.repository.getMessages(conversationId);
    return messages.map((m) => ({
      id: m.id,
      content: m.content,
      conversationId: m.conversationId,
      senderId: m.senderId,
      sender: {
        id: m.sender.id,
        email: m.sender.email,
        firstName: m.sender.firstName,
        lastName: m.sender.lastName,
        role: m.sender.role,
      },
      createdAt: m.createdAt.toISOString(),
    })) satisfies Message[];
  }

  async addMessage(conversationId: string, userId: string, data: SendMessage) {
    const message = await this.repository.addMessage({
      conversationId,
      senderId: userId,
      content: data.content,
    });
    return {
      id: message.id,
      content: message.content,
      conversationId: message.conversationId,
      senderId: message.senderId,
      sender: {
        id: message.sender.id,
        email: message.sender.email,
        firstName: message.sender.firstName,
        lastName: message.sender.lastName,
        role: message.sender.role,
      },
      createdAt: message.createdAt.toISOString(),
    } satisfies Message;
  }
}
