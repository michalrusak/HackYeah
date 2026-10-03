import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { UserRole } from '../../generated/prisma/client.js';

@Injectable()
export class ContactRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createConversation(data: {
    subject: string;
    citizenId: string;
    firstName: string;
    lastName: string;
    initialMessage: string;
  }) {
    // Ensure citizen exists
    await this.prisma.user.upsert({
      where: { id: data.citizenId },
      update: {
        firstName: data.firstName,
        lastName: data.lastName,
      },
      create: {
        id: data.citizenId,
        email: `citizen_${data.citizenId}@example.com`,
        role: UserRole.CITIZEN,
        firstName: data.firstName,
        lastName: data.lastName,
      },
    });

    return this.prisma.conversation.create({
      data: {
        subject: data.subject,
        citizenId: data.citizenId,
        messages: {
          create: {
            content: data.initialMessage,
            senderId: data.citizenId,
          },
        },
      },
      include: {
        messages: { include: { sender: true } },
        citizen: true,
      },
    });
  }

  async getConversations(userId: string, role: string) {
    if (role === UserRole.ROPS_EMPLOYEE) {
      return this.prisma.conversation.findMany({
        orderBy: { updatedAt: 'desc' },
        include: { citizen: true },
      });
    } else {
      return this.prisma.conversation.findMany({
        where: { citizenId: userId },
        orderBy: { updatedAt: 'desc' },
        include: { citizen: true },
      });
    }
  }

  async getMessages(conversationId: string) {
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      include: { sender: true },
    });
  }

  async addMessage(data: {
    conversationId: string;
    senderId: string;
    content: string;
  }) {
    // Ensure sender exists (could be rops employee)
    const exists = await this.prisma.user.findUnique({
      where: { id: data.senderId },
    });
    if (!exists) {
      await this.prisma.user.create({
        data: {
          id: data.senderId,
          email: `employee_${data.senderId}@example.com`,
          role: UserRole.ROPS_EMPLOYEE,
        },
      });
    }

    // Add message and update conversation updatedAt
    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          content: data.content,
          conversationId: data.conversationId,
          senderId: data.senderId,
        },
        include: { sender: true }
      }),
      this.prisma.conversation.update({
        where: { id: data.conversationId },
        data: { updatedAt: new Date() },
      }),
    ]);
    return message;
  }
}
