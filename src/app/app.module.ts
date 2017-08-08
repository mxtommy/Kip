import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { RouterModule }   from '@angular/router';
import {NgbModule} from '@ng-bootstrap/ng-bootstrap';

import { AppComponent } from './app.component';
import { SettingsComponent } from './settings.component';
import { UnitWindowComponent } from './unit-window/unit-window.component';

import { SignalKService } from './signalk.service';
import { TreeManagerService } from './tree-manager.service';

@NgModule({
  declarations: [
    AppComponent,
    SettingsComponent,
    UnitWindowComponent
  ],
  imports: [
    BrowserModule,
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
  providers: [ SignalKService, TreeManagerService ],
  bootstrap: [AppComponent]
})




export class AppModule { }
