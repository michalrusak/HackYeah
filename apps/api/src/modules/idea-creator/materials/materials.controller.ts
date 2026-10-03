import { Controller, Get } from '@nestjs/common';
import {
  createApiSuccess,
  MaterialCatalogSchema,
  type ApiSuccessResponse,
  type MaterialListData,
} from '@repo/api-contracts';
import catalog from './materials.v1.json' with { type: 'json' };

@Controller('materials')
export class MaterialsController {
  // Manifest materiałów do prototypowania. Plansze Canw przekazywane
  // uczestnikom przez ROPS wystarczy wrzucić do `apps/web/public/materials/`
  // i przestawić `pending` na false.
  private readonly catalog = MaterialCatalogSchema.parse(catalog);

  @Get()
  list(): ApiSuccessResponse<MaterialListData> {
    return createApiSuccess({ materials: this.catalog.materials });
  }
}
