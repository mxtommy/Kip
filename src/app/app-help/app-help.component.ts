import { Component, OnInit, ViewEncapsulation, Inject, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

import { LayoutSplitsService } from './../core/services/layout-splits.service';
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

  constructor(  private splits: LayoutSplitsService,) {

  }

  ngOnInit() {
    // get Unlock Status
    this.unlockStatusSub = this.splits.getEditLayoutObservable().subscribe(
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

