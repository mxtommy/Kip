import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { PageHeaderComponent } from '../page-header/page-header.component';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import { HttpClient, httpResource } from '@angular/common/http';
import { IKipActiveScreen, IKipDisplayList, IKipDisplayScreen, IKipResponse } from '../../interfaces/app-interfaces';
import { lastValueFrom } from 'rxjs';
import { AppSettingsService } from '../../services/app-settings.service';
import { TileLargeIconComponent } from '../tile-large-icon/tile-large-icon.component';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'remote-control',
  imports: [ PageHeaderComponent, MatSidenavModule, MatListModule, MatButtonModule, MatProgressSpinnerModule, TileLargeIconComponent, MatIconModule ],
  templateUrl: './remote-control.component.html',
  styleUrl: './remote-control.component.scss'
})
export class RemoteControlComponent {
  protected readonly http = inject(HttpClient);
  private readonly _settings = inject(AppSettingsService);
  private readonly HOST_URL = this._settings.signalkUrl.url;

  protected readonly pageTitle = 'Remote Control';
  private readonly appID = this._settings.KipUUID;
  private displayId = signal<string | null>(null);
  protected selectedDisplayButtonId = signal<string | null>(null);

  private readonly displaysResource = httpResource<IKipDisplayList>(() => {
    return `${this.HOST_URL}/plugins/kip/displays`;
  });
  protected readonly displays = computed<IKipDisplayList | null>(() => {
    const instances = this.displaysResource.value();
    if (!instances) return null;
    return instances.filter(d => d.displayId !== this.appID);
  });
  protected readonly screens = httpResource<IKipDisplayScreen>(() => {
    if (!this.displayId()) return undefined;
    return `${this.HOST_URL}/plugins/kip/displays/${this.displayId()}`;
  });
  protected readonly activeScreenIdx = signal<number | null>(null);
  protected readonly activeScreen = httpResource<IKipActiveScreen>(() =>  {
    if (!this.displayId()) return undefined;
    const url = `${this.HOST_URL}/plugins/kip/displays/${this.displayId()}/screenIndex`;
    return url;
  });


  constructor() {
    this.displaysResource.value();
    effect(() => {
      const remoteDisplays = this.displays();

      untracked(() => {
        if (!remoteDisplays) return;
        this.displayDashboards(remoteDisplays[0]?.displayId ?? null);
      });
    });

    // Mirror resource -> signal when the HTTP value arrives/changes
    effect(() => {
      const v = this.activeScreen.value();

      untracked(() => {
      // Adjust this mapping to match your real IKipActiveScreen shape
      this.activeScreenIdx.set(v  ?? null);
      });
    });
  }

  protected displayDashboards(displayId: string | null): void {
    this.displayId.set(displayId);
    this.selectedDisplayButtonId.set(displayId);
  }

  protected setActiveScreen(screenIdx: number): void {
    // Optimistic UI update
    this.activeScreenIdx.set(screenIdx);

    lastValueFrom(
      this.http.put<IKipResponse>(
        `${this.HOST_URL}/plugins/kip/displays/${this.displayId()}/activeScreen`,
        { screenIdx }
      )
    ).then(response => {
      if (response.statusCode !== 200) {
        console.error(`Failed to set active screen: ${response.message}`);
        // Optionally: revert by reloading the resource
        this.activeScreen.reload();
      } else {
        // Ensure we sync with server truth
        this.activeScreen.reload();
      }
    });
  }
}
