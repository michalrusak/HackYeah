import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { allowedWebOrigins } from './modules/auth/auth-http.js';
import { DomainExceptionFilter } from './shared/filters/domain-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new DomainExceptionFilter());
  app.enableCors({
    origin: allowedWebOrigins(),
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
