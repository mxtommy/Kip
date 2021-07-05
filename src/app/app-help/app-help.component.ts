import { Component, Input, OnInit, ViewEncapsulation, Inject } from '@angular/core';
import { Subscription } from 'rxjs';

import { AppSettingsService } from '../app-settings.service';



@Component({
  selector: 'app-help',
  templateUrl: './app-help.component.html',
  styleUrls: ['./app-help.component.css'],
  encapsulation: ViewEncapsulation.None,
})
export class AppHelpComponent implements OnInit {

  unlockStatusSub: Subscription;
  unlockStatus: boolean;

  step = -1;


  constructor(  private AppSettingsService: AppSettingsService,) {

  }

  ngOnInit() {
    // get Unlock Status
    this.unlockStatusSub = this.AppSettingsService.getUnlockStatusAsO().subscribe(
      unlockStatus => {
        this.unlockStatus = unlockStatus;
      }
    );
  }

  ngOnDestroy() {
    this.unlockStatusSub.unsubscribe();
  }

  setStep(index: number) {
    this.step = index;
  }


}

