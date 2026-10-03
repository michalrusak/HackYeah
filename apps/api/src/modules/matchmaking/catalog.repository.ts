import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  InnovationCatalogSchema,
  InformationCatalogSchema,
  InnovationSchema,
  RelatedInformationSchema,
  type Innovation,
  type RelatedInformation,
} from '@repo/api-contracts';
import catalog from './catalog.v1.json' with { type: 'json' };
import information from './information.v1.json' with { type: 'json' };
import { KnowledgeRepository } from '../knowledge/knowledge.repository.js';

@Injectable()
export class CatalogRepository {
  constructor(
    @Optional()
    @Inject(KnowledgeRepository)
    private readonly knowledge?: KnowledgeRepository,
  ) {}
  private readonly catalog = InnovationCatalogSchema.parse(catalog);
  private readonly information = InformationCatalogSchema.parse(information);

  findAll(): readonly Innovation[] {
    return this.catalog.innovations;
  }

  findInformation(): readonly RelatedInformation[] {
    return this.information.information;
  }

  metadata(): { version: number; innovationCount: number } {
    return {
      version: this.catalog.version,
      innovationCount: this.catalog.innovations.length,
    };
  }

  async snapshot(): Promise<{
    innovations: readonly Innovation[];
    information: readonly RelatedInformation[];
    metadata: { version: number; innovationCount: number };
  }> {
    if (!this.knowledge)
      return {
        innovations: this.findAll(),
        information: this.findInformation(),
        metadata: this.metadata(),
      };
    const resources = await this.knowledge.published();
    const innovations = resources
      .filter((item) => item.kind === 'innovation')
      .map((item) =>
        InnovationSchema.parse({
          id: item.id,
          name: item.title,
          description: item.summary,
          areas: item.areas,
          audiences: item.audiences,
          needs: item.needs,
          sourceUrl: item.sourceUrl,
          verifiedAt: item.verifiedAt,
        }),
      );
    const related = resources
      .filter(
        (item) =>
          ['challenge', 'report'].includes(item.kind) &&
          item.scope !== 'general' &&
          new URL(item.sourceUrl).hostname === 'rops.krakow.pl',
      )
      .map((item) =>
        RelatedInformationSchema.parse({
          id: item.id,
          title: item.title,
          summary: item.summary,
          scope: item.scope,
          sourceUrl: item.sourceUrl,
          sourceLabel: item.sourceLabel,
          verifiedAt: item.verifiedAt,
          areas: item.areas,
          needs: item.needs,
        }),
      );
    return {
      innovations,
      information: related,
      metadata: { version: 1, innovationCount: innovations.length },
    };
  }
}
