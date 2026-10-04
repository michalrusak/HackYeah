import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { routes } from '../../app.routes';
import { IdeaWorkspaceComponent } from './idea-workspace.component';
import { AssistantPanelComponent } from './components/assistant-panel/assistant-panel.component';
import { IdeaCreatorApiService } from './services/idea-creator-api.service';

describe('Creator navigation', () => {
  let api: jasmine.SpyObj<IdeaCreatorApiService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<IdeaCreatorApiService>('IdeaCreatorApiService', [
      'listIdeas',
      'listMaterials',
      'listCalls',
      'getApplication',
      'getIdea',
    ]);
    api.listIdeas.and.returnValue(
      of({ items: [], total: 0, page: 1, pageSize: 12 }),
    );
    api.listMaterials.and.returnValue(of({ materials: [] }));
    api.listCalls.and.returnValue(
      of({ calls: [], hasOpenCall: false, nextOpeningAt: null }),
    );
    api.getApplication.and.returnValue(
      throwError(() => new Error('Not found')),
    );
    await TestBed.configureTestingModule({
      providers: [
        provideRouter(routes[0]?.children ?? []),
        provideNoopAnimations(),
        provideTranslateService(),
        { provide: IdeaCreatorApiService, useValue: api },
      ],
    }).compileComponents();
  });

  it('opens materials inside the creator and preserves legacy query and fragment', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(
      '/materialy?source=bookmark#canva',
      IdeaWorkspaceComponent,
    );
    expect(TestBed.inject(Router).url).toBe(
      '/pomysly/materialy?source=bookmark#canva',
    );
    expect(
      harness.routeNativeElement?.querySelector('app-materials'),
    ).not.toBeNull();
    expect(api.listMaterials).toHaveBeenCalledTimes(1);
    expect(api.getIdea).not.toHaveBeenCalled();
  });

  it('redirects legacy calls and retains closed-call guidance', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/nabory', IdeaWorkspaceComponent);
    expect(TestBed.inject(Router).url).toBe('/pomysly/nabory');
    expect(harness.routeNativeElement?.textContent).toContain(
      'ideaCreator.calls.closedTitle',
    );
    expect(harness.routeNativeElement?.textContent).not.toContain(
      'ideaCreator.calls.chooseIdea',
    );
  });

  it('preserves application identifiers in bookmarked legacy URLs', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(
      '/nabory/call-1/wniosek/application-1',
      IdeaWorkspaceComponent,
    );
    expect(TestBed.inject(Router).url).toBe(
      '/pomysly/nabory/call-1/wniosek/application-1',
    );
    expect(api.getApplication).toHaveBeenCalledWith('application-1', undefined);
    expect(
      harness.routeNativeElement?.querySelector('app-application'),
    ).not.toBeNull();
  });

  it('retains the assistant conversation and draft across creator sections', async () => {
    const harness = await RouterTestingHarness.create();
    const workspace = await harness.navigateByUrl(
      '/pomysly',
      IdeaWorkspaceComponent,
    );
    const assistant = harness.routeDebugElement
      ?.query(By.directive(AssistantPanelComponent))
      .injector.get(AssistantPanelComponent);
    expect(assistant).toBeDefined();
    assistant?.message.setValue('Jak przetestować mój pomysł?');
    assistant?.entries.set([
      { role: 'assistant', content: 'Zacznij od małego prototypu.' },
    ]);
    for (const path of ['/pomysly/materialy', '/pomysly/nabory', '/pomysly']) {
      expect(await harness.navigateByUrl(path, IdeaWorkspaceComponent)).toBe(
        workspace,
      );
      const current = harness.routeDebugElement
        ?.query(By.directive(AssistantPanelComponent))
        .injector.get(AssistantPanelComponent);
      expect(current).toBe(assistant);
      expect(current?.message.value).toBe('Jak przetestować mój pomysł?');
      expect(current?.entries()[0]?.content).toBe(
        'Zacznij od małego prototypu.',
      );
    }
  });
});
