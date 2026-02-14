import { Component, computed, effect, inject, signal, DestroyRef } from '@angular/core';
import { PageHeaderComponent } from '../page-header/page-header.component';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { IKipDisplayInfo, IKipDisplayScreen } from '../../interfaces/app-interfaces';
import { AppSettingsService } from '../../services/app-settings.service';
import { TileLargeIconComponent } from '../tile-large-icon/tile-large-icon.component';
import { MatIconModule } from '@angular/material/icon';
import { DataService } from '../../services/data.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { SignalkRequestsService } from '../../services/signalk-requests.service';

@Component({
  selector: 'remote-control',
  imports: [ PageHeaderComponent, MatSidenavModule, MatListModule, MatButtonModule, MatProgressSpinnerModule, TileLargeIconComponent, MatIconModule ],
  templateUrl: './remote-control.component.html',
  styleUrl: './remote-control.component.scss'
})
export class RemoteControlComponent {
  private readonly COMMAND_REQUEST_ACTIVE_SCREEN_PATH = 'self.kip.remote.requestActiveScreen';

  private readonly _settings = inject(AppSettingsService);
  private readonly _data = inject(DataService);
  private readonly _requests = inject(SignalkRequestsService);
  private readonly _destroyRef = inject(DestroyRef);

  protected readonly pageTitle = 'Remote Control';
  private readonly appID = this._settings.KipUUID;
  private displayId = signal<string | null>(null);
  protected selectedDisplayButtonId = signal<string | null>(null);
  protected readonly screensLoading = signal<boolean>(false);
  private readonly displaysMap = signal<Record<string, IKipDisplayInfo>>({});
  private selectedDisplaySub: Subscription | null = null;
  private selectedScreenIndexSub: Subscription | null = null;

  protected readonly displays = computed<IKipDisplayInfo[]>(() => {
    const items = Object.values(this.displaysMap());
    return items
      .filter(display => display.displayId !== this.appID)
      .sort((a, b) => {
        const nameA = (a.displayName ?? '').toLowerCase();
        const nameB = (b.displayName ?? '').toLowerCase();
        if (nameA && nameB) return nameA.localeCompare(nameB);
        if (nameA) return -1;
        if (nameB) return 1;
        return a.displayId.localeCompare(b.displayId);
      });
  });
  protected readonly screens = signal<IKipDisplayScreen>([]);
  protected readonly activeScreenIdx = signal<number | null>(null);


  constructor() {
    this._data.subscribePathTree('self.displays.*')
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(({ path, update }) => {
        this.updateDisplayCatalog(path, update.data.value);
      });

    effect(() => {
      const remoteDisplays = this.displays();
      const selectedId = this.selectedDisplayButtonId();

      if (!remoteDisplays.length) {
        this.displayDashboards(null);
        return;
      }

      if (!selectedId || !remoteDisplays.some(display => display.displayId === selectedId)) {
        this.displayDashboards(remoteDisplays[0].displayId);
      }
    });

    effect(() => {
      this.rebindSelectedDisplaySubscriptions(this.displayId());
    });
  }

  private updateDisplayCatalog(path: string, value: unknown): void {
    const displayId = this.extractDisplayId(path);
    if (!displayId || displayId === this.appID) {
      return;
    }

    const rootPath = `self.displays.${displayId}`;

    this.displaysMap.update(currentMap => {
      const nextMap = { ...currentMap };

      if (path === rootPath && (value === null || typeof value === 'undefined')) {
        delete nextMap[displayId];
        return nextMap;
      }

      const existing = nextMap[displayId] ?? { displayId, displayName: null };
      let displayName = existing.displayName;

      if (path === rootPath && value && typeof value === 'object') {
        const node = value as { displayName?: unknown };
        if (typeof node.displayName === 'string') {
          displayName = node.displayName;
        } else if (node.displayName === null) {
          displayName = null;
        }
      }

      nextMap[displayId] = { displayId, displayName };
      return nextMap;
    });
  }

  private rebindSelectedDisplaySubscriptions(displayId: string | null): void {
    this.selectedDisplaySub?.unsubscribe();
    this.selectedDisplaySub = null;
    this.selectedScreenIndexSub?.unsubscribe();
    this.selectedScreenIndexSub = null;

    if (!displayId) {
      this.screensLoading.set(false);
      this.screens.set([]);
      this.activeScreenIdx.set(null);
      return;
    }

    this.screensLoading.set(true);

    this.selectedDisplaySub = this._data.subscribePath(`self.displays.${displayId}`, 'default')
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(update => {
        this.screensLoading.set(false);

        const node = update.data.value as { screens?: unknown; displayName?: unknown } | null;
        const screenItems = Array.isArray(node?.screens)
          ? node.screens.filter((screen): screen is { id: string; name: string; icon: string } => {
              return !!screen
                && typeof screen === 'object'
                && typeof (screen as { id?: unknown }).id === 'string'
                && typeof (screen as { name?: unknown }).name === 'string'
                && typeof (screen as { icon?: unknown }).icon === 'string';
            })
          : [];

        this.screens.set(screenItems);

        if (node && Object.prototype.hasOwnProperty.call(node, 'displayName')) {
          this.displaysMap.update(currentMap => {
            const existing = currentMap[displayId];
            if (!existing) return currentMap;

            const nextName = typeof node.displayName === 'string'
              ? node.displayName
              : node.displayName === null
                ? null
                : existing.displayName;

            if (nextName === existing.displayName) {
              return currentMap;
            }

            return {
              ...currentMap,
              [displayId]: {
                ...existing,
                displayName: nextName
              }
            };
          });
        }
      });

    this.selectedScreenIndexSub = this._data.subscribePath(`self.displays.${displayId}.screenIndex`, 'default')
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(update => {
        const nextValue = update.data.value;
        this.activeScreenIdx.set(typeof nextValue === 'number' ? nextValue : null);
      });
  }

  private extractDisplayId(path: string): string | null {
    const match = path.match(/^self\.displays\.([^.]+)(?:\.|$)/);
    return match?.[1] ?? null;
  }

  protected displayDashboards(displayId: string | null): void {
    this.displayId.set(displayId);
    this.selectedDisplayButtonId.set(displayId);
  }

  protected setActiveScreen(screenIdx: number): void {
    const previous = this.activeScreenIdx();
    const displayId = this.displayId();
    if (!displayId) {
      return;
    }

    // Optimistic UI update
    this.activeScreenIdx.set(screenIdx);

    const requestId = this._requests.putRequest(
      this.COMMAND_REQUEST_ACTIVE_SCREEN_PATH,
      { displayId, screenIdx },
      this.appID
    );
    if (!requestId) {
      console.error('Failed to set active screen: request was not accepted');
      this.activeScreenIdx.set(previous);
    }
  }
}
