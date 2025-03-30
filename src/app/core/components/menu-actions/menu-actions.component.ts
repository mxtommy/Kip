import { AfterViewInit, Component, inject, input, OnDestroy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { DashboardService } from '../../services/dashboard.service';
import { MatSidenav } from '@angular/material/sidenav';
import { AppService } from '../../services/app-service';
import { LargeIconTile, TileLargeIconComponent } from '../tile-large-icon/tile-large-icon.component';
import { uiEventService } from '../../services/uiEvent.service';

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
  protected readonly menuItems: MenuActionItem[]  = [
    { svgIcon: 'dashboard', iconSize: 48, label: 'Dashboards', action: 'dashboards' },
    { svgIcon: 'troubleshoot', iconSize:  48, label: 'Data Inspector', action: 'datainspector' },
    { svgIcon: 'dataset', iconSize: 48, label: 'Datasets', action: 'datasets' },
    { svgIcon: 'configuration', iconSize:  48, label: 'Configurations', action: 'configurations' },
    { svgIcon: 'settings', iconSize:  48, label: 'Settings', action: 'settings' },
    { svgIcon: 'help-center', iconSize:  48, label: 'Help', action: 'help' }
  ];

  constructor() {
  }

  ngAfterViewInit(): void {
    this.uiEvent.addHotkeyListener(this.handleKeyDown.bind(this));
  }

  ngOnDestroy(): void {
    this.uiEvent.removeHotkeyListener(this.handleKeyDown.bind(this));;
  }

  private handleKeyDown(event: KeyboardEvent): void {
    // Normalize key to lowercase
    const key = event.key.toLowerCase();

    // Check if Ctrl and Shift are pressed
    const isCtrlPressed = event.ctrlKey || event.metaKey; // metaKey for Mac (Cmd)
    const isShiftPressed = event.shiftKey;

    if (isCtrlPressed && isShiftPressed) {
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
  }

  protected onActionItem(action: string): void {
    this.actionsSidenav().close();
    switch (action) {
      case 'help':
      this._router.navigate(['/help']);
        break;
      case 'dashboards':
        this._router.navigate(['/dashboards']);
        break;
      case 'datainspector':
        this._router.navigate(['/data']);
        break;
      case 'datasets':
        this._router.navigate(['/datasets']);
        break;
      case 'configurations':
        this._router.navigate(['/configurations']);
        break;
      case 'toggleFullScreen':
        this.uiEvent.toggleFullScreen();
        break;
      case 'settings':
        this._router.navigate(['/settings']);
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
