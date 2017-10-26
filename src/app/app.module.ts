import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { RouterModule, Routes }   from '@angular/router';
import { NgbModule} from '@ng-bootstrap/ng-bootstrap';
import { FormsModule }   from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import {
  MdMenuModule,
  MdButtonModule,
  MdDialogModule,
  MdSelectModule,
  MdInputModule,
  MdToolbarModule,
  MdCheckboxModule,
  MdRadioModule,
  MdTabsModule,
  MdStepperModule
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
import { LayoutSplitsService } from './layout-splits.service';
import { AppSettingsService } from './app-settings.service';
import { WidgetManagerService } from './widget-manager.service';
import { WidgetListService } from './widget-list.service';
import { UnitConvertService } from './unit-convert.service';
import { DerivedService } from './derived.service';

import { WidgetBlankComponent } from './widget-blank/widget-blank.component';
import { WidgetUnknownComponent } from './widget-unknown/widget-unknown.component';
import { WidgetTextGenericComponent, WidgetTextGenericModalComponent } from './widget-text-generic/widget-text-generic.component';
import { UnitWindowComponent, UnitWindowModalComponent } from './unit-window/unit-window.component';
import { SettingsComponent } from './settings/settings.component';
import { RootDisplayComponent } from './root-display/root-display.component';
import { FilterSelfPipe } from './filter-self.pipe';
import { WidgetNumericComponent, WidgetNumericModalComponent } from './widget-numeric/widget-numeric.component';
import { SettingsDatasetsComponent, SettingsDatasetsModalComponent } from './settings-datasets/settings-datasets.component';
import { SettingsSignalkComponent } from './settings-signalk/settings-signalk.component';
import { WidgetHistoricalComponent, WidgetHistoricalModalComponent } from './widget-historical/widget-historical.component';
import { LayoutSplitComponent } from './layout-split/layout-split.component';
import { WidgetWindComponent, WidgetWindModalComponent } from './widget-wind/widget-wind.component';
import { SvgWindComponent } from './svg-wind/svg-wind.component';
import { WidgetGaugeComponent, WidgetGaugeModalComponent } from './widget-gauge/widget-gauge.component';
import { GaugeSteelComponent } from './gauge-steel/gauge-steel.component';
import { SettingsConfigComponent } from './settings-config/settings-config.component';
import { SettingsDerivedComponent, SettingsDerivedModalComponent } from './settings-derived/settings-derived.component';
import { WidgetTutorialComponent } from './widget-tutorial/widget-tutorial.component';
import { ResetConfigComponent } from './reset-config/reset-config.component'


const appRoutes: Routes = [
  { path: '', redirectTo: '/page/0', pathMatch: 'full' },
  { path: 'page/:id', component: RootDisplayComponent },
  { path: 'settings',  component: SettingsComponent },
  { path: 'reset', component: ResetConfigComponent },
  { path: 'demo', component: ResetConfigComponent }
];

@NgModule({
  declarations: [
    AppComponent,
    SettingsComponent,
    UnitWindowComponent,
    UnitWindowModalComponent,
    WidgetBlankComponent,
    DynamicWidgetDirective,
    WidgetUnknownComponent,
    WidgetTextGenericComponent,
    WidgetTextGenericModalComponent,
    FitTextDirective,
    RootDisplayComponent,
    FilterSelfPipe,
    WidgetNumericComponent,
    WidgetNumericModalComponent,
    SettingsDatasetsComponent,
    SettingsDatasetsModalComponent,
    SettingsSignalkComponent,
    WidgetHistoricalComponent,
    WidgetHistoricalModalComponent,
    LayoutSplitComponent,
    WidgetWindComponent,
    WidgetWindModalComponent,
    SvgWindComponent,
    WidgetGaugeComponent,
    WidgetGaugeModalComponent,
    GaugeSteelComponent,
    SettingsConfigComponent,
    SettingsDerivedComponent,
    SettingsDerivedModalComponent,
    WidgetTutorialComponent,
    ResetConfigComponent
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
    MdButtonModule,
    MdDialogModule,
    MdSelectModule,
    MdToolbarModule,
    MdCheckboxModule,
    MdRadioModule,
    MdTabsModule,
    MdStepperModule,
    MdInputModule
  ],
  entryComponents: [ 
    WidgetUnknownComponent, 
    WidgetBlankComponent, 
    WidgetNumericComponent,
    WidgetTextGenericComponent,
    WidgetTextGenericModalComponent,
    WidgetHistoricalComponent,
    WidgetWindComponent,
    WidgetGaugeComponent,
    WidgetTutorialComponent,
    
    //dialogs
    UnitWindowModalComponent,
    WidgetNumericModalComponent,
    WidgetHistoricalModalComponent,
    WidgetWindModalComponent,
    WidgetGaugeModalComponent,
    SettingsDerivedModalComponent,
    SettingsDatasetsModalComponent
  ],
  providers: [ 
    SignalKService,
    SignalKConnectionService,
    SignalKDeltaService,
    SignalKFullService,
    DataSetService,
    LayoutSplitsService,
    WidgetListService,
    WidgetManagerService,
    UnitConvertService,
    DerivedService,
    AppSettingsService 
  ],
  bootstrap: [AppComponent]
})




export class AppModule { }
