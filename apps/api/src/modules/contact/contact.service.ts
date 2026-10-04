import { Inject, Injectable } from '@nestjs/common';
import type {
  ContactConversation,
  ContactListData,
  ContactQueueData,
  ContactThreadData,
  CreateConversation,
} from '@repo/api-contracts';
import type { Conversation } from '../../generated/prisma/client.js';
import { DomainError } from '../../shared/errors/domain.error.js';
import { MailService } from '../../shared/mail/mail.service.js';
import { ContactRepository, type ThreadRow } from './contact.repository.js';

const CATEGORY_LABELS: Record<ContactConversation['category'], string> = {
  QUESTION: 'pytanie',
  MENTOR: 'wsparcie mentora',
  PARTNERSHIP: 'partnerstwo',
};

function toConversation(row: Conversation): ContactConversation {
  return {
    id: row.id,
    subject: row.subject,
    category: row.category,
    status: row.status,
    firstName: row.firstName,
    lastName: row.lastName,
    organization: row.organization,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toThread(row: ThreadRow): ContactThreadData {
  return {
    conversation: toConversation(row),
    messages: row.messages.map((message) => ({
      id: message.id,
      author: message.author,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    })),
  };
}

@Injectable()
export class ContactService {
  constructor(
    @Inject(ContactRepository) private readonly repository: ContactRepository,
    @Inject(MailService) private readonly mail: MailService,
  ) {}

  async list(accountId: string): Promise<ContactListData> {
    const rows = await this.repository.listForAccount(accountId);
    return { items: rows.map(toConversation) };
  }

  async create(
    accountId: string,
    input: CreateConversation,
  ): Promise<ContactThreadData> {
    const row = await this.repository.create({
      accountId,
      firstName: input.firstName,
      lastName: input.lastName,
      organization: input.organization || null,
      category: input.category,
      subject: input.subject,
      initialMessage: input.initialMessage,
    });
    this.mail.notifyRops(
      `Nowa sprawa (${CATEGORY_LABELS[row.category]}): ${row.subject}`,
      'Użytkownik napisał do ROPS. Sprawa czeka w panelu administratora.',
    );
    return toThread(row);
  }

  async thread(accountId: string, id: string): Promise<ContactThreadData> {
    return toThread(await this.owned(accountId, id));
  }

  /** Wiadomość użytkownika ponownie otwiera zamkniętą sprawę. */
  async userMessage(
    accountId: string,
    id: string,
    content: string,
  ): Promise<ContactThreadData> {
    const row = await this.owned(accountId, id);
    const updated = await this.repository.addMessage(id, 'USER', content);
    this.mail.notifyRops(
      `Nowa wiadomość w sprawie: ${row.subject}`,
      'Użytkownik odpisał w rozmowie. Odpowiedź czeka w panelu administratora.',
    );
    return toThread(updated);
  }

  async queue(): Promise<ContactQueueData> {
    const { items, attention } = await this.repository.queue();
    return { items: items.map(toConversation), attention };
  }

  async detail(id: string): Promise<ContactThreadData> {
    return toThread(await this.existing(id));
  }

  async reply(id: string, content: string): Promise<ContactThreadData> {
    await this.existing(id);
    return toThread(await this.repository.addMessage(id, 'ROPS', content));
  }

  async close(id: string): Promise<ContactThreadData> {
    await this.existing(id);
    return toThread(await this.repository.setStatus(id, 'CLOSED'));
  }

  // Cudza rozmowa wygląda tak samo jak nieistniejąca.
  private async owned(accountId: string, id: string): Promise<ThreadRow> {
    const row = await this.existing(id);
    if (row.accountId !== accountId) throw this.notFound();
    return row;
  }

  private async existing(id: string): Promise<ThreadRow> {
    const row = await this.repository.find(id);
    if (!row) throw this.notFound();
    return row;
  }

  private notFound(): DomainError {
    return DomainError.notFound('Nie znaleźliśmy tej rozmowy.');
  }
}
