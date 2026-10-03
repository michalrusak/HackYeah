import { Inject, Injectable } from '@nestjs/common';
import {
  CallSectionSchema,
  type CallSection,
  type GrantCall,
  type GrantCallListData,
} from '@repo/api-contracts';
import { DomainError } from '../../../shared/errors/domain.error.js';
import { findNextOpening, resolveCallStatus } from './call-status.js';
import { CallsRepository, type GrantCallRow } from './calls.repository.js';

@Injectable()
export class CallsService {
  constructor(@Inject(CallsRepository) private readonly repository: CallsRepository) {}

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
