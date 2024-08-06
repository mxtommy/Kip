import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { ActivatedRoute } from '@angular/router';

import { LayoutSplitsService } from '../../services/layout-splits.service';
import { PageLayoutComponent } from '../page-layout/page-layout.component';
import { DashboardService } from '../../services/dashboard.service';

@Component({
    selector: 'page-root',
    templateUrl: './page-root.component.html',
    styleUrls: ['./page-root.component.scss'],
    standalone: true,
    imports: [PageLayoutComponent ]
})
export class PageRootComponent implements OnInit, OnDestroy {
  private dashboardNumber: number;
  private pageNumberSub: Subscription;

  private unlockStatusSub: Subscription;
  protected unlockStatus: boolean;

  protected readonly root = "root";

  constructor(
    protected _dashboard: DashboardService,
    private LayoutSplitsService: LayoutSplitsService,
    private route: ActivatedRoute) { }

  ngOnInit() {

    this.pageNumberSub = this.route.params.subscribe(params => {
      this.dashboardNumber = +params['id'];
      this._dashboard.navigateTo(this.dashboardNumber);
    })

    // get Unlock Status
    this.unlockStatusSub = this.LayoutSplitsService.getEditLayoutObservable().subscribe(unlockStatus => {
      this.unlockStatus = unlockStatus;
    });
  }

  ngOnDestroy() {
    this.unlockStatusSub.unsubscribe();
    this.pageNumberSub.unsubscribe();
  }
}
