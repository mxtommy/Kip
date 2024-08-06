import { Component, OnDestroy, OnInit } from '@angular/core';
import { BaseWidget } from 'gridstack/dist/angular';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'dashboard-widget-container',
  standalone: true,
  imports: [ MatCardModule],
  templateUrl: './dashboard-widget-container.component.html',
  styleUrl: './dashboard-widget-container.component.scss'
})
export class DashboardWidgetContainerComponent extends BaseWidget implements OnInit, OnDestroy {
  ngOnInit(): void {
    console.warn('INIT DashboardWidgetContainerComponent');
  }

  ngOnDestroy(): void {
    console.warn('DESTROY DashboardWidgetContainerComponent');
  }
}
