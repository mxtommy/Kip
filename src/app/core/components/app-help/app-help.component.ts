import { Component, inject, effect, signal, computed, DestroyRef } from '@angular/core';
import { MarkdownComponent } from 'ngx-markdown';
import { httpResource } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

interface HelpMenuEntry {
  title: string;
  file: string;
}

interface HelpMenuGroup {
  title: string;
  items: HelpMenuEntry[];
}

type HelpMenuNode = HelpMenuEntry | HelpMenuGroup;

interface RawHelpMenuEntry {
  title?: string;
  file?: string;
  items?: RawHelpMenuEntry[];
}

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
  private readonly _route = inject(ActivatedRoute);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _isMobileMenuMode = signal<boolean>(this.detectMobileMenuMode());
  private readonly _selectedPageFromRoute = toSignal(
    this._route.paramMap.pipe(map(params => params.get('page'))),
    { initialValue: null }
  );

  constructor() {
    const mediaQuery = this.getMobileMenuMediaQuery();
    if (mediaQuery === null) {
      return;
    }

    this._isMobileMenuMode.set(mediaQuery.matches);
    const updateMobileMode = (event: MediaQueryListEvent): void => {
      this._isMobileMenuMode.set(event.matches);
    };

    mediaQuery.addEventListener('change', updateMobileMode);
    this._destroyRef.onDestroy(() => {
      mediaQuery.removeEventListener('change', updateMobileMode);
    });
  }

  // Resource for the help menu JSON (reactive & eagerly fetched)
  private readonly _helpMenuRes = httpResource<RawHelpMenuEntry[]>(() => 'assets/help-docs/menu.json');

  protected readonly helpMenuItems = computed<HelpMenuNode[]>(() => {
    if (!this._helpMenuRes.hasValue()) {
      return [];
    }

    return this.normalizeMenu(this._helpMenuRes.value() ?? []);
  });

  // Raw list (filtered) as a signal
  protected readonly helpFiles = computed(() => {
    const menu = this.helpMenuItems();
    if (menu.length === 0) {
      return [] as HelpMenuEntry[];
    }

    return menu.flatMap(item => this.isGroup(item) ? item.items : [item]);
  });

  // Selected file signal (empty until helpFiles first populated)
  protected selectedFile = signal<string>('');

  // Keep selected file synchronized with route and loaded menu
  private _syncEffect = effect(() => {
    const files = this.helpFiles();
    const page = this._selectedPageFromRoute();
    if (files.length === 0) {
      return;
    }

    const resolvedFile = this.resolveSelectedFile(page, files);
    if (this.selectedFile() !== resolvedFile) {
      this.selectedFile.set(resolvedFile);
    }
  });

  protected hasError = computed(() => this._helpMenuRes.error() != null);
  protected isLoading = computed(() => this._helpMenuRes.isLoading());
  protected isMobileMenuMode = computed(() => this._isMobileMenuMode());

  protected isGroup(item: HelpMenuNode): item is HelpMenuGroup {
    return 'items' in item;
  }

  protected selectFile(file: string): void {
    this.selectedFile.set(file);
    this._router.navigate(['/help', this.toPageSegment(file)]);
  }

  protected backPage() {
    this._router.navigate(['/settings']);
  }

  protected closePage(): void {
    this._router.navigate(['/dashboard']);
  }

  private resolveSelectedFile(page: string | null, files: HelpMenuEntry[]): string {
    if (page) {
      const requestedFile = page.endsWith('.md') ? page : `${page}.md`;
      const matched = files.find(file => file.file === requestedFile);
      if (matched) {
        return matched.file;
      }
    }

    return files[0].file;
  }

  private toPageSegment(file: string): string {
    return file.endsWith('.md') ? file.slice(0, -3) : file;
  }

  private normalizeMenu(menu: RawHelpMenuEntry[]): HelpMenuNode[] {
    const normalized: HelpMenuNode[] = [];

    menu.forEach(item => {
      const title = (item.title ?? '').trim();

      if (Array.isArray(item.items)) {
        const items = item.items
          .filter(this.isValidLeaf)
          .filter(entry => entry.file!.endsWith('.md'))
          .map(entry => ({
            title: entry.title!.trim(),
            file: entry.file!.trim()
          }));

        if (!title || items.length === 0) {
          return;
        }

        normalized.push({ title, items });
        return;
      }

      if (this.isValidLeaf(item) && item.file!.endsWith('.md')) {
        normalized.push({
          title: item.title!.trim(),
          file: item.file!.trim()
        });
      }
    });

    return normalized;
  }

  private isValidLeaf(item: RawHelpMenuEntry): item is Required<Pick<RawHelpMenuEntry, 'title' | 'file'>> {
    return typeof item.title === 'string' && item.title.trim().length > 0 && typeof item.file === 'string' && item.file.trim().length > 0;
  }

  private detectMobileMenuMode(): boolean {
    const mediaQuery = this.getMobileMenuMediaQuery();
    return mediaQuery?.matches ?? false;
  }

  private getMobileMenuMediaQuery(): MediaQueryList | null {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return null;
    }

    return window.matchMedia('(max-width: 900px), (hover: none) and (pointer: coarse)');
  }
}
