import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { RouterModule }   from '@angular/router';
import { NgbModule} from '@ng-bootstrap/ng-bootstrap';
import { FormsModule }   from '@angular/forms';

import { AppComponent } from './app.component';
import { SettingsComponent } from './settings.component';
import { UnitWindowComponent } from './unit-window/unit-window.component';

import { SignalKService } from './signalk.service';
import { TreeManagerService } from './tree-manager.service';
import { WidgetBlankComponent } from './widget-blank/widget-blank.component';
import { WidgetSplitComponent } from './widget-split/widget-split.component';
import { DynamicWidgetDirective } from './dynamic-widget.directive';
import { WidgetUnknownComponent } from './widget-unknown/widget-unknown.component';
import { WidgetListService } from './widget-list.service';

@NgModule({
  declarations: [
    AppComponent,
    SettingsComponent,
    UnitWindowComponent,
    WidgetBlankComponent,
    WidgetSplitComponent,
    DynamicWidgetDirective,
    WidgetUnknownComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    NgbModule.forRoot(),
    RouterModule.forRoot([
      {
        path: 'settings',
        component: SettingsComponent
      },
      {
        path: '',
        component: UnitWindowComponent
      }
    ])
  ],
  entryComponents: [ WidgetUnknownComponent, WidgetBlankComponent, WidgetSplitComponent ],
  providers: [ SignalKService, TreeManagerService, WidgetListService ],
  bootstrap: [AppComponent]
})




export class AppModule { }
