import { Component, input } from '@angular/core';
import { Dashboard } from './../../services/dashboard.service';
import { trigger, style, animate, transition } from '@angular/animations';


@Component({
  selector: 'dashboard-scroller',
  standalone: true,
  imports: [],
  templateUrl: './dashboard-scroller.component.html',
  styleUrl: './dashboard-scroller.component.scss',
  animations: [
    trigger('fadeInOut', [
      transition(':increment, :decrement', [
        style({ opacity: 0 }),
        animate(100, style({ opacity: 1 })),
        style({ opacity: 1 }),
        animate('250ms 1000ms', style({ opacity: 0 })),
      ])
    ])
  ]
})
export class DashboardScrollerComponent {
  protected activePage = input<number>();
  protected dashboards = input<Dashboard[]>();
}
