import { Component, inject, effect, signal, computed } from '@angular/core';
import { MarkdownComponent } from 'ngx-markdown';
import { httpResource } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { Router } from '@angular/router';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [MarkdownComponent, MatButtonModule, MatMenuModule, MatDividerModule, MatIconModule],
  templateUrl: './app-help.component.html',
  styleUrl: './app-help.component.scss'
})
export class AppHelpComponent {
  protected readonly pageTitle = 'Help';
  private readonly _router = inject(Router);

  // Resource for the help menu JSON (reactive & eagerly fetched)
  private readonly _helpMenuRes = httpResource<{ title: string; file: string }[]>(() => 'assets/help-docs/menu.json');

  // Raw list (filtered) as a signal
  protected readonly helpFiles = computed(() => {
    if (this._helpMenuRes.hasValue()) {
      return (this._helpMenuRes.value() ?? []).filter(item => item.file.endsWith('.md'));
    }
    return [] as { title: string; file: string }[];
  });

  // Selected file signal (empty until helpFiles first populated)
  protected selectedFile = signal<string>('');

  // Initialize default selection reactively when data arrives first time
  private _initSelectionOnce = signal<boolean>(false);
  private _syncEffect = effect(() => {
    const files = this.helpFiles();
    if (!this._initSelectionOnce() && files.length > 0) {
      this.selectedFile.set(files[0].file);
      this._initSelectionOnce.set(true);
    }
  });

  protected hasError = computed(() => this._helpMenuRes.error() != null);
  protected isLoading = computed(() => this._helpMenuRes.isLoading());

  protected selectFile(file: string): void {
    this.selectedFile.set(file);
  }

  protected backPage() {
    this._router.navigate(['/settings']);
  }

  protected closePage(): void {
    this._router.navigate(['/dashboard']);
  }
}
