import { Injectable, computed, signal } from '@angular/core';
import { z } from 'zod';

/**
 * Zamiast kont użytkowników trzymamy sekrety zwrócone przez API. Dzięki temu
 * „Moje pomysły” działa bez logowania, a przeniesienie na konta sprowadzi się
 * do podmiany tego serwisu.
 */
const StoredIdeaSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  token: z.string().min(1),
  savedAt: z.string(),
});

const StoredApplicationSchema = z.object({
  id: z.string().min(1),
  ideaId: z.string().min(1),
  ideaTitle: z.string(),
  callId: z.string().min(1),
  callName: z.string(),
  token: z.string().min(1),
  savedAt: z.string(),
});

export type StoredIdea = z.infer<typeof StoredIdeaSchema>;
export type StoredApplication = z.infer<typeof StoredApplicationSchema>;

const IDEAS_KEY = 'ideaCreator.ideas';
const APPLICATIONS_KEY = 'ideaCreator.applications';

@Injectable({ providedIn: 'root' })
export class EditTokenStore {
  private readonly ideasSignal = signal<StoredIdea[]>(
    read(IDEAS_KEY, StoredIdeaSchema),
  );
  private readonly applicationsSignal = signal<StoredApplication[]>(
    read(APPLICATIONS_KEY, StoredApplicationSchema),
  );

  readonly ideas = this.ideasSignal.asReadonly();
  readonly applications = this.applicationsSignal.asReadonly();
  readonly hasAnything = computed(
    () => this.ideasSignal().length > 0 || this.applicationsSignal().length > 0,
  );

  ideaToken(ideaId: string): string | undefined {
    return this.ideasSignal().find((entry) => entry.id === ideaId)?.token;
  }

  applicationToken(applicationId: string): string | undefined {
    return this.applicationsSignal().find((entry) => entry.id === applicationId)
      ?.token;
  }

  applicationFor(ideaId: string, callId: string): StoredApplication | undefined {
    return this.applicationsSignal().find(
      (entry) => entry.ideaId === ideaId && entry.callId === callId,
    );
  }

  rememberIdea(entry: Omit<StoredIdea, 'savedAt'>): void {
    this.ideasSignal.update((current) => {
      const next = current.filter((item) => item.id !== entry.id);
      next.unshift({ ...entry, savedAt: new Date().toISOString() });
      return next;
    });
    write(IDEAS_KEY, this.ideasSignal());
  }

  renameIdea(ideaId: string, title: string): void {
    this.ideasSignal.update((current) =>
      current.map((item) => (item.id === ideaId ? { ...item, title } : item)),
    );
    write(IDEAS_KEY, this.ideasSignal());
  }

  forgetIdea(ideaId: string): void {
    this.ideasSignal.update((current) =>
      current.filter((item) => item.id !== ideaId),
    );
    this.applicationsSignal.update((current) =>
      current.filter((item) => item.ideaId !== ideaId),
    );
    write(IDEAS_KEY, this.ideasSignal());
    write(APPLICATIONS_KEY, this.applicationsSignal());
  }

  rememberApplication(entry: Omit<StoredApplication, 'savedAt'>): void {
    this.applicationsSignal.update((current) => {
      const next = current.filter((item) => item.id !== entry.id);
      next.unshift({ ...entry, savedAt: new Date().toISOString() });
      return next;
    });
    write(APPLICATIONS_KEY, this.applicationsSignal());
  }
}

function read<T extends z.ZodType>(key: string, schema: T): z.infer<T>[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = z.array(schema).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    // Prywatny tryb przeglądarki albo uszkodzony wpis — zaczynamy od pustej listy.
    return [];
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Brak miejsca lub zablokowany storage nie może przerwać zapisu fiszki.
  }
}
