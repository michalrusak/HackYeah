import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import type { Material } from '@repo/api-contracts';
import { toErrorKey } from '../../services/api-error';
import { IdeaCreatorApiService } from '../../services/idea-creator-api.service';

@Component({
  selector: 'app-materials',
  imports: [
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
    TranslatePipe,
  ],
  templateUrl: './materials.component.html',
  styleUrl: './materials.component.scss',
})
export class MaterialsComponent implements OnInit {
  private readonly api = inject(IdeaCreatorApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly materials = signal<Material[]>([]);
  readonly loading = signal(true);
  readonly errorKey = signal<string | null>(null);

  ngOnInit(): void {
    this.api
      .listMaterials()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.materials.set(data.materials);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.errorKey.set(toErrorKey(error));
          this.loading.set(false);
        },
      });
  }

  isInternal(material: Material): boolean {
    return material.url.startsWith('/pomysly');
  }
}
