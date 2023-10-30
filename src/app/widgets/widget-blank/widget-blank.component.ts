import { Component, OnInit, OnDestroy} from '@angular/core';
import { BaseWidgetComponent } from '../../base-widget/base-widget.component';

@Component({
  selector: 'app-widget-blank',
  templateUrl: './widget-blank.component.html',
  styleUrls: ['./widget-blank.component.scss']
})
export class WidgetBlankComponent extends BaseWidgetComponent implements OnInit, OnDestroy {

  constructor() {
    super();

    this.defaultConfig = {
      displayName: ''
    };
  }

  ngOnInit() {
  }

  ngOnDestroy(): void {
    this.unsubscribeDataOservable();
  }

}
