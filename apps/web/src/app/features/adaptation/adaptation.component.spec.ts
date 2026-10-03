import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService } from '@ngx-translate/core';
import { type AdaptationData } from '@repo/api-contracts';
import { AdaptationComponent } from './adaptation.component';
import { AdaptationService } from './adaptation.service';
import { ContactDraftService } from '../../core/services/contact-draft.service';

const result: AdaptationData = {
  advice: {
    message: 'Ustalamy zakres.',
    question: 'Jak często dostępne jest auto?',
    suggestedAnswers: ['Raz w tygodniu'],
    objective: 'Wsparcie domowe.',
    resources: [],
    proposals: [],
    gaps: ['Transport.'],
    nextSteps: ['Potwierdzić transport.'],
    budget: 'Brak wycen.',
    changes: [],
  },
  sources: [{ id: 'rops', label: 'ROPS', url: 'https://rops.krakow.pl/' }],
};

describe('AdaptationComponent', () => {
  let fixture: ComponentFixture<AdaptationComponent>;
  let http: HttpTestingController;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdaptationComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNoopAnimations(),
        provideTranslateService(),
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdaptationComponent);
    fixture.detectChanges();
  });
  afterEach(() => http.verify());
  function start() {
    fixture.componentInstance.need.setValue(
      'Seniorzy potrzebują wizyt domowych.',
    );
    const root: HTMLElement = fixture.nativeElement;
    root
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    http
      .expectOne((r) => r.url.endsWith('/adaptations'))
      .flush({ success: true, data: result });
    fixture.detectChanges();
  }

  it('submits the actual form and updates the plan while preserving the original need', () => {
    start();
    const component = fixture.componentInstance;
    component.send('Auto co dwa tygodnie.');
    component.send('Duplicate');
    const request = http.expectOne((r) => r.url.endsWith('/adaptations'));
    expect(request.request.body.need).toBe(
      'Seniorzy potrzebują wizyt domowych.',
    );
    expect(request.request.body.turns).toEqual([
      { question: result.advice.question, answer: 'Auto co dwa tygodnie.' },
    ]);
    request.flush({
      success: true,
      data: {
        ...result,
        advice: { ...result.advice, changes: ['Rzadszy transport.'] },
      },
    });
    fixture.detectChanges();
    expect(component.session.turns().length).toBe(1);
    const root: HTMLElement = fixture.nativeElement;
    expect(root.textContent).toContain('Rzadszy transport.');
  });

  it('retains the old plan and answer on failure, and retries without duplicate turns', () => {
    start();
    const component = fixture.componentInstance;
    component.send('Auto co dwa tygodnie.');
    http
      .expectOne((r) => r.url.endsWith('/adaptations'))
      .flush(
        { success: false, error: { code: 'AI_TIMEOUT', message: 'Timeout' } },
        { status: 504, statusText: 'Timeout' },
      );
    expect(component.session.result()).toEqual(result);
    expect(component.session.turns()).toEqual([]);
    expect(component.answer.value).toBe('Auto co dwa tygodnie.');
    component.send();
    const retry = http.expectOne((r) => r.url.endsWith('/adaptations'));
    expect(retry.request.body.turns.length).toBe(1);
    retry.flush({ success: true, data: result });
  });

  it('prepares a bounded contact draft without submitting it', () => {
    start();
    const session = TestBed.inject(AdaptationService);
    session.result.set({
      ...result,
      advice: {
        ...result.advice,
        objective: 'x'.repeat(600),
        budget: 'y'.repeat(600),
        gaps: Array.from({ length: 6 }, () => 'z'.repeat(600)),
      },
    });
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(
      true,
    );
    fixture.componentInstance.prepareContact();
    const draft = TestBed.inject(ContactDraftService).take();
    expect(draft?.body.length).toBeLessThanOrEqual(4000);
    expect(navigate).toHaveBeenCalledWith(['/rops-contact']);
    http.expectNone((r) => r.method === 'POST');
  });

  it('downloads the complete plan including resources, source links and uncertainty', async () => {
    start();
    let downloaded: Blob | undefined;
    spyOn(URL, 'createObjectURL').and.callFake((blob: Blob | MediaSource) => {
      if (blob instanceof Blob) downloaded = blob;
      return 'blob:test-plan';
    });
    spyOn(HTMLAnchorElement.prototype, 'click');
    spyOn(URL, 'revokeObjectURL');
    fixture.componentInstance.exportPlan();
    if (!downloaded) throw new Error('Expected a downloadable plan');
    const text = await downloaded.text();
    expect(text).toContain('Seniorzy potrzebują wizyt domowych.');
    expect(text).toContain('Brak wycen.');
    expect(text).toContain('https://rops.krakow.pl/');
    expect(text).toContain('adaptation.disclaimer');
  });
});
