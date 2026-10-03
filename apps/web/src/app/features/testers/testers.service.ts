import { Injectable, inject } from '@angular/core';
import {
  MyTesterProfileDataSchema,
  TesterAssignmentInputSchema,
  TesterOwnerKeySchema,
  TesterProfileInputSchema,
  TesterProfilesDataSchema,
  TesterSearchDataSchema,
  TesterSearchesDataSchema,
  TesterSearchRequestSchema,
  type MyTesterProfileData,
  type TesterProfileInput,
  type TesterProfilesData,
  type TesterSearchData,
  type TesterSearchesData,
} from '@repo/api-contracts';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

const OWNER_KEY_STORAGE = 'hackyeah.tester-owner-key';

@Injectable({ providedIn: 'root' })
export class TestersService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  profiles(): Observable<TesterProfilesData> {
    return this.api.request(
      'GET',
      '/testers/profiles',
      TesterProfilesDataSchema,
      this.options(),
    );
  }

  myProfile(): Observable<MyTesterProfileData> {
    return this.api.request(
      'GET',
      '/testers/profile/me',
      MyTesterProfileDataSchema,
      this.options(),
    );
  }

  saveProfile(input: TesterProfileInput): Observable<MyTesterProfileData> {
    return this.api.request(
      'PUT',
      '/testers/profile/me',
      MyTesterProfileDataSchema,
      {
        ...this.options(),
        body: TesterProfileInputSchema.parse(input),
      },
    );
  }

  search(query: string): Observable<TesterSearchData> {
    return this.api.request('POST', '/testers/search', TesterSearchDataSchema, {
      ...this.options(),
      body: TesterSearchRequestSchema.parse({ query }),
    });
  }

  searches(): Observable<TesterSearchesData> {
    return this.api.request(
      'GET',
      '/testers/searches',
      TesterSearchesDataSchema,
      this.options(),
    );
  }

  getSearch(id: string): Observable<TesterSearchData> {
    return this.api.request(
      'GET',
      `/testers/searches/${id}`,
      TesterSearchDataSchema,
      this.options(),
    );
  }

  assign(
    searchId: string,
    profileId: string,
    remove: boolean,
  ): Observable<TesterSearchData> {
    const input = TesterAssignmentInputSchema.parse({ profileId });
    return this.api.request(
      remove ? 'DELETE' : 'POST',
      `/testers/searches/${searchId}/assignments${remove ? `/${input.profileId}` : ''}`,
      TesterSearchDataSchema,
      { ...this.options(), ...(remove ? {} : { body: input }) },
    );
  }

  private options(): { withCredentials: boolean; headers?: Record<string, string> } {
    return {
      withCredentials: true,
      ...(this.auth.user() ? {} : { headers: { 'X-Tester-Key': this.readOrCreateKey() } }),
    };
  }

  private readOrCreateKey(): string {
    const stored = TesterOwnerKeySchema.safeParse(
      localStorage.getItem(OWNER_KEY_STORAGE),
    );
    if (stored.success) return stored.data;
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const key = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
    localStorage.setItem(OWNER_KEY_STORAGE, key);
    return key;
  }
}
