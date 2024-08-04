import { Component, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'page-header',
  standalone: true,
  imports: [ MatButtonModule, MatIconModule ],
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss'
})
export class PageHeaderComponent {
  protected readonly pageTitle = input<string>();

  constructor(private dashboards: DashboardService) { }

  protected closePage() {
    this.dashboards.navigateToActive();
  }
}
