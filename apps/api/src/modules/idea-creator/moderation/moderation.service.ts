import { Inject, Injectable } from '@nestjs/common';
import type {
  ExpertIdeaDetailData,
  ExpertIdeaListData,
  IdeaDecision,
  IdeaDecisionRequest,
  IdeaMessage,
  IdeaStatus,
  IdeaThreadData,
  ModerationDetailData,
  ModerationListData,
} from '@repo/api-contracts';
import { DomainError } from '../../../shared/errors/domain.error.js';
import { MailService } from '../../../shared/mail/mail.service.js';
import type { ExpertIdentity } from '../../auth/expert.guard.js';
import { toIdea, type IdeaRow } from '../ideas/idea.mapper.js';
import { IdeasRepository } from '../ideas/ideas.repository.js';
import { IdeasService } from '../ideas/ideas.service.js';
import {
  ModerationRepository,
  type MessageRow,
} from './moderation.repository.js';

const DECISIONS: Record<IdeaDecision, { status: IdeaStatus; subject: string }> =
  {
    PUBLISH: {
      status: 'PUBLISHED',
      subject: 'Twój pomysł został opublikowany',
    },
    REQUEST_CHANGES: {
      status: 'NEEDS_CHANGES',
      subject: 'ROPS prosi o uzupełnienie pomysłu',
    },
    REJECT: { status: 'REJECTED', subject: 'Decyzja ROPS w sprawie pomysłu' },
  };

// Ekspert opiniuje pomysły zgłoszone do ROPS i już opublikowane.
const REVIEWABLE: readonly string[] = [
  'SUBMITTED',
  'NEEDS_CHANGES',
  'PUBLISHED',
];

function toMessage(row: MessageRow): IdeaMessage {
  return {
    id: row.id,
    author:
      row.author === 'ROPS' || row.author === 'EXPERT' ? row.author : 'AUTHOR',
    authorName: row.authorName,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class ModerationService {
  constructor(
    @Inject(ModerationRepository)
    private readonly repository: ModerationRepository,
    @Inject(IdeasRepository) private readonly ideas: IdeasRepository,
    @Inject(IdeasService) private readonly owners: IdeasService,
    @Inject(MailService) private readonly mail: MailService,
  ) {}

  /** Otwarcie wątku przez autora oznacza odpowiedź ROPS jako przeczytaną. */
  async thread(id: string, token: string | undefined): Promise<IdeaThreadData> {
    const row = await this.owners.requireOwned(id, token);
    await this.repository.markRead(id);
    return this.threadOf(row);
  }

  async authorMessage(
    id: string,
    token: string | undefined,
    content: string,
  ): Promise<IdeaThreadData> {
    const row = await this.owners.requireOwned(id, token);
    if (row.status === 'DRAFT') {
      throw DomainError.conflict(
        'Najpierw wyślij pomysł do ROPS, a potem napisz wiadomość.',
      );
    }
    await this.repository.addMessage(id, 'AUTHOR', content);
    this.mail.notifyRops(
      `Nowa wiadomość od autora pomysłu: ${row.title}`,
      'Autor odpisał w wątku pomysłu. Odpowiedź czeka w panelu administratora.',
    );
    return this.threadOf(row);
  }

  async queue(): Promise<ModerationListData> {
    const { items, attention } = await this.repository.queue();
    return {
      items: items.map((row) => ({
        idea: toIdea(row),
        awaitsRops: row.awaitsRops,
      })),
      attention,
    };
  }

  async detail(id: string): Promise<ModerationDetailData> {
    return this.detailOf(await this.submitted(id));
  }

  async decide(
    id: string,
    input: IdeaDecisionRequest,
  ): Promise<ModerationDetailData> {
    const row = await this.submitted(id);
    const decision = DECISIONS[input.decision];
    const updated = await this.repository.addMessage(
      id,
      'ROPS',
      input.message,
      decision.status,
    );
    this.notifyAuthor(row, decision.subject, input.message);
    return this.detailOf(updated);
  }

  async reply(id: string, content: string): Promise<ModerationDetailData> {
    const row = await this.submitted(id);
    const updated = await this.repository.addMessage(id, 'ROPS', content);
    this.notifyAuthor(row, 'ROPS odpowiedział w sprawie pomysłu', content);
    return this.detailOf(updated);
  }

  async expertQueue(expert: ExpertIdentity): Promise<ExpertIdeaListData> {
    const items = await this.repository.expertQueue(expert.areas);
    return {
      items: items.map(({ row, opinions }) => ({
        idea: toIdea(row),
        opinions,
      })),
    };
  }

  async expertDetail(
    expert: ExpertIdentity,
    id: string,
  ): Promise<ExpertIdeaDetailData> {
    return this.expertDetailOf(await this.reviewable(expert, id));
  }

  async expertOpinion(
    expert: ExpertIdentity,
    id: string,
    content: string,
  ): Promise<ExpertIdeaDetailData> {
    const row = await this.reviewable(expert, id);
    const updated = await this.repository.addMessage(
      id,
      'EXPERT',
      content,
      undefined,
      expert.name,
    );
    this.notifyAuthor(row, 'Ekspert dodał opinię do pomysłu', content);
    return this.expertDetailOf(updated);
  }

  private notifyAuthor(row: IdeaRow, subject: string, message: string): void {
    this.mail.send(
      row.contactEmail,
      `${subject}: ${row.title}`,
      [message, `Odpowiedz na stronie pomysłu: ${this.mail.ideaUrl(row.id)}`]
        .filter(Boolean)
        .join('\n\n'),
    );
  }

  // Szkice są prywatne także dla administratora.
  private async submitted(id: string): Promise<IdeaRow> {
    const row = await this.ideas.findById(id);
    if (!row || row.status === 'DRAFT') {
      throw DomainError.notFound('Nie znaleźliśmy tego pomysłu.');
    }
    return row;
  }

  // Pomysł spoza dziedzin eksperta wygląda tak samo jak nieistniejący.
  private async reviewable(
    expert: ExpertIdentity,
    id: string,
  ): Promise<IdeaRow> {
    const row = await this.ideas.findById(id);
    const inScope =
      row &&
      (row.areas.length === 0 ||
        expert.areas.some((area) => row.areas.includes(area)));
    if (!row || !inScope || !REVIEWABLE.includes(row.status)) {
      throw DomainError.notFound('Nie znaleźliśmy tego pomysłu.');
    }
    return row;
  }

  private async expertDetailOf(row: IdeaRow): Promise<ExpertIdeaDetailData> {
    return {
      idea: toIdea(row),
      messages: (await this.repository.messages(row.id)).map(toMessage),
    };
  }

  private async detailOf(row: IdeaRow): Promise<ModerationDetailData> {
    return {
      idea: toIdea(row),
      awaitsRops: row.awaitsRops,
      messages: (await this.repository.messages(row.id)).map(toMessage),
    };
  }

  private async threadOf(row: IdeaRow): Promise<IdeaThreadData> {
    return {
      status: toIdea(row).status,
      messages: (await this.repository.messages(row.id)).map(toMessage),
    };
  }
}
