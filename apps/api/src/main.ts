import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { allowedWebOrigins } from './modules/auth/auth-http.js';
import { DomainExceptionFilter } from './shared/filters/domain-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  app.useBodyParser('json', { limit: '512kb' });
  app.useGlobalFilters(new DomainExceptionFilter());
  app.enableCors({
    origin: allowedWebOrigins(),
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
