import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ContactDraftService {
  private draft: { subject: string; body: string } | null = null;
  set(subject: string, body: string): void {
    this.draft = { subject, body };
  }
  take(): { subject: string; body: string } | null {
    const draft = this.draft;
    this.draft = null;
    return draft;
  }
}
