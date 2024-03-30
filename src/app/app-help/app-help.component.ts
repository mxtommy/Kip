import { Component, OnInit, ViewEncapsulation, Inject, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

import { AppSettingsService } from '../core/services/app-settings.service';
import { MatAccordion, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, MatExpansionPanelDescription } from '@angular/material/expansion';
import { NgIf } from '@angular/common';
import { MatTabGroup, MatTab, MatTabContent } from '@angular/material/tabs';

@Component({
    selector: 'app-help',
    templateUrl: './app-help.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [
        MatTabGroup,
        MatTab,
        NgIf,
        MatTabContent,
        MatAccordion,
        MatExpansionPanel,
        MatExpansionPanelHeader,
        MatExpansionPanelTitle,
        MatExpansionPanelDescription,
    ],
})
export class AppHelpComponent implements OnInit, OnDestroy {

  unlockStatusSub: Subscription;
  unlockStatus: boolean;

  step: number = -1;

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

  setStep(index: number) {
    this.step = index;
  }

  ngOnDestroy() {
    this.unlockStatusSub?.unsubscribe();
  }
}

