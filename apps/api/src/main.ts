import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureCorsOrigin } from './modules/auth/auth-http.js';
import { DomainExceptionFilter } from './shared/filters/domain-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  if (process.env.TRUST_PROXY !== 'false') {
    app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1));
  }
  app.setGlobalPrefix('api');
  app.useBodyParser('json', { limit: '512kb' });
  app.useGlobalFilters(new DomainExceptionFilter());
  app.enableCors({
    origin: configureCorsOrigin,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    // Nagłówki własne aplikacji: bez nich przeglądarka blokuje zapisy przy
    // API pod innym adresem niż frontend (np. `pnpm start`).
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Knowledge-CSRF',
      'X-CSRF-Token',
      'X-Edit-Token',
      'X-Tester-Key',
    ],
  });
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
