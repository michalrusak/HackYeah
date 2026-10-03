import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { KnowledgeImportSchema } from '@repo/api-contracts';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import seed from './resources.v1.json' with { type: 'json' };

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
  ],
})
class SeedModule {}

const inputs = KnowledgeImportSchema.parse({
  resources: seed.resources,
}).resources;
const app = await NestFactory.createApplicationContext(SeedModule, {
  logger: false,
});
try {
  const prisma = app.get(PrismaService);
  const result = await prisma.knowledgeResource.createMany({
    data: inputs,
    skipDuplicates: true,
  });
  let facts = 0;
  for (const input of inputs.filter((item) => item.facts.length)) {
    const updated = await prisma.knowledgeResource.updateMany({
      where: { id: input.id, revision: 1, facts: { equals: [] } },
      data: { facts: input.facts },
    });
    facts += updated.count;
  }
  let videos = 0;
  for (const input of inputs.filter((item) => item.videoUrl)) {
    const updated = await prisma.knowledgeResource.updateMany({
      where: { id: input.id, revision: 1, videoUrl: null },
      data: { videoUrl: input.videoUrl },
    });
    videos += updated.count;
  }
  console.log(
    `Zasobnik: dodano ${result.count} zasobów, w nieedytowanych wpisach uzupełniono liczby (${facts}) i filmy (${videos}); pozostałe bez zmian.`,
  );
} finally {
  await app.close();
}
