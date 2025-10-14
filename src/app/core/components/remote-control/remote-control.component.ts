import { Component, inject, OnInit, signal } from '@angular/core';
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
export class RemoteControlComponent implements OnInit {
  protected readonly http = inject(HttpClient);
  private readonly _settings = inject(AppSettingsService);
  private readonly HOST_URL = this._settings.signalkUrl.url;
  protected pageTitle = 'Remote Control';
  private displayId = signal<string | null>(null);
  protected displays = signal<IKipDisplayList | null>(null);
  protected readonly screens = httpResource<IKipDisplayScreen>(() => {
    if (!this.displayId()) return undefined;
    return `${this.HOST_URL}/plugins/kip/displays/${this.displayId()}`;
  });
  protected readonly activeScreen = httpResource<IKipActiveScreen>(() =>  {
    if (!this.displayId()) return undefined;
    return `${this.HOST_URL}/plugins/kip/displays/${this.displayId()}/activeScreen`;
  });
  protected selectedDisplayButtonId = signal<string | null>(null);
  private appID = "";

  ngOnInit(): void {
    this.appID = this._settings.KipUUID;
    lastValueFrom(this.http.get<IKipDisplayList>(`${this.HOST_URL}/plugins/kip/displays`))
      .then(instances => {
        this.displays.set(instances.filter(d => d.displayId !== this.appID));
      });
  }

  protected displayDashboards(displayId: string | null): void {
    this.displayId.set(displayId);
    this.selectedDisplayButtonId.set(displayId);
  }

  protected setActiveScreen(screenIdx: number): void {
    lastValueFrom(
        this.http.put<IKipResponse>(`${this.HOST_URL}/plugins/kip/displays/${this.displayId()}/activeScreen`, { screenIdx })
      ).then(response => {
        if (response.statusCode !== 200) {
          console.error(`Failed to set active screen: ${response.message}`);
        }
      });
    this.activeScreen.set(screenIdx);
  }
}
