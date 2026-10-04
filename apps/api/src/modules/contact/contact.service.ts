import { Inject, Injectable } from '@nestjs/common';
import {
  SocialAreaSchema,
  type ContactConversation,
  type ContactListData,
  type ContactQueueData,
  type ContactThreadData,
  type CreateConversation,
  type ExpertConversation,
  type ExpertQueueData,
  type ExpertThreadData,
} from '@repo/api-contracts';
import { DomainError } from '../../shared/errors/domain.error.js';
import { MailService } from '../../shared/mail/mail.service.js';
import type { ExpertIdentity } from '../auth/expert.guard.js';
import {
  ContactRepository,
  type ConversationRow,
  type ThreadRow,
} from './contact.repository.js';

const CATEGORY_LABELS: Record<ContactConversation['category'], string> = {
  QUESTION: 'pytanie',
  MENTOR: 'wsparcie mentora',
  JST_ADVICE: 'doradztwo dla JST',
  PARTNERSHIP: 'partnerstwo',
};

function toConversation(row: ConversationRow): ContactConversation {
  const area = SocialAreaSchema.safeParse(row.area);
  return {
    id: row.id,
    subject: row.subject,
    category: row.category,
    status: row.status,
    firstName: row.firstName,
    lastName: row.lastName,
    organization: row.organization,
    area: area.success ? area.data : null,
    expertName: row.expert?.expertName ?? null,
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
      authorName: message.authorName,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    })),
  };
}

function forExpert(
  row: ConversationRow,
  expert: ExpertIdentity,
): ExpertConversation {
  return { ...toConversation(row), mine: row.expertId === expert.id };
}

function toExpertThread(
  row: ThreadRow,
  expert: ExpertIdentity,
): ExpertThreadData {
  return { ...toThread(row), conversation: forExpert(row, expert) };
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
      area: input.area ?? null,
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

  async expertQueue(expert: ExpertIdentity): Promise<ExpertQueueData> {
    const { items, attention } = await this.repository.expertQueue(expert);
    return { items: items.map((row) => forExpert(row, expert)), attention };
  }

  async expertThread(
    expert: ExpertIdentity,
    id: string,
  ): Promise<ExpertThreadData> {
    return toExpertThread(await this.visibleTo(expert, id), expert);
  }

  async take(expert: ExpertIdentity, id: string): Promise<ExpertThreadData> {
    const row = await this.visibleTo(expert, id);
    if (!row.expertId && !(await this.repository.claim(id, expert.id))) {
      throw DomainError.conflict('Tę sprawę przejął już inny ekspert.');
    }
    return this.expertThread(expert, id);
  }

  async release(expert: ExpertIdentity, id: string): Promise<ExpertThreadData> {
    const row = await this.visibleTo(expert, id);
    if (row.expertId !== expert.id) {
      throw DomainError.conflict(
        'Możesz oddać tylko sprawę, którą prowadzisz.',
      );
    }
    return toExpertThread(await this.repository.release(id), expert);
  }

  async expertReply(
    expert: ExpertIdentity,
    id: string,
    content: string,
  ): Promise<ExpertThreadData> {
    await this.visibleTo(expert, id);
    return toExpertThread(
      await this.repository.addMessage(id, 'EXPERT', content, expert),
      expert,
    );
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

  // Sprawa spoza dziedzin eksperta albo prowadzona przez kogoś innego.
  private async visibleTo(
    expert: ExpertIdentity,
    id: string,
  ): Promise<ThreadRow> {
    const row = await this.repository.findForExpert(id, expert);
    if (!row) throw this.notFound();
    return row;
  }

  private notFound(): DomainError {
    return DomainError.notFound('Nie znaleźliśmy tej rozmowy.');
  }
}
