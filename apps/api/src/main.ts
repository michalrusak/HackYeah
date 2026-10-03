import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin:
      process.env.WEB_ORIGIN ??
      `http://localhost:${process.env.WEB_PORT ?? '4200'}`,
  });
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
