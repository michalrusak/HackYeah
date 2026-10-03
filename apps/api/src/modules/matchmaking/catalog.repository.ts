import { Injectable } from '@nestjs/common';
import { InnovationCatalogSchema, type Innovation } from '@repo/api-contracts';
import catalog from './catalog.v1.json' with { type: 'json' };

@Injectable()
export class CatalogRepository {
  private readonly catalog = InnovationCatalogSchema.parse(catalog);

  findAll(): readonly Innovation[] {
    return this.catalog.innovations;
  }
}
