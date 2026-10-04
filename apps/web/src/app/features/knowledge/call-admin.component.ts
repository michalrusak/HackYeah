import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import type { AdminGrantCall, CallSection } from '@repo/api-contracts';
import { KnowledgeService } from './knowledge.service';

interface SectionModel {
  title: string;
  question: string;
  help: string;
  maxLength: number;
}

@Component({
  selector: 'app-call-admin',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslatePipe,
  ],
  templateUrl: './call-admin.component.html',
  styleUrls: ['./call-admin.component.scss'],
})
export class CallAdminComponent {
  private readonly knowledgeService = inject(KnowledgeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly calls = signal<AdminGrantCall[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly showCreate = signal(false);

  readonly sections = signal<SectionModel[]>([
    {
      title: 'Opis innowacji i cel',
      question: 'Jaki problem społeczny rozwiązuje projekt i do kogo jest skierowany?',
      help: 'Opisz diagnozę sytuacji, grupę docelową oraz zakładane rezultaty innowacji.',
      maxLength: 2500,
    },
    {
      title: 'Plan wdrożenia i zespół',
      question: 'Jak planujesz przetestować lub wdrożyć innowację w swojej gminie/społeczności?',
      help: 'Wskaż kluczowe etapy, harmonogram oraz zaangażowane role lub partnerów.',
      maxLength: 2000,
    },
    {
      title: 'Budżet i zasoby',
      question: 'Na co zostaną przeznaczone środki z grantu?',
      help: 'Wyszczególnij główne kategorie wydatków i ewentualny wkład własny.',
      maxLength: 1500,
    },
  ]);

  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(250)],
    }),
    operator: new FormControl('Regionalny Ośrodek Polityki Społecznej w Krakowie', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(5000)],
    }),
    opensAt: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    closesAt: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    budget: new FormControl('', { nonNullable: true }),
    maxGrant: new FormControl('', { nonNullable: true }),
    isPublished: new FormControl(true, { nonNullable: true }),
  });

  constructor() {
    this.loadCalls();
  }

  loadCalls(): void {
    this.loading.set(true);
    this.error.set(null);
    this.knowledgeService
      .adminCalls()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.calls.set(data.calls);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Nie udało się załadować listy naborów.');
        },
      });
  }

  togglePublish(call: AdminGrantCall): void {
    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);
    this.knowledgeService
      .adminToggleCallPublish(call.id, !call.isPublished)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.calls.update((list) =>
            list.map((c) => (c.id === call.id ? res.call : c)),
          );
          this.loading.set(false);
          this.success.set(
            res.call.isPublished
              ? 'Nabór został opublikowany.'
              : 'Nabór został wycofany z publikacji.',
          );
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Nie udało się zmienić statusu naboru.');
        },
      });
  }

  addSection(): void {
    this.sections.update((curr) => [
      ...curr,
      {
        title: `Sekcja ${curr.length + 1}`,
        question: 'Wpisz pytanie do wnioskodawcy',
        help: '',
        maxLength: 2000,
      },
    ]);
  }

  removeSection(index: number): void {
    if (this.sections().length <= 1) return;
    this.sections.update((curr) => curr.filter((_, i) => i !== index));
  }

  updateSection(index: number, field: keyof SectionModel, value: string | number): void {
    this.sections.update((curr) =>
      curr.map((sec, i) => (i === index ? { ...sec, [field]: value } : sec)),
    );
  }

  submitCreate(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const val = this.form.getRawValue();
    const secs: CallSection[] = this.sections().map((s, idx) => ({
      id: `sec-${idx + 1}-${Date.now()}`,
      title: s.title,
      question: s.question,
      help: s.help || '',
      maxLength: Number(s.maxLength) || 2000,
      required: true,
      order: idx + 1,
    }));

    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);

    this.knowledgeService
      .adminCreateCall({
        name: val.name,
        operator: val.operator,
        description: val.description,
        opensAt: new Date(val.opensAt).toISOString(),
        closesAt: new Date(val.closesAt).toISOString(),
        budget: val.budget ? val.budget : undefined,
        maxGrant: val.maxGrant ? val.maxGrant : undefined,
        sections: secs,
        isPublished: val.isPublished,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.calls.update((curr) => [res.call, ...curr]);
          this.showCreate.set(false);
          this.loading.set(false);
          this.success.set('Nabór został pomyślnie utworzony.');
          this.form.reset({
            name: '',
            operator: 'Regionalny Ośrodek Polityki Społecznej w Krakowie',
            description: '',
            opensAt: '',
            closesAt: '',
            budget: '',
            maxGrant: '',
            isPublished: true,
          });
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Nie udało się utworzyć naboru grantowego.');
        },
      });
  }
}
