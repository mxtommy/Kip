import { Component, OnInit, OnDestroy } from '@angular/core';

import { Subscription } from 'rxjs';
import { ActivatedRoute } from '@angular/router';

import { LayoutSplitsService } from '../../services/layout-splits.service';
import { PageLayoutComponent } from '../page-layout/page-layout.component';



@Component({
    selector: 'page-root',
    templateUrl: './page-root.component.html',
    styleUrls: ['./page-root.component.scss'],
    standalone: true,
    imports: [PageLayoutComponent]
})
export class PageRootComponent implements OnInit, OnDestroy {

  rootUUIDSub: Subscription;
  currentRootUUID: string = null;
  pageNumber: number;
  pageNumberSub: Subscription;


  unlockStatusSub: Subscription;
  unlockStatus: boolean;

  constructor(
    private LayoutSplitsService: LayoutSplitsService,
    private route: ActivatedRoute) { }

  ngOnInit() {

    this.pageNumberSub = this.route.params.subscribe(params => {
      this.pageNumber = +params['id'];
      this.LayoutSplitsService.setActiveRootIndex(this.pageNumber);
    })

    // when root uuid changes, update page.
    this.rootUUIDSub = this.LayoutSplitsService.getActiveRootSub().subscribe(uuid => {
      if (uuid === null) {return; }// no root UUID yet...
      this.currentRootUUID = uuid;
    });

    // get Unlock Status
    this.unlockStatusSub = this.LayoutSplitsService.getEditLayoutObservable().subscribe(unlockStatus => {
      this.unlockStatus = unlockStatus;
    });
  }

  ngOnDestroy() {
    this.rootUUIDSub.unsubscribe();
    this.unlockStatusSub.unsubscribe();
    this.pageNumberSub.unsubscribe();
  }
}
