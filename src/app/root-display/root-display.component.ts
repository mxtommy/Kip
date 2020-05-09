import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { ActivatedRoute } from '@angular/router';

import { AppSettingsService } from '../app-settings.service';
import { LayoutSplitsService } from '../layout-splits.service';


@Component({
  selector: 'app-root-display',
  templateUrl: './root-display.component.html',
  styleUrls: []
})
export class RootDisplayComponent implements OnInit, OnDestroy {

  rootUUIDSub: Subscription;
  currentRootUUID: string = null;
  pageNumber: number;
  pageNumberSub: Subscription;


  unlockStatusSub: Subscription;
  unlockStatus: boolean;

  constructor(  private AppSettingsService: AppSettingsService,
                private LayoutSplitsService: LayoutSplitsService,
                private route: ActivatedRoute,
                ) { }

  ngOnInit() {

    this.pageNumberSub = this.route.params.subscribe(params => {
      this.pageNumber = +params['id'];
      this.LayoutSplitsService.setActiveRootIndex(this.pageNumber);
    })

    // when root uuid changes, update page.
    this.rootUUIDSub = this.LayoutSplitsService.getActiveRootSub().subscribe(
      uuid => {
        if (uuid === null) {return; }// no root UUID yet...
          this.currentRootUUID = uuid;
        }
    );

    // get Unlock Status
    this.unlockStatusSub = this.AppSettingsService.getUnlockStatusAsO().subscribe(
      unlockStatus => {
        this.unlockStatus = unlockStatus;
      }
    );
  }

  ngOnDestroy() {
    this.rootUUIDSub.unsubscribe();
    this.unlockStatusSub.unsubscribe();
  }
}
