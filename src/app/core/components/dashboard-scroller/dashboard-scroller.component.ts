import { Component, effect, input, signal } from '@angular/core';
import { Dashboard } from './../../services/dashboard.service';


@Component({
  selector: 'dashboard-scroller',
  standalone: true,
  imports: [],
  templateUrl: './dashboard-scroller.component.html',
  styleUrl: './dashboard-scroller.component.scss',
})
export class DashboardScrollerComponent {
  protected activePage = input<number>();
  protected dashboards = input<Dashboard[]>();
  protected visible = signal(false);

  constructor() {
    effect(() => {
      const page = this.activePage();

      if (page === undefined || page === null) {
        this.visible.set(false);
        return;
      }

      // Restart the CSS animation by removing + re-adding the DOM.
      this.visible.set(false);
      queueMicrotask(() => this.visible.set(true));
    });
  }
}
