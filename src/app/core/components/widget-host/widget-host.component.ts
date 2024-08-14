import { Component, model, OnDestroy, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { DialogService } from '../../services/dialog.service';
import { IWidgetSvcConfig } from '../../interfaces/widgets-interface';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'widget-host',
  standalone: true,
  imports: [ MatCardModule],
  templateUrl: './widget-host.component.html',
  styleUrl: './widget-host.component.scss'
})
export class WidgetHostComponent implements OnInit, OnDestroy {
  protected config = model.required<IWidgetSvcConfig>();

  constructor(private _dialog: DialogService, private _dashboard: DashboardService) {
  }
  ngOnInit(): void {
  }

  ngOnDestroy(): void {
  }

  openWidgetOptions(e: Event): void {
    if (!this._dashboard.isDashboardStatic()) {
      this._dialog.openWidgetOptions({
        title: 'Widget Options',
        config: this.config(),
        confirmBtnText: 'Save',
        cancelBtnText: 'Cancel'
      }).afterClosed().subscribe(result => {
        if (result) {
          this.config.set(result);
        }
      });
    }
  }
}
