import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { SignalKConnectionService } from '../signalk-connection.service';
import { NotificationsService } from '../notifications.service';

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

  connectionStatusSub: Subscription;

  constructor(  private AppSettingsService: AppSettingsService,
                private SignalKConnectionService: SignalKConnectionService,
                private LayoutSplitsService: LayoutSplitsService,
                private route: ActivatedRoute,
                private notificationsService : NotificationsService,
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

    this.connectionStatusSub = this.SignalKConnectionService.getEndpointWSStatus().subscribe(
      status => {
        if (status) {
          //TODO: Issue with the sub being initialized to true and update to true very
          // fast, causing view content changes error. No solution for now
          this.notificationsService.newNotification("Connected to server.", 1000);
        } else {
          this.notificationsService.newNotification("Lost connection to server. Attempting reconnection...", 0);
        }
      }
    );

  }

  ngOnDestroy() {
    this.rootUUIDSub.unsubscribe();
    this.unlockStatusSub.unsubscribe();
  }
}
