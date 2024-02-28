import { Component, Input } from '@angular/core';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { BaseWidgetComponent } from '../../base-widget/base-widget.component';
import { RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { NgIf } from '@angular/common';

@Component({
    selector: 'app-widget-tutorial',
    templateUrl: './widget-tutorial.component.html',
    standalone: true,
    imports: [NgIf, MatButton, RouterLink]
})
export class WidgetTutorialComponent extends BaseWidgetComponent {
  @Input() unlockStatus: boolean;

  defaultConfig: IWidgetSvcConfig = {};
  constructor() {
    super();
   }

}
