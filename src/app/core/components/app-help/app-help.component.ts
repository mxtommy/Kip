import { Component, ViewEncapsulation, effect, inject } from '@angular/core';
import { MatAccordion, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, MatExpansionPanelDescription } from '@angular/material/expansion';
import { NgIf } from '@angular/common';
import { MatTabGroup, MatTab, MatTabContent } from '@angular/material/tabs';
import { DashboardService } from '../../services/dashboard.service';
import { PageHeaderComponent } from '../page-header/page-header.component';

@Component({
    selector: 'help',
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
        PageHeaderComponent
    ],
})
export class AppHelpComponent {
  private _dashboard = inject(DashboardService);
  protected readonly pageTitle = 'Help';
  protected unlockStatus: boolean;

  step: number = -1;

  constructor() {
    effect(() => {
      this.unlockStatus = !this._dashboard.isDashboardStatic();
    });
  }

  setStep(index: number) {
    this.step = index;
  }
}

