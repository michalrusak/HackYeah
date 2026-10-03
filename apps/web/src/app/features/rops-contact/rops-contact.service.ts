import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ApiConfigService } from '../../core/services/api-config.service';
import type {
  CreateConversation,
  SendMessage,
  ConversationListResponse,
  ConversationResponse,
  MessageListResponse,
  MessageResponse,
} from '@repo/api-contracts';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class RopsContactService {
  private http = inject(HttpClient);
  private config = inject(ApiConfigService);

  private get apiUrl() {
    return `${this.config.apiUrl}/contact`;
  }

  // For prototyping, we will simulate roles via headers.
  // In a real app, this would be managed by AuthService.
  public currentUserId = 'mock-citizen-123';
  public currentUserRole = 'CITIZEN'; // or 'ROPS_EMPLOYEE'

  private getHeaders() {
    return new HttpHeaders({
      'user-id': this.currentUserId,
      'user-role': this.currentUserRole,
    });
  }

  getConversations(): Observable<ConversationListResponse['data']> {
    return this.http
      .get<ConversationListResponse>(`${this.apiUrl}/conversations`, {
        headers: this.getHeaders(),
      })
      .pipe(map((res) => res.data));
  }

  createConversation(
    data: CreateConversation,
  ): Observable<ConversationResponse['data']> {
    return this.http
      .post<ConversationResponse>(`${this.apiUrl}/conversations`, data, {
        headers: this.getHeaders(),
      })
      .pipe(map((res) => res.data));
  }

  getMessages(conversationId: string): Observable<MessageListResponse['data']> {
    return this.http
      .get<MessageListResponse>(
        `${this.apiUrl}/conversations/${conversationId}/messages`,
        { headers: this.getHeaders() },
      )
      .pipe(map((res) => res.data));
  }

  sendMessage(
    conversationId: string,
    data: SendMessage,
  ): Observable<MessageResponse['data']> {
    return this.http
      .post<MessageResponse>(
        `${this.apiUrl}/conversations/${conversationId}/messages`,
        data,
        { headers: this.getHeaders() },
      )
      .pipe(map((res) => res.data));
  }
}
