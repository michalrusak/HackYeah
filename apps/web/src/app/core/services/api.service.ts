import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  HealthDataSchema,
  HelloDataSchema,
  type HealthData,
  type HelloData,
  MatchmakingDataSchema,
  MatchmakingRequestSchema,
  type MatchmakingData,
} from '@repo/api-contracts';
import { map, Observable } from 'rxjs';
import { z } from 'zod';
import { ApiConfigService } from './api-config.service';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ApiConfigService);

  private get baseUrl(): string {
    return this.config.apiUrl;
  }

  request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    schema: { parse(value: unknown): T },
    options: {
      body?: unknown;
      headers?: Record<string, string>;
      withCredentials?: boolean;
    } = {},
  ): Observable<T> {
    return this.http
      .request<unknown>(method, `${this.baseUrl}${path}`, options)
      .pipe(
        map((body) => {
          const envelope = z
            .object({ success: z.literal(true), data: z.unknown() })
            .parse(body);
          return schema.parse(envelope.data);
        }),
      );
  }

  matchInnovations(description: string): Observable<MatchmakingData> {
    const input = MatchmakingRequestSchema.parse({ description });
    return this.http
      .post<unknown>(`${this.baseUrl}/matchmaking`, input)
      .pipe(
        map(
          (body) =>
            z
              .object({ success: z.literal(true), data: MatchmakingDataSchema })
              .parse(body).data,
        ),
      );
  }

  getHello(): Observable<HelloData> {
    return this.http.get<unknown>(this.baseUrl).pipe(
      map((body) => {
        const envelope = z
          .object({ success: z.literal(true), data: HelloDataSchema })
          .parse(body);
        return envelope.data;
      }),
    );
  }

  getHealth(): Observable<HealthData> {
    return this.http.get<unknown>(`${this.baseUrl}/health`).pipe(
      map((body) => {
        const envelope = z
          .object({ success: z.literal(true), data: HealthDataSchema })
          .parse(body);
        return envelope.data;
      }),
    );
  }
}
