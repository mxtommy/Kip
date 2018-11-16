import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs/Subscription';
import { Router, ActivatedRoute } from '@angular/router';
import { SignalKConnectionService } from '../signalk-connection.service';

import { AppSettingsService } from '../app-settings.service';
import { LayoutSplitsService } from '../layout-splits.service';


@Component({
  selector: 'app-root-display',
  templateUrl: './root-display.component.html',
  styleUrls: ['./root-display.component.css']
})
export class RootDisplayComponent implements OnInit, OnDestroy {

  rootUUIDSub: Subscription;
  currentRootUUID: string = null;
  pageNumber: number;
  pageNumberSub: Subscription;


  unlockStatusSub: Subscription;
  unlockStatus: boolean;

  connectionOverlayDisplay = "none";
  connectionStatusSub: Subscription;

  constructor(  private AppSettingsService: AppSettingsService,
                private SignalKConnectionService: SignalKConnectionService,
                private LayoutSplitsService: LayoutSplitsService,
                private route: ActivatedRoute
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
          this.connectionOverlayDisplay = "none";
        } else {
          this.connectionOverlayDisplay = "block";
        }
      }
    );

  }

  ngOnDestroy() {
    this.rootUUIDSub.unsubscribe();
    this.unlockStatusSub.unsubscribe();
  }
}
