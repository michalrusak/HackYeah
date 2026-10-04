import { Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { TranslateService } from '@ngx-translate/core';

@Injectable()
export class PolishPaginatorIntl extends MatPaginatorIntl {
  private readonly translate = inject(TranslateService);
  constructor() {
    super();
    this.translate
      .stream('a11y.paginator')
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.itemsPerPageLabel = this.translate.instant('a11y.paginator.items');
        this.nextPageLabel = this.translate.instant('a11y.paginator.next');
        this.previousPageLabel = this.translate.instant(
          'a11y.paginator.previous',
        );
        this.firstPageLabel = this.translate.instant('a11y.paginator.first');
        this.lastPageLabel = this.translate.instant('a11y.paginator.last');
        this.changes.next();
      });
    this.getRangeLabel = (page, size, length): string =>
      this.translate.instant('a11y.paginator.range', {
        start: length && size ? page * size + 1 : 0,
        end: Math.min((page + 1) * size, length),
        total: length,
      });
  }
}
