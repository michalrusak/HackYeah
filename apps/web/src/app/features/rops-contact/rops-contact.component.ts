import { ContactDraftService } from '../../core/services/contact-draft.service';
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { RopsContactService } from './rops-contact.service';
import type { Conversation, Message } from '@repo/api-contracts';

@Component({
  selector: 'app-rops-contact',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatListModule,
    MatButtonModule,
    MatInputModule,
    MatIconModule,
    MatDividerModule,
    MatSelectModule,
    TranslatePipe,
  ],
  templateUrl: './rops-contact.component.html',
  styleUrls: ['./rops-contact.component.scss'],
})
export class RopsContactComponent implements OnInit {
  public contactService = inject(RopsContactService);
  private translate = inject(TranslateService);

  conversations: Conversation[] = [];
  selectedConversation: Conversation | null = null;
  messages: Message[] = [];

  newMessage = '';
  newSubject = '';
  newFirstName = '';
  newLastName = '';

  isCreatingNew = false;

  roles = [
    { value: 'CITIZEN', viewValue: 'rops-contact.roles.citizen' },
    { value: 'ROPS_EMPLOYEE', viewValue: 'rops-contact.roles.employee' },
  ];

  get currentRole() {
    return this.contactService.currentUserRole;
  }
  set currentRole(role: string) {
    this.contactService.currentUserRole = role;
    this.contactService.currentUserId =
      role === 'CITIZEN' ? 'mock-citizen-123' : 'mock-employee-456';
    this.loadConversations();
    this.selectedConversation = null;
    this.isCreatingNew = false;
  }

  private readonly contactDraft = inject(ContactDraftService);

  ngOnInit() {
    const draft = this.contactDraft.take();
    if (draft) {
      this.createNewConversation();
      this.newSubject = draft.subject;
      this.newMessage = draft.body;
    }
    this.loadConversations();
  }

  loadConversations() {
    this.contactService.getConversations().subscribe({
      next: (data) => {
        this.conversations = data;
      },
      error: (err) => console.error(err),
    });
  }

  selectConversation(conv: Conversation) {
    this.selectedConversation = conv;
    this.isCreatingNew = false;
    this.contactService.getMessages(conv.id).subscribe({
      next: (data) => (this.messages = data),
      error: (err) => console.error(err),
    });
  }

  createNewConversation() {
    this.isCreatingNew = true;
    this.selectedConversation = null;
    this.newSubject = '';
    this.newMessage = '';
    this.newFirstName = '';
    this.newLastName = '';
  }

  sendMessage() {
    if (!this.newMessage.trim()) return;

    if (
      this.isCreatingNew &&
      this.newSubject.trim() &&
      this.newFirstName.trim() &&
      this.newLastName.trim()
    ) {
      this.contactService
        .createConversation({
          firstName: this.newFirstName,
          lastName: this.newLastName,
          subject: this.newSubject,
          initialMessage: this.newMessage,
        })
        .subscribe({
          next: (conv) => {
            this.loadConversations();
            this.selectConversation(conv);
            this.newMessage = '';
          },
          error: (err) => console.error(err),
        });
    } else if (this.selectedConversation) {
      this.contactService
        .sendMessage(this.selectedConversation.id, {
          content: this.newMessage,
        })
        .subscribe({
          next: (msg) => {
            this.messages.push(msg);
            this.newMessage = '';
          },
          error: (err) => console.error(err),
        });
    }
  }
}
