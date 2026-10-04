import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ErrorCodes,
  KnowledgeTrendsSchema,
  NeedSchema,
  NeedSourceSchema,
  SocialAreaSchema,
  type KnowledgeInput,
  type KnowledgeList,
  type KnowledgeOverview,
  type KnowledgeQuery,
  type KnowledgeResource,
  type KnowledgeSummary,
  type KnowledgeTrends,
  type NeedSignal,
} from '@repo/api-contracts';
import { areasForPhrase } from './area-keywords.js';
import { KnowledgeRepository } from './knowledge.repository.js';

const DAY = 86_400_000;
// Obszar jest sygnalizowany jako rosnący trend od 5 sygnałów i wzrostu o połowę.
const RISING_MIN = 5;
const RISING_RATIO = 1.5;
// Po tylu dniach od ostatniej weryfikacji zasób trafia do ponownego sprawdzenia.
const STALE_DAYS = 180;
export function utcDay(date: Date): Date {
  return new Date(date.toISOString().slice(0, 10));
}

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    @Inject(KnowledgeRepository)
    private readonly repository: KnowledgeRepository,
  ) {}

  async list(query: KnowledgeQuery, admin = false): Promise<KnowledgeList> {
    if (!admin && query.page === 1 && (query.q || query.area))
      await this.recordActivity(query);
    return this.repository.list(query, admin, this.staleBefore());
  }

  summary(): Promise<KnowledgeSummary> {
    return this.repository.summary(this.staleBefore());
  }

  private staleBefore(): string {
    return new Date(Date.now() - STALE_DAYS * DAY).toISOString().slice(0, 10);
  }

  // Wpisana fraza to „search”; wejście w temat lub filtr tematu bez frazy to „browse”.
  private async recordActivity(query: KnowledgeQuery): Promise<void> {
    const phrase = query.q.toLowerCase().replace(/\s+/g, ' ');
    const areas = areasForPhrase(phrase);
    if (query.area && !areas.includes(query.area)) areas.push(query.area);
    try {
      await this.repository.recordNeed(
        { areas, needs: [], phrase },
        utcDay(new Date()),
        phrase ? 'search' : 'browse',
      );
    } catch {
      this.logger.warn('Nie zapisano sygnału potrzeby z Zasobnika.');
    }
  }

  async overview(): Promise<KnowledgeOverview> {
    const rows = await this.repository.overviewRows();
    return {
      total: rows.length,
      areas: SocialAreaSchema.options.map((area) => ({
        area,
        count: rows.filter((row) => row.areas.includes(area)).length,
      })),
      updatedAt: rows.length
        ? new Date(
            Math.max(...rows.map((row) => row.updatedAt.getTime())),
          ).toISOString()
        : null,
    };
  }

  async find(id: string): Promise<KnowledgeResource> {
    const row = await this.repository.find(id);
    if (!row)
      throw new NotFoundException({
        success: false,
        error: {
          code: ErrorCodes.NOT_FOUND,
          message: 'Zasób nie jest dostępny.',
        },
      });
    return row;
  }

  async create(input: KnowledgeInput): Promise<KnowledgeResource> {
    const row = await this.repository.create(input);
    if (!row) this.conflict();
    return row;
  }

  async update(
    input: KnowledgeInput,
    revision: number,
  ): Promise<KnowledgeResource> {
    const row = await this.repository.update(input, revision);
    if (!row) this.conflict();
    return row;
  }

  importDrafts(inputs: KnowledgeInput[]): Promise<number> {
    return this.repository.importDrafts(inputs);
  }

  recordNeed(input: NeedSignal): Promise<void> {
    return this.repository.recordNeed(input, utcDay(new Date()));
  }

  async trends(now = new Date()): Promise<KnowledgeTrends> {
    const until = new Date(utcDay(now).getTime() + DAY);
    const currentFrom = new Date(until.getTime() - 30 * DAY);
    const previousFrom = new Date(until.getTime() - 60 * DAY);
    const rows = await this.repository.trendRows(previousFrom, until);
    const sum = (items: { count: number }[]): number =>
      items.reduce((total, item) => total + item.count, 0);
    const phrases = new Map<string, number>();
    for (const row of rows.phrases.filter((item) => item.day >= currentFrom))
      phrases.set(row.phrase, (phrases.get(row.phrase) ?? 0) + row.count);
    return KnowledgeTrendsSchema.parse({
      from: currentFrom.toISOString().slice(0, 10),
      until: new Date(until.getTime() - DAY).toISOString().slice(0, 10),
      currentTotal: sum(rows.daily.filter((row) => row.day >= currentFrom)),
      previousTotal: sum(rows.daily.filter((row) => row.day < currentFrom)),
      areas: SocialAreaSchema.options.map((area) => {
        const current = sum(
          rows.areas.filter(
            (row) => row.area === area && row.day >= currentFrom,
          ),
        );
        const previous = sum(
          rows.areas.filter(
            (row) => row.area === area && row.day < currentFrom,
          ),
        );
        return {
          area,
          current,
          previous,
          rising: current >= RISING_MIN && current >= previous * RISING_RATIO,
        };
      }),
      sources: NeedSourceSchema.options.map((source) => ({
        source,
        count: sum(
          rows.sources.filter(
            (row) => row.source === source && row.day >= currentFrom,
          ),
        ),
      })),
      phrases: [...phrases]
        .map(([phrase, count]) => ({ phrase, count }))
        .sort(
          (a, b) => b.count - a.count || a.phrase.localeCompare(b.phrase, 'pl'),
        )
        .slice(0, 10),
      needs: NeedSchema.options
        .map((need) => ({
          need,
          count: sum(
            rows.needs.filter(
              (row) => row.need === need && row.day >= currentFrom,
            ),
          ),
        }))
        .filter((row) => row.count > 0)
        .sort(
          (a, b) => b.count - a.count || a.need.localeCompare(b.need, 'pl'),
        ),
      daily: Array.from({ length: 30 }, (_, index) => {
        const day = new Date(currentFrom.getTime() + index * DAY)
          .toISOString()
          .slice(0, 10);
        return {
          day,
          count: sum(
            rows.daily.filter(
              (row) => row.day.toISOString().slice(0, 10) === day,
            ),
          ),
        };
      }),
    });
  }

  private conflict(): never {
    throw new ConflictException({
      success: false,
      error: {
        code: ErrorCodes.CONFLICT,
        message:
          'Zasób istnieje lub został zmieniony. Odśwież dane przed zapisem.',
      },
    });
  }
}
