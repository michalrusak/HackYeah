import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PublicApiConfigSchema } from '@repo/api-contracts';

@Injectable({ providedIn: 'root' })
export class ApiConfigService {
  private readonly http = inject(HttpClient);
  apiUrl = '/api';

  async load(): Promise<void> {
    const config = PublicApiConfigSchema.parse(
      await firstValueFrom(this.http.get<unknown>('/api-config.json')),
    );
    this.apiUrl = config.apiUrl.replace(/\/+$/, '');
  }
}
