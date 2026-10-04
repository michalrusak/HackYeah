import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  ApplicationDataSchema,
  AssistantChatDataSchema,
  AssistantExpandDataSchema,
  AssistantWildcardsDataSchema,
  CanvasDataSchema,
  CanvasSuggestionsDataSchema,
  CanvasTemplateDataSchema,
  CreatedApplicationDataSchema,
  CreatedIdeaDataSchema,
  GrantCallDataSchema,
  GrantCallListDataSchema,
  IdeaDataSchema,
  IdeaListDataSchema,
  IdeaMessageRequestSchema,
  IdeaThreadDataSchema,
  MatchmakingDataSchema,
  MaterialListDataSchema,
  PlainLanguageDataSchema,
  VisualDataSchema,
  type ApplicationAnswers,
  type ApplicationData,
  type AssistantChatData,
  type AssistantExpandData,
  type AssistantWildcardsData,
  type CanvasAnswers,
  type CanvasData,
  type CanvasSuggestionsData,
  type CanvasTemplateData,
  type CreateIdeaRequest,
  type CreatedApplicationData,
  type CreatedIdeaData,
  type GrantCallData,
  type GrantCallListData,
  type IdeaData,
  type IdeaListData,
  type IdeaThreadData,
  type MatchmakingData,
  type MaterialListData,
  type PlainLanguageData,
  type UpdateIdeaRequest,
  type VisualData,
} from '@repo/api-contracts';
import { map, type Observable } from 'rxjs';
import { z, type ZodType } from 'zod';
import { ApiConfigService } from '../../../core/services/api-config.service';
import { EditTokenStore } from './edit-token.store';

