import { Injectable, inject, signal } from '@angular/core';
import {
  AuthSessionDataSchema,
  AuthLoginInputSchema,
  AuthLogoutDataSchema,
  AuthRegisterInputSchema,
  TesterOwnerKeySchema,
  type AuthSessionData,
  type AuthUser,
} from '@repo/api-contracts';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';

const LEGACY_KEY_STORAGE = 'hackyeah.tester-owner-key';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly currentUser = signal<AuthUser | null>(null);
  readonly user = this.currentUser.asReadonly();

  refresh(): Observable<AuthSessionData> {
    return this.api
      .request('GET', '/auth/me', AuthSessionDataSchema, { withCredentials: true })
      .pipe(tap(({ user }) => this.currentUser.set(user)));
  }

  login(login: string, password: string): Observable<AuthSessionData> {
    return this.api
      .request('POST', '/auth/login', AuthSessionDataSchema, {
        withCredentials: true,
        body: AuthLoginInputSchema.parse({ login, password }),
      })
      .pipe(tap(({ user }) => this.currentUser.set(user)));
  }

  register(login: string, password: string): Observable<AuthSessionData> {
    const legacyKey = TesterOwnerKeySchema.safeParse(
      localStorage.getItem(LEGACY_KEY_STORAGE),
    );
    const body = AuthRegisterInputSchema.parse({
      login,
      password,
      ...(legacyKey.success ? { legacyKey: legacyKey.data } : {}),
    });
    return this.api
      .request('POST', '/auth/register', AuthSessionDataSchema, {
        withCredentials: true,
        body,
      })
      .pipe(
        tap(({ user }) => {
          this.currentUser.set(user);
          localStorage.removeItem(LEGACY_KEY_STORAGE);
        }),
      );
  }

  logout(): Observable<{ loggedOut: true }> {
    return this.api
      .request('POST', '/auth/logout', AuthLogoutDataSchema, {
        withCredentials: true,
        body: {},
      })
      .pipe(tap(() => this.currentUser.set(null)));
  }
}
