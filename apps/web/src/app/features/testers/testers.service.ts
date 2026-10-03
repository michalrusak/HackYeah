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
import { forkJoin, map, Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';

const OWNER_KEY_STORAGE = 'hackyeah.tester-owner-key';

@Injectable({ providedIn: 'root' })
export class TestersService {
  private readonly api = inject(ApiService);
  private ownerKey = this.readOrCreateKey();

  getKey(): string {
    return this.ownerKey;
  }

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

  restoreKey(value: string): Observable<MyTesterProfileData> {
    const key = TesterOwnerKeySchema.parse(value.trim());
    const options = { headers: { 'X-Tester-Key': key } };
    return forkJoin({
      own: this.api.request(
        'GET',
        '/testers/profile/me',
        MyTesterProfileDataSchema,
        options,
      ),
      history: this.api.request(
        'GET',
        '/testers/searches',
        TesterSearchesDataSchema,
        options,
      ),
    }).pipe(
      map(({ own, history }) => {
        if (!own.profile && !history.searches.length)
          throw new Error('TESTER_KEY_NOT_FOUND');
        localStorage.setItem(OWNER_KEY_STORAGE, key);
        this.ownerKey = key;
        return own;
      }),
    );
  }

  private options(): { headers: Record<string, string> } {
    return { headers: { 'X-Tester-Key': this.ownerKey } };
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
