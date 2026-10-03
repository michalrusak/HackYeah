import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'hackyeah-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly isDark = signal(this.readInitialTheme());

  constructor() {
    this.applyTheme(this.isDark());
  }

  toggle(): void {
    this.setDark(!this.isDark());
  }

  setDark(isDark: boolean): void {
    this.isDark.set(isDark);
    localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
    this.applyTheme(isDark);
  }

  private readInitialTheme(): boolean {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  private applyTheme(isDark: boolean): void {
    document.documentElement.classList.toggle('dark-theme', isDark);
  }
}
