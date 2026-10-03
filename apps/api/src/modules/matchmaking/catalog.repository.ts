import { Injectable } from '@nestjs/common';
import {
  InnovationCatalogSchema,
  InformationCatalogSchema,
  type Innovation,
  type RelatedInformation,
} from '@repo/api-contracts';
import catalog from './catalog.v1.json' with { type: 'json' };
import information from './information.v1.json' with { type: 'json' };

@Injectable()
export class CatalogRepository {
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
}
