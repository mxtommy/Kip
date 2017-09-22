import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs/Subscription';

import { AppSettingsService } from '../app-settings.service';
import { LayoutSplitsService } from '../layout-splits.service';


@Component({
  selector: 'app-root-display',
  templateUrl: './root-display.component.html',
  styleUrls: ['./root-display.component.css']
})
export class RootDisplayComponent implements OnInit, OnDestroy {

  rootUUIDSub: Subscription;
  currentRootUUID: string;

  unlockStatusSub: Subscription;
  unlockStatus: boolean;

  constructor(  private AppSettingsService: AppSettingsService,
                private LayoutSplitsService: LayoutSplitsService,
                ) { }

  ngOnInit() {
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
