import { ContactDraftService } from '../../core/services/contact-draft.service';
import {
  Component,
  OnInit,
  inject,
  ElementRef,
  afterNextRender,
  Injector,
  viewChild,
  viewChildren,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgModel } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
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
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly conversationHeading = viewChild<ElementRef<HTMLElement>>(
    'conversationHeading',
  );
  private readonly fields = viewChildren(NgModel);
  loading = false;
  sending = false;
  errorKey = '';
  announcement = '';

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
    this.loading = true;
    this.errorKey = '';
    this.contactService.getConversations().subscribe({
      next: (data) => {
        this.conversations = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.errorKey = 'a11y.loadError';
      },
    });
  }

  selectConversation(conv: Conversation) {
    this.selectedConversation = conv;
    this.messages = [];
    this.errorKey = '';
    this.loading = true;
    this.isCreatingNew = false;
    this.contactService.getMessages(conv.id).subscribe({
      next: (data) => {
        if (this.selectedConversation?.id !== conv.id) return;
        this.messages = data;
        this.loading = false;
        afterNextRender(
          () => this.conversationHeading()?.nativeElement.focus(),
          { injector: this.injector },
        );
      },
      error: () => {
        this.loading = false;
        this.errorKey = 'a11y.loadError';
      },
    });
  }

  createNewConversation() {
    this.isCreatingNew = true;
    this.selectedConversation = null;
    this.newSubject = '';
    this.newMessage = '';
    this.newFirstName = '';
    this.newLastName = '';
    afterNextRender(
      () =>
        this.element.nativeElement
          .querySelector<HTMLElement>('[name=firstName]')
          ?.focus(),
      { injector: this.injector },
    );
  }

  sendMessage() {
    if (this.sending || (!this.isCreatingNew && !this.selectedConversation))
      return;
    this.errorKey = '';
    this.announcement = '';
    for (const field of this.fields()) field.control.markAsTouched();
    if (
      !this.newMessage.trim() ||
      this.newMessage.length > 4000 ||
      (this.isCreatingNew &&
        (!this.newSubject.trim() ||
          !this.newFirstName.trim() ||
          !this.newLastName.trim()))
    ) {
      this.errorKey = 'a11y.contactValidation';
      afterNextRender(
        () =>
          (
            this.element.nativeElement.querySelector<HTMLElement>(
              'input.ng-invalid, textarea.ng-invalid',
            ) ??
            this.element.nativeElement.querySelector<HTMLElement>(
              '[role=alert]',
            )
          )?.focus(),
        { injector: this.injector },
      );
      return;
    }
    this.sending = true;

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
            this.sending = false;
            this.announcement = 'a11y.sent';
            this.loadConversations();
            this.selectConversation(conv);
            this.newMessage = '';
          },
          error: () => {
            this.sending = false;
            this.errorKey = 'a11y.sendError';
          },
        });
    } else if (this.selectedConversation) {
      this.contactService
        .sendMessage(this.selectedConversation.id, {
          content: this.newMessage,
        })
        .subscribe({
          next: (msg) => {
            this.sending = false;
            this.announcement = 'a11y.sent';
            this.messages.push(msg);
            this.newMessage = '';
          },
          error: () => {
            this.sending = false;
            this.errorKey = 'a11y.sendError';
          },
        });
    }
  }
}
