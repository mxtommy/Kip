import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { RouterModule }   from '@angular/router';

import { AppComponent } from './app.component';
import { SignalKService } from './signalk.service';
import { SettingsComponent } from './settings.component';

@NgModule({
  declarations: [
    AppComponent,
    SettingsComponent
  ],
  imports: [
    BrowserModule,
    RouterModule.forRoot([
      {
        path: 'settings',
        component: SettingsComponent
      }
    ])
  ],
  providers: [ SignalKService ],
  bootstrap: [AppComponent]
})




export class AppModule { }
