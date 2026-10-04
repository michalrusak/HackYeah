import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  CallSectionSchema,
  type CallSection,
  type GrantCall,
  type GrantCallListData,
  type GrantAlertSubscriptionRequest,
  type CreateGrantCallRequest,
  type AdminGrantCallListData,
  type AdminGrantCall,
} from '@repo/api-contracts';
import { DomainError } from '../../../shared/errors/domain.error.js';
import { MailService } from '../../../shared/mail/mail.service.js';
import { findNextOpening, resolveCallStatus } from './call-status.js';
import {
  CallsRepository,
  type GrantCallRow,
  type AdminGrantCallRow,
} from './calls.repository.js';

@Injectable()
export class CallsService {
  constructor(
    @Inject(CallsRepository) private readonly repository: CallsRepository,
    @Optional() @Inject(MailService) private readonly mail?: MailService,
  ) {}

  async list(): Promise<GrantCallListData> {
    const rows = await this.repository.findPublished();
    const now = new Date();
    const calls = rows.map((row) => this.toCall(row, now));
    return {
      calls,
      hasOpenCall: calls.some((call) => call.status === 'open'),
      nextOpeningAt: findNextOpening(now, rows)?.toISOString() ?? null,
    };
  }

  async get(id: string): Promise<GrantCall> {
    return this.toCall(await this.findOrFail(id), new Date());
  }

  /** Używane przez wnioski — wymaga, żeby nabór był właśnie otwarty. */
  async requireOpen(id: string): Promise<GrantCall> {
    const call = await this.get(id);
    if (call.status !== 'open') {
      throw DomainError.callClosed(
        call.status === 'upcoming'
          ? 'Ten nabór jeszcze się nie rozpoczął.'
          : 'Ten nabór jest już zamknięty.',
      );
    }
    return call;
  }

  async subscribeToAlerts(input: GrantAlertSubscriptionRequest): Promise<{ success: boolean; email: string }> {
    await this.repository.createSubscription(input.email, input.areas);
    const areasText = input.areas.length > 0 ? input.areas.join(', ') : 'Wszystkie obszary';
    this.mail?.send(
      input.email,
      'Potwierdzenie subskrypcji Alertu Grantowego ROPS',
      `Dzień dobry,\n\nTwój adres e-mail został pomyślnie zapisany na powiadomienia o naborach grantowych Małopolskiego Hubu Innowacji Społecznych (ROPS Kraków).\nWybrane obszary wsparcia: ${areasText}.\n\nPowiadomimy Cię, gdy tylko zostanie ogłoszony nowy nabór wniosków lub zmianie ulegną terminy.\n\nPozdrawiamy,\nZespół ROPS Kraków`,
    );
    return { success: true, email: input.email };
  }

  async listAdmin(): Promise<AdminGrantCallListData> {
    const rows = await this.repository.findAllForAdmin();
    const now = new Date();
    const calls: AdminGrantCall[] = rows.map((row) => ({
      ...this.toCall(row, now),
      isPublished: row.isPublished,
      applicationCount: row.applications.length,
    }));
    return { calls };
  }

  async createCall(input: CreateGrantCallRequest): Promise<AdminGrantCall> {
    const opensAt = new Date(input.opensAt);
    const closesAt = new Date(input.closesAt);
    if (Number.isNaN(opensAt.getTime()) || Number.isNaN(closesAt.getTime())) {
      throw DomainError.conflict('Nieprawidłowy format daty naboru.');
    }
    if (closesAt <= opensAt) {
      throw DomainError.conflict('Data zakończenia naboru musi być późniejsza niż data otwarcia.');
    }

    const row = await this.repository.create({
      name: input.name,
      operator: input.operator,
      description: input.description,
      opensAt,
      closesAt,
      budget: input.budget ?? null,
      maxGrant: input.maxGrant ?? null,
      sections: input.sections,
      isPublished: input.isPublished,
    });

    // Powiadomienie subskrybentów o nowym naborze
    if (input.isPublished) {
      void this.repository.findAllSubscriptions().then((subs) => {
        for (const sub of subs) {
          this.mail?.send(
            sub.email,
            `Nowy nabór grantowy ROPS: ${input.name}`,
            `Dzień dobry,\n\nInformujemy, że w Małopolskim Hubie Innowacji Społecznych został ogłoszony nowy nabór grantowy:\n\n„${input.name}”\nOperator: ${input.operator}\nTermin naboru: od ${opensAt.toLocaleDateString('pl-PL')} do ${closesAt.toLocaleDateString('pl-PL')}\nBudżet: ${input.budget ?? 'Nie określono'}\nMaksymalny grant: ${input.maxGrant ?? 'Nie określono'}\n\nOpis: ${input.description}\n\nZapraszamy do składania wniosków poprzez platformę Hubu.\n\nPozdrawiamy,\nZespół ROPS Kraków`,
          );
        }
      }).catch(() => {});
    }

    const now = new Date();
    return {
      ...this.toCall(row, now),
      isPublished: row.isPublished,
      applicationCount: 0,
    };
  }

  async togglePublish(id: string, isPublished: boolean): Promise<AdminGrantCall> {
    const row = await this.repository.togglePublish(id, isPublished);
    if (!row) throw DomainError.notFound('Nie znaleźliśmy tego naboru.');
    const now = new Date();
    return {
      ...this.toCall(row, now),
      isPublished: row.isPublished,
      applicationCount: row.applications.length,
    };
  }

  private toCall(row: GrantCallRow, now: Date): GrantCall {
    return {
      id: row.id,
      name: row.name,
      operator: row.operator,
      description: row.description,
      opensAt: row.opensAt.toISOString(),
      closesAt: row.closesAt.toISOString(),
      budget: row.budget,
      maxGrant: row.maxGrant,
      status: resolveCallStatus(now, row.opensAt, row.closesAt),
      sections: this.parseSections(row.sections),
    };
  }

  private parseSections(value: unknown): CallSection[] {
    if (!Array.isArray(value)) {
      throw DomainError.conflict(
        'Definicja formularza tego naboru jest nieprawidłowa. Skontaktuj się z organizatorem.',
      );
    }
    const sections: CallSection[] = [];
    for (const item of value) {
      const parsed = CallSectionSchema.safeParse(item);
      if (!parsed.success) {
        throw DomainError.conflict(
          'Definicja formularza tego naboru jest nieprawidłowa. Skontaktuj się z organizatorem.',
        );
      }
      sections.push(parsed.data);
    }
    return sections.sort((a, b) => a.order - b.order);
  }

  private async findOrFail(id: string): Promise<GrantCallRow> {
    const row = await this.repository.findById(id);
    if (!row) throw DomainError.notFound('Nie znaleźliśmy tego naboru.');
    return row;
  }
}
