import { MatDialog } from '@angular/material/dialog';
import { Observable, map, of } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import {
  AuthDialogComponent,
  type AuthMode,
} from '../../auth/auth-dialog.component';

export function projectAccount(
  dialog: MatDialog,
  auth: AuthService,
): Observable<boolean> {
  if (auth.user()) return of(true);
  return dialog
    .open<AuthDialogComponent, AuthMode, 'authenticated'>(AuthDialogComponent, {
      data: 'login',
      width: '480px',
      maxWidth: 'calc(100vw - 24px)',
      maxHeight: '94vh',
      autoFocus: 'input[formControlName="login"]',
      ariaLabelledBy: 'auth-title',
      ariaDescribedBy: 'auth-intro',
    })
    .afterClosed()
    .pipe(map((status) => status === 'authenticated'));
}
