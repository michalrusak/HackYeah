import { Injectable, inject } from '@angular/core';
import {
  ContactListDataSchema,
  ContactThreadDataSchema,
  CreateConversationSchema,
  SendMessageSchema,
  type ContactListData,
  type ContactThreadData,
  type CreateConversation,
} from '@repo/api-contracts';
import type { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';

/** Rozmowy zalogowanego użytkownika z ROPS — tożsamość niesie ciasteczko sesji. */
@Injectable({ providedIn: 'root' })
export class RopsContactService {
  private readonly api = inject(ApiService);

  conversations(): Observable<ContactListData> {
    return this.api.request(
      'GET',
      '/contact/conversations',
      ContactListDataSchema,
      { withCredentials: true },
    );
  }

  thread(id: string): Observable<ContactThreadData> {
    return this.api.request(
      'GET',
      `/contact/conversations/${encodeURIComponent(id)}`,
      ContactThreadDataSchema,
      { withCredentials: true },
    );
  }

  create(input: CreateConversation): Observable<ContactThreadData> {
    return this.api.request(
      'POST',
      '/contact/conversations',
      ContactThreadDataSchema,
      { withCredentials: true, body: CreateConversationSchema.parse(input) },
    );
  }

  send(id: string, content: string): Observable<ContactThreadData> {
    return this.api.request(
      'POST',
      `/contact/conversations/${encodeURIComponent(id)}/messages`,
      ContactThreadDataSchema,
      { withCredentials: true, body: SendMessageSchema.parse({ content }) },
    );
  }
}
