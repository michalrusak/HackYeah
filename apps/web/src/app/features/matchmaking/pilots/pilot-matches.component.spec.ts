import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of, Subject, throwError } from 'rxjs';
import {
  PilotMatchSchema,
  type Interpretation,
  type PilotMatchesData,
} from '@repo/api-contracts';
import { PilotMatchesComponent } from './pilot-matches.component';
import { PilotMatchesService } from './pilot-matches.service';

const interpretation: Interpretation = {
  summary: 'Pomoc w znalezieniu usług',
  audiences: ['Osoby w kryzysie bezdomności'],
  areas: ['Bezdomność'],
  needs: ['Dostęp do usług'],
  missingInformation: [],
};
const match = PilotMatchSchema.parse({
  id: '96c266b4-ae90-472b-ac84-01a163025121',
  title: 'Projekt testowy',
  description: 'Opis testu',
  organizerName: 'Organizator',
  requirements: 'Dostęp do przeglądarki',
  mode: 'remote',
  location: '',
  conditions: {
    audiences: interpretation.audiences,
    needs: interpretation.needs,
    areas: interpretation.areas,
    recruitmentEndsAt: '2099-01-01T00:00:00Z',
    testSchedule: 'Dwa spotkania',
    commitment: 'Dwie godziny i ankieta',
    participants: 'organization',
  },
  matchedNeeds: interpretation.needs,
  matchedAudiences: interpretation.audiences,
  status: 'testing',
  deploymentApproved: false,
});
describe('PilotMatchesComponent', () => {
  let fixture: ComponentFixture<PilotMatchesComponent>;
  const service = { match: jasmine.createSpy('match') };
  beforeEach(async () => {
    service.match.and.returnValue(of({ matches: [match] }));
    service.match.calls.reset();
    await TestBed.configureTestingModule({
      imports: [PilotMatchesComponent],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: PilotMatchesService, useValue: service },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PilotMatchesComponent);
    fixture.componentRef.setInput('interpretation', interpretation);
  });
  it('loads automatically only for an empty result and displays a warning and native expandable conditions', () => {
    fixture.componentRef.setInput('automatic', true);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(service.match).toHaveBeenCalledOnceWith(interpretation);
    expect(root.querySelectorAll('.pilot-card').length).toBe(1);
    expect(root.querySelector('.pilot-warning')?.textContent).toContain(
      'pilots.warning',
    );
    expect(root.querySelector('.pilot-badge mat-icon')?.textContent).toBe(
      'error_outline',
    );
    expect(root.querySelector('details summary')).not.toBeNull();
  });
  it('requires the user to reject existing results before searching pilots', () => {
    fixture.detectChanges();
    expect(service.match).not.toHaveBeenCalled();
    const root: HTMLElement = fixture.nativeElement;
    root.querySelector<HTMLButtonElement>('.alternative button')?.click();
    fixture.detectChanges();
    expect(service.match).toHaveBeenCalledOnceWith(interpretation);
    expect(root.querySelector('.pilot-card')).not.toBeNull();
  });
  it('distinguishes a failed request from an empty result and supports retry', () => {
    service.match.and.returnValue(throwError(() => new Error('offline')));
    fixture.componentRef.setInput('automatic', true);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('[role=alert]')).not.toBeNull();
    expect(root.textContent).not.toContain('pilots.empty');
    service.match.and.returnValue(of({ matches: [] }));
    root.querySelector<HTMLButtonElement>('button')?.click();
    fixture.detectChanges();
    expect(root.querySelector('[role=alert]')).toBeNull();
    expect(root.textContent).toContain('pilots.empty');
  });
  it('shows a real external source and unknown deadline without a local application form', () => {
    service.match.and.returnValue(
      of({
        matches: [
          {
            ...match,
            mode: null,
            conditions: { ...match.conditions, recruitmentEndsAt: null },
            external: {
              sourceUrl: 'https://example.org/pilot',
              sourceLabel: 'Author announcement',
              verifiedAt: '2026-10-04',
            },
          },
        ],
      }),
    );
    fixture.componentRef.setInput('automatic', true);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.textContent).toContain('pilots.externalBadge');
    expect(root.textContent).toContain('pilots.unknownDeadline');
    expect(root.textContent).not.toContain('pilots.demo');
    expect(root.querySelector('app-pilot-interest')).toBeNull();
    expect(root.querySelector('.conditions button')).toBeNull();
    expect(root.querySelector<HTMLAnchorElement>('.conditions a')?.href).toBe(
      'https://example.org/pilot',
    );
  });
  it('cancels old requests when the interpreted need changes', () => {
    const previous = new Subject<PilotMatchesData>();
    service.match.and.returnValue(previous);
    fixture.componentRef.setInput('automatic', true);
    fixture.detectChanges();
    service.match.and.returnValue(of({ matches: [] }));
    fixture.componentRef.setInput('interpretation', {
      ...interpretation,
      summary: 'Nowa potrzeba',
    });
    fixture.detectChanges();
    previous.next({ matches: [match] });
    fixture.detectChanges();
    expect(fixture.componentInstance.matches()).toEqual([]);
  });
});
