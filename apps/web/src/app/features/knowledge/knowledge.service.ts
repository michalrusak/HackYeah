import { Injectable, inject, signal } from '@angular/core';
import {
  AcknowledgementSchema,
  AdminLoginSchema,
  AdminSessionSchema,
  ContactQueueDataSchema,
  ContactThreadDataSchema,
  IdeaDecisionRequestSchema,
  IdeaMessageRequestSchema,
  ImportResultSchema,
  KnowledgeImportSchema,
  KnowledgeInputSchema,
  KnowledgeListSchema,
  KnowledgeOverviewSchema,
  KnowledgeQuerySchema,
  KnowledgeResourceSchema,
  KnowledgeSummarySchema,
  KnowledgeTrendsSchema,
  KnowledgeUpdateSchema,
  ModerationDetailDataSchema,
  ModerationListDataSchema,
  NeedSignalSchema,
  SendMessageSchema,
  type AdminSession,
  type ContactQueueData,
  type ContactThreadData,
  type IdeaDecisionRequest,
  type KnowledgeInput,
  type KnowledgeList,
  type KnowledgeOverview,
  type KnowledgeQuery,
  type KnowledgeResource,
  type KnowledgeSummary,
  type KnowledgeTrends,
  type ModerationDetailData,
  type ModerationListData,
  type NeedSignal,
} from '@repo/api-contracts';
import { tap, type Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';

@Injectable({ providedIn: 'root' })
export class KnowledgeService {
  private readonly api = inject(ApiService);
  readonly session = signal<AdminSession | null>(null);

  list(query: KnowledgeQuery, admin = false): Observable<KnowledgeList> {
    const validated = KnowledgeQuerySchema.parse(query);
    const params = new URLSearchParams();
    Object.entries(validated).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.set(key, String(value));
    });
    return this.api.get(
      `/knowledge/${admin ? 'admin/' : ''}resources?${params}`,
      KnowledgeListSchema,
      admin,
    );
  }

  overview(): Observable<KnowledgeOverview> {
    return this.api.get('/knowledge/overview', KnowledgeOverviewSchema);
  }
  recordNeed(input: NeedSignal): Observable<{ accepted: true }> {
    return this.api.post(
      '/knowledge/needs',
      NeedSignalSchema.parse(input),
      AcknowledgementSchema,
    );
  }
  login(password: string): Observable<AdminSession> {
    return this.api
      .post(
        '/knowledge/admin/login',
        AdminLoginSchema.parse({ password }),
        AdminSessionSchema,
      )
      .pipe(tap((session) => this.session.set(session)));
  }
  restoreSession(): Observable<AdminSession> {
    return this.api
      .get('/knowledge/admin/session', AdminSessionSchema, true)
      .pipe(tap((session) => this.session.set(session)));
  }
  logout(): Observable<{ accepted: true }> {
    return this.api
      .post('/knowledge/admin/logout', {}, AcknowledgementSchema, this.csrf())
      .pipe(tap(() => this.session.set(null)));
  }
  summary(): Observable<KnowledgeSummary> {
    return this.api.get(
      '/knowledge/admin/summary',
      KnowledgeSummarySchema,
      true,
    );
  }
  trends(): Observable<KnowledgeTrends> {
    return this.api.get('/knowledge/admin/trends', KnowledgeTrendsSchema, true);
  }

  save(
    input: KnowledgeInput,
    revision: number | null,
  ): Observable<KnowledgeResource> {
    const resource = KnowledgeInputSchema.parse(input);
    return revision
      ? this.api.put(
          `/knowledge/admin/resources/${encodeURIComponent(resource.id)}`,
          KnowledgeUpdateSchema.parse({ resource, revision }),
          KnowledgeResourceSchema,
          this.csrf(),
        )
      : this.api.post(
          '/knowledge/admin/resources',
          resource,
          KnowledgeResourceSchema,
          this.csrf(),
        );
  }

  importDrafts(json: unknown): Observable<{ imported: number }> {
    return this.api.post(
      '/knowledge/admin/import',
      KnowledgeImportSchema.parse(json),
      ImportResultSchema,
      this.csrf(),
    );
  }

  moderationQueue(): Observable<ModerationListData> {
    return this.api.get(
      '/knowledge/admin/ideas',
      ModerationListDataSchema,
      true,
    );
  }
  moderationDetail(id: string): Observable<ModerationDetailData> {
    return this.api.get(
      `/knowledge/admin/ideas/${encodeURIComponent(id)}`,
      ModerationDetailDataSchema,
      true,
    );
  }
  decideIdea(
    id: string,
    input: IdeaDecisionRequest,
  ): Observable<ModerationDetailData> {
    return this.api.post(
      `/knowledge/admin/ideas/${encodeURIComponent(id)}/decision`,
      IdeaDecisionRequestSchema.parse(input),
      ModerationDetailDataSchema,
      this.csrf(),
    );
  }
  replyToIdea(id: string, content: string): Observable<ModerationDetailData> {
    return this.api.post(
      `/knowledge/admin/ideas/${encodeURIComponent(id)}/messages`,
      IdeaMessageRequestSchema.parse({ content }),
      ModerationDetailDataSchema,
      this.csrf(),
    );
  }

  contactQueue(): Observable<ContactQueueData> {
    return this.api.get(
      '/knowledge/admin/contact',
      ContactQueueDataSchema,
      true,
    );
  }
  contactThread(id: string): Observable<ContactThreadData> {
    return this.api.get(
      `/knowledge/admin/contact/${encodeURIComponent(id)}`,
      ContactThreadDataSchema,
      true,
    );
  }
  replyToContact(id: string, content: string): Observable<ContactThreadData> {
    return this.api.post(
      `/knowledge/admin/contact/${encodeURIComponent(id)}/messages`,
      SendMessageSchema.parse({ content }),
      ContactThreadDataSchema,
      this.csrf(),
    );
  }
  closeContact(id: string): Observable<ContactThreadData> {
    return this.api.post(
      `/knowledge/admin/contact/${encodeURIComponent(id)}/close`,
      {},
      ContactThreadDataSchema,
      this.csrf(),
    );
  }

  private csrf(): string {
    const session = this.session();
    if (!session) throw new Error('Missing administrator session');
    return session.csrfToken;
  }
}
