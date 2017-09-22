import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { RouterModule, Routes }   from '@angular/router';
import { NgbModule} from '@ng-bootstrap/ng-bootstrap';
import { FormsModule }   from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import {
  MdMenuModule,
  MdIconModule
} from '@angular/material';


import { AngularSplitModule } from 'angular-split';

import { AppComponent } from './app.component';

import { FitTextDirective } from './fit-text.directive';
import { DynamicWidgetDirective } from './dynamic-widget.directive';

import { SignalKService } from './signalk.service';
import { SignalKConnectionService } from './signalk-connection.service';
import { SignalKDeltaService } from './signalk-delta.service';
import { SignalKFullService } from './signalk-full.service';
import { DataSetService } from './data-set.service';
import { TreeManagerService } from './tree-manager.service';
import { LayoutSplitsService } from './layout-splits.service';
import { AppSettingsService } from './app-settings.service';
import { WidgetListService } from './widget-list.service';
import { UnitConvertService } from './unit-convert.service';

import { WidgetBlankComponent } from './widget-blank/widget-blank.component';
import { WidgetSplitComponent } from './widget-split/widget-split.component';
import { WidgetUnknownComponent } from './widget-unknown/widget-unknown.component';
import { WidgetTextGenericComponent } from './widget-text-generic/widget-text-generic.component';
import { UnitWindowComponent } from './unit-window/unit-window.component';
import { SettingsComponent } from './settings/settings.component';
import { RootDisplayComponent } from './root-display/root-display.component';
import { FilterSelfPipe } from './filter-self.pipe';
import { WidgetNumericComponent } from './widget-numeric/widget-numeric.component';
import { SettingsDatasetsComponent } from './settings-datasets/settings-datasets.component';
import { SettingsSignalkComponent } from './settings-signalk/settings-signalk.component';
import { WidgetHistoricalComponent } from './widget-historical/widget-historical.component';
import { LayoutSplitComponent } from './layout-split/layout-split.component';

const appRoutes: Routes = [
  { path: '', redirectTo: '/page/0', pathMatch: 'full' },
  { path: 'page/:id', component: RootDisplayComponent },
  { path: 'settings',  component: SettingsComponent}
];

@NgModule({
  declarations: [
    AppComponent,
    SettingsComponent,
    UnitWindowComponent,
    WidgetBlankComponent,
    WidgetSplitComponent,
    DynamicWidgetDirective,
    WidgetUnknownComponent,
    WidgetTextGenericComponent,
    FitTextDirective,
    RootDisplayComponent,
    FilterSelfPipe,
    WidgetNumericComponent,
    SettingsDatasetsComponent,
    SettingsSignalkComponent,
    WidgetHistoricalComponent,
    LayoutSplitComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    NgbModule.forRoot(),
    HttpClientModule,
    RouterModule.forRoot(appRoutes, { /*enableTracing: true */ } ),
    AngularSplitModule,
    BrowserAnimationsModule,
    MdMenuModule,
    MdIconModule
  ],
  entryComponents: [ 
    WidgetUnknownComponent, 
    WidgetBlankComponent, 
    WidgetSplitComponent, 
    WidgetNumericComponent,
    WidgetTextGenericComponent,
    WidgetHistoricalComponent
  ],
  providers: [ 
    SignalKService,
    SignalKConnectionService,
    SignalKDeltaService,
    SignalKFullService,
    DataSetService,
    TreeManagerService,
    LayoutSplitsService,
    WidgetListService,
    UnitConvertService,
    AppSettingsService 
  ],
  bootstrap: [AppComponent]
})




export class AppModule { }