export interface IdeaListFilters {
  kind?: string;
  stage?: string;
  audience?: string;
  area?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Jedno wejście HTTP dla całego modułu. Każda odpowiedź jest walidowana
 * kontraktem Zod, tak samo jak w `ApiService` dla matchmakingu.
 */
@Injectable({ providedIn: 'root' })
export class IdeaCreatorApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ApiConfigService);
  private readonly tokens = inject(EditTokenStore);

  private get baseUrl(): string {
    return this.config.apiUrl;
  }

  /** Publiczny adres obrazka — używany bezpośrednio w atrybucie `src`. */
  visualUrl(ideaId: string, visualId: string): string {
    return `${this.baseUrl}/ideas/${ideaId}/visual/${visualId}`;
  }

  listIdeas(filters: IdeaListFilters): Observable<IdeaListData> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null || value === '') continue;
      params = params.set(key, String(value));
    }
    return this.http
      .get<unknown>(`${this.baseUrl}/ideas`, { params })
      .pipe(unwrap(IdeaListDataSchema));
  }

  getIdea(id: string, token?: string): Observable<IdeaData> {
    return this.http
      .get<unknown>(`${this.baseUrl}/ideas/${id}`, { headers: auth(token) })
      .pipe(unwrap(IdeaDataSchema));
  }

  createIdea(input: CreateIdeaRequest): Observable<CreatedIdeaData> {
    return this.http
      .post<unknown>(`${this.baseUrl}/ideas`, input)
      .pipe(unwrap(CreatedIdeaDataSchema));
  }

  updateIdea(
    id: string,
    input: UpdateIdeaRequest,
    token?: string,
  ): Observable<IdeaData> {
    return this.http
      .patch<unknown>(`${this.baseUrl}/ideas/${id}`, input, {
        headers: auth(token),
      })
      .pipe(unwrap(IdeaDataSchema));
  }

  publishIdea(id: string, token?: string): Observable<IdeaData> {
    return this.http
      .post<unknown>(
        `${this.baseUrl}/ideas/${id}/publish`,
        {},
        { headers: auth(token) },
      )
      .pipe(unwrap(IdeaDataSchema));
  }

  getThread(id: string, token?: string): Observable<IdeaThreadData> {
    return this.http
      .get<unknown>(`${this.baseUrl}/ideas/${id}/thread`, {
        headers: auth(token),
      })
      .pipe(unwrap(IdeaThreadDataSchema));
  }

  sendThreadMessage(
    id: string,
    content: string,
    token?: string,
  ): Observable<IdeaThreadData> {
    return this.http
      .post<unknown>(
        `${this.baseUrl}/ideas/${id}/thread`,
        IdeaMessageRequestSchema.parse({ content }),
        { headers: auth(token) },
      )
      .pipe(unwrap(IdeaThreadDataSchema));
  }

  deleteIdea(id: string, token?: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/ideas/${id}`, {
      headers: auth(token),
    });
  }

  adoptIdea(id: string): Observable<CreatedIdeaData> {
    return this.http
      .post<unknown>(`${this.baseUrl}/ideas/${id}/adopt`, {})
      .pipe(unwrap(CreatedIdeaDataSchema));
  }

  plainLanguage(id: string, token?: string): Observable<PlainLanguageData> {
    return this.http
      .post<unknown>(
        `${this.baseUrl}/ideas/${id}/plain-language`,
        {},
        {
          headers: auth(token),
        },
      )
      .pipe(unwrap(PlainLanguageDataSchema));
  }

  relatedInnovations(id: string, token?: string): Observable<MatchmakingData> {
    return this.http
      .post<unknown>(
        `${this.baseUrl}/ideas/${id}/related`,
        {},
        { headers: auth(token) },
      )
      .pipe(unwrap(MatchmakingDataSchema));
  }

  generateVisual(
    id: string,
    hint: string,
    token?: string,
  ): Observable<VisualData> {
    return this.http
      .post<unknown>(
        `${this.baseUrl}/ideas/${id}/visual`,
        { hint },
        { headers: auth(token) },
      )
      .pipe(unwrap(VisualDataSchema));
  }

  canvasTemplate(): Observable<CanvasTemplateData> {
    return this.http
      .get<unknown>(`${this.baseUrl}/canvas/template`)
      .pipe(unwrap(CanvasTemplateDataSchema));
  }

  getCanvas(ideaId: string, token?: string): Observable<CanvasData> {
    return this.http
      .get<unknown>(`${this.baseUrl}/ideas/${ideaId}/canvas`, {
        headers: auth(token),
      })
      .pipe(unwrap(CanvasDataSchema));
  }

  saveCanvas(
    ideaId: string,
    answers: CanvasAnswers,
    token?: string,
  ): Observable<CanvasData> {
    return this.http
      .put<unknown>(
        `${this.baseUrl}/ideas/${ideaId}/canvas`,
        { answers },
        { headers: auth(token) },
      )
      .pipe(unwrap(CanvasDataSchema));
  }

  suggestCanvas(
    ideaId: string,
    token?: string,
  ): Observable<CanvasSuggestionsData> {
    return this.http
      .post<unknown>(
        `${this.baseUrl}/ideas/${ideaId}/canvas/suggest`,
        {},
        { headers: auth(token) },
      )
      .pipe(unwrap(CanvasSuggestionsDataSchema));
  }

  listCalls(): Observable<GrantCallListData> {
    return this.http
      .get<unknown>(`${this.baseUrl}/calls`)
      .pipe(unwrap(GrantCallListDataSchema));
  }

  getCall(id: string): Observable<GrantCallData> {
    return this.http
      .get<unknown>(`${this.baseUrl}/calls/${id}`)
      .pipe(unwrap(GrantCallDataSchema));
  }

  subscribeCallAlerts(
    email: string,
    areas: string[],
  ): Observable<{ success: boolean; email: string }> {
    return this.http
      .post<unknown>(`${this.baseUrl}/calls/subscribe`, { email, areas })
      .pipe(
        unwrap(
          z.object({
            success: z.boolean(),
            email: z.string(),
          }),
        ),
      );
  }

  createApplication(
    callId: string,
    ideaId: string,
    ideaToken?: string,
  ): Observable<CreatedApplicationData> {
    return this.http
      .post<unknown>(
        `${this.baseUrl}/calls/${callId}/applications`,
        { ideaId },
        { headers: auth(ideaToken) },
      )
      .pipe(unwrap(CreatedApplicationDataSchema));
  }

  getApplication(id: string, token?: string): Observable<ApplicationData> {
    return this.http
      .get<unknown>(`${this.baseUrl}/applications/${id}`, {
        headers: auth(token),
      })
      .pipe(unwrap(ApplicationDataSchema));
  }

  saveApplication(
    id: string,
    answers: ApplicationAnswers,
    token?: string,
  ): Observable<ApplicationData> {
    return this.http
      .patch<unknown>(
        `${this.baseUrl}/applications/${id}`,
        { answers },
        { headers: auth(token) },
      )
      .pipe(unwrap(ApplicationDataSchema));
  }

  generateApplication(id: string, token?: string): Observable<ApplicationData> {
    return this.http
      .post<unknown>(
        `${this.baseUrl}/applications/${id}/generate`,
        {},
        { headers: auth(token) },
      )
      .pipe(unwrap(ApplicationDataSchema));
  }

  submitApplication(id: string, token?: string): Observable<ApplicationData> {
    return this.http
      .post<unknown>(
        `${this.baseUrl}/applications/${id}/submit`,
        {},
        { headers: auth(token) },
      )
      .pipe(unwrap(ApplicationDataSchema));
  }

  exportApplication(
    id: string,
    token?: string,
  ): Observable<{ filename: string; markdown: string }> {
    return this.http
      .get<unknown>(`${this.baseUrl}/applications/${id}/export`, {
        headers: auth(token),
      })
      .pipe(
        unwrap(
          z.object({
            filename: z.string().min(1),
            markdown: z.string().min(1),
          }),
        ),
      );
  }

  assistantChat(
    message: string,
    ideaId?: string,
  ): Observable<AssistantChatData> {
    return this.http
      .post<unknown>(
        `${this.baseUrl}/assistant/chat`,
        {
          message,
          ...(ideaId ? { ideaId } : {}),
        },
        { headers: auth(ideaId ? this.tokens.ideaToken(ideaId) : undefined) },
      )
      .pipe(unwrap(AssistantChatDataSchema));
  }

  assistantExpand(idea: string): Observable<AssistantExpandData> {
    return this.http
      .post<unknown>(`${this.baseUrl}/assistant/expand`, { idea })
      .pipe(unwrap(AssistantExpandDataSchema));
  }

  assistantWildcards(idea: string): Observable<AssistantWildcardsData> {
    return this.http
      .post<unknown>(`${this.baseUrl}/assistant/wildcards`, { idea })
      .pipe(unwrap(AssistantWildcardsDataSchema));
  }

  listMaterials(): Observable<MaterialListData> {
    return this.http
      .get<unknown>(`${this.baseUrl}/materials`)
      .pipe(unwrap(MaterialListDataSchema));
  }
}

function auth(token?: string): HttpHeaders | undefined {
  return token ? new HttpHeaders({ 'X-Edit-Token': token }) : undefined;
}

function unwrap<T extends ZodType>(schema: T) {
  return map(
    (body: unknown) =>
      z.object({ success: z.literal(true), data: schema }).parse(body)
        .data as z.infer<T>,
  );
}
