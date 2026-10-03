import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiConfigService } from './api-config.service';

describe('ApiConfigService', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }),
  );
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('loads the public API address and removes a trailing slash', async () => {
    const service = TestBed.inject(ApiConfigService);
    const loading = service.load();
    TestBed.inject(HttpTestingController)
      .expectOne('/api-config.json')
      .flush({ apiUrl: 'https://api.example.org/api/' });
    await loading;
    expect(service.apiUrl).toBe('https://api.example.org/api');
  });

  it('rejects unsafe URL protocols', async () => {
    const loading = TestBed.inject(ApiConfigService).load();
    TestBed.inject(HttpTestingController)
      .expectOne('/api-config.json')
      .flush({ apiUrl: 'javascript:alert(1)' });
    await expectAsync(loading).toBeRejected();
  });
});
