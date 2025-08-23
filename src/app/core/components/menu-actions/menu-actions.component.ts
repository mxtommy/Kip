import { AfterViewInit, Component, inject, input, OnDestroy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { DashboardService } from '../../services/dashboard.service';
import { MatSidenav } from '@angular/material/sidenav';
import { AppService } from '../../services/app-service';
import { LargeIconTile, TileLargeIconComponent } from '../tile-large-icon/tile-large-icon.component';
import { uiEventService } from '../../services/uiEvent.service';
import { AppSettingsService } from '../../services/app-settings.service';
import { toSignal } from '@angular/core/rxjs-interop';

interface MenuActionItem extends LargeIconTile {
  action: string;
}

@Component({
  selector: 'menu-actions',
  standalone: true,
  imports: [ MatIconModule, MatButtonModule, TileLargeIconComponent ],
  templateUrl: './menu-actions.component.html',
  styleUrl: './menu-actions.component.scss'
})

export class MenuActionsComponent implements AfterViewInit, OnDestroy {
  protected actionsSidenav = input.required<MatSidenav>();
  private _router = inject(Router);
  protected uiEvent = inject(uiEventService);
  private dashboard = inject(DashboardService);
  protected app = inject(AppService);
  private _settings = inject(AppSettingsService);
  protected isAutoNightMode = toSignal(this._settings.getAutoNightModeAsO(), {requireSync: true});
  protected readonly menuItems: MenuActionItem[]  = [
    { svgIcon: 'dashboard', iconSize: 60, label: 'Refrigeration', action: 'home' },
    { svgIcon: 'dataset', iconSize: 60, label: 'Datasets', action: 'datasets' },
    { svgIcon: 'dashboard', iconSize: 60, label: 'Home', action: 'home' },
    { svgIcon: 'dataset', iconSize: 60, label: 'Motoring', action: 'datasets' },
    { svgIcon: 'dashboard', iconSize: 60, label: 'Electrical', action: 'home' },
    { svgIcon: 'dataset', iconSize: 60, label: 'Weather Forecast', action: 'datasets' },
    { svgIcon: 'dashboard', iconSize: 60, label: 'United-States-of-America', action: 'home' },
    { svgIcon: 'dataset', iconSize: 60, label: 'Datasets', action: 'datasets' },
    { svgIcon: 'dashboard', iconSize: 60, label: 'Home', action: 'home' },
    { svgIcon: 'dataset', iconSize: 60, label: 'Datasets', action: 'datasets' },
    { svgIcon: 'dashboard', iconSize: 60, label: 'Home', action: 'home' },
    { svgIcon: 'dataset', iconSize: 60, label: 'Datasets', action: 'datasets' },
    { svgIcon: 'dashboard', iconSize: 60, label: 'Home', action: 'home' },
    { svgIcon: 'dataset', iconSize: 60, label: 'Datasets', action: 'datasets' },
  ];

  constructor() {
  }

  ngAfterViewInit(): void {
    this.uiEvent.addHotkeyListener(
      (key, event) => this.handleKeyDown(key, event),
      { ctrlKey: true, shiftKey: true, keys: ['e', 'f', 'n'] } // Filter for specific keys and modifiers
    );
  }

  ngOnDestroy(): void {
    this.uiEvent.removeHotkeyListener(this.handleKeyDown.bind(this));;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private handleKeyDown(key: string, event: KeyboardEvent): void {
    switch (key) {
      case 'e':
        this.onActionItem('layout');
        break;
      case 'f':
        this.onActionItem('toggleFullScreen');
        break;
      case 'n':
        this.onActionItem('nightMode');
        break;
      default:
        break;
    }
  }

  protected onActionItem(action: string): void {
    this.actionsSidenav().close();
    switch (action) {
      case 'home':
        this._router.navigate(['/home']);
        break;
      case 'datasets':
        this._router.navigate(['/datasets']);
        break;
      case 'toggleFullScreen':
        this.uiEvent.toggleFullScreen();
        break;
      case 'layout':
        this.dashboard.toggleStaticDashboard();
        break;
      case 'nightMode':
        this.app.isNightMode.set(!this.app.isNightMode());
        this.app.toggleDayNightMode();
        break;
      default:
        break;
    }
  }
}
