import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  HealthDataSchema,
  HelloDataSchema,
  type HealthData,
  type HelloData,
} from '@repo/api-contracts';
import { map, Observable } from 'rxjs';
import { z } from 'zod';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api';

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
