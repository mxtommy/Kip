import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { TileLargeIconComponent } from '../tile-large-icon/tile-large-icon.component';
import { MatDividerModule } from "@angular/material/divider";
import { AppService } from '../../services/app-service';
import { DashboardsEditorComponent } from "../dashboards-editor/dashboards-editor.component";
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'settings',
  imports: [MatIconModule, MatButtonModule, TileLargeIconComponent, MatDividerModule, DashboardsEditorComponent, DashboardsEditorComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
  private readonly _router = inject(Router);
  protected readonly app = inject(AppService);
  private readonly _responsive = inject(BreakpointObserver);
  private readonly _isPhonePortrait = toSignal(this._responsive.observe(Breakpoints.HandsetPortrait));
  private readonly _isPhoneLandscape = toSignal(this._responsive.observe(Breakpoints.HandsetLandscape));
  protected isPhonePortrait = computed(() => this._isPhonePortrait().matches);
  protected isPhoneLandscape = computed(() => this._isPhoneLandscape().matches);

  protected closePage() {
    this._router.navigate(['/dashboard']);
  }

  protected onActionItem(action: string): void {
    switch (action) {
      case 'help':
      this._router.navigate(['/help']);
        break;
      case 'datainspector':
        this._router.navigate(['/data']);
        break;
      case 'options':
        this._router.navigate(['/options']);
        break;
      default:
        break;
    }
  }
}
