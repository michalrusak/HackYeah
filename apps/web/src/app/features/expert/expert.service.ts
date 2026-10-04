import { Injectable, inject } from '@angular/core';
import {
  ExpertIdeaDetailDataSchema,
  ExpertIdeaListDataSchema,
  ExpertQueueDataSchema,
  ExpertThreadDataSchema,
  IdeaMessageRequestSchema,
  SendMessageSchema,
  type ExpertIdeaDetailData,
  type ExpertIdeaListData,
  type ExpertQueueData,
  type ExpertThreadData,
} from '@repo/api-contracts';
import type { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';

/** Panel eksperta — rolę potwierdza ciasteczko sesji konta. */
@Injectable({ providedIn: 'root' })
export class ExpertService {
  private readonly api = inject(ApiService);

  conversations(): Observable<ExpertQueueData> {
    return this.api.request(
      'GET',
      '/experts/conversations',
      ExpertQueueDataSchema,
      { withCredentials: true },
    );
  }

  thread(id: string): Observable<ExpertThreadData> {
    return this.api.request(
      'GET',
      `/experts/conversations/${encodeURIComponent(id)}`,
      ExpertThreadDataSchema,
      { withCredentials: true },
    );
  }

  assign(id: string, action: 'take' | 'release'): Observable<ExpertThreadData> {
    return this.api.request(
      'POST',
      `/experts/conversations/${encodeURIComponent(id)}/${action}`,
      ExpertThreadDataSchema,
      { withCredentials: true, body: {} },
    );
  }

  reply(id: string, content: string): Observable<ExpertThreadData> {
    return this.api.request(
      'POST',
      `/experts/conversations/${encodeURIComponent(id)}/messages`,
      ExpertThreadDataSchema,
      { withCredentials: true, body: SendMessageSchema.parse({ content }) },
    );
  }

  ideas(): Observable<ExpertIdeaListData> {
    return this.api.request('GET', '/experts/ideas', ExpertIdeaListDataSchema, {
      withCredentials: true,
    });
  }

  idea(id: string): Observable<ExpertIdeaDetailData> {
    return this.api.request(
      'GET',
      `/experts/ideas/${encodeURIComponent(id)}`,
      ExpertIdeaDetailDataSchema,
      { withCredentials: true },
    );
  }

  opinion(id: string, content: string): Observable<ExpertIdeaDetailData> {
    return this.api.request(
      'POST',
      `/experts/ideas/${encodeURIComponent(id)}/messages`,
      ExpertIdeaDetailDataSchema,
      {
        withCredentials: true,
        body: IdeaMessageRequestSchema.parse({ content }),
      },
    );
  }
}
