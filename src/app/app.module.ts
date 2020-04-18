import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { RouterModule, Routes }   from '@angular/router';
import { FormsModule }   from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import {
  MatMenuModule,
  MatButtonModule,
  MatDialogModule,
  MatSelectModule,
  MatInputModule,
  MatToolbarModule,
  MatCheckboxModule,
  MatRadioModule,
  MatTabsModule,
  MatStepperModule,
  MatCardModule,
  MatExpansionModule,
  MatSnackBarModule,
} from '@angular/material';


import {MatTooltipModule} from '@angular/material/tooltip';

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
import { UnitsService } from './units.service';
import { NotificationsService } from './notifications.service';
import { WidgetBlankComponent } from './widget-blank/widget-blank.component';
import { WidgetUnknownComponent } from './widget-unknown/widget-unknown.component';
import { WidgetTextGenericComponent } from './widget-text-generic/widget-text-generic.component';
import { UnitWindowComponent, UnitWindowModalComponent } from './unit-window/unit-window.component';
import { SettingsComponent } from './settings/settings.component';
import { RootDisplayComponent } from './root-display/root-display.component';
import { FilterSelfPipe } from './filter-self.pipe';
import { SafePipe } from './safe.pipe';
import { WidgetNumericComponent } from './widget-numeric/widget-numeric.component';
import { SettingsDatasetsComponent, SettingsDatasetsModalComponent } from './settings-datasets/settings-datasets.component';
import { SettingsSignalkComponent } from './settings-signalk/settings-signalk.component';
import { WidgetHistoricalComponent } from './widget-historical/widget-historical.component';
import { LayoutSplitComponent } from './layout-split/layout-split.component';
import { WidgetWindComponent, } from './widget-wind/widget-wind.component';
import { SvgWindComponent } from './svg-wind/svg-wind.component';
import { WidgetGaugeComponent } from './widget-gauge/widget-gauge.component';
import { GaugeSteelComponent } from './gauge-steel/gauge-steel.component';
import { WidgetTutorialComponent } from './widget-tutorial/widget-tutorial.component';
import { ResetConfigComponent } from './reset-config/reset-config.component';
import { WidgetStateComponent } from './widget-state/widget-state.component';
import { ModalWidgetComponent } from './modal-widget/modal-widget.component';
import { WidgetSwitchComponent } from './widget-switch/widget-switch.component'
import { ModalPathSelectorComponent } from './modal-path-selector/modal-path-selector.component';
import { ModalUnitSelectorComponent } from './modal-unit-selector/modal-unit-selector.component';
import { ObjectKeysPipe } from './object-keys.pipe';
import { SettingsUnitsComponent } from './settings-units/settings-units.component';
import { WidgetIframeComponent } from './widget-iframe/widget-iframe.component';
import { SettingsConfigComponent } from './settings-config/settings-config.component';

import { GaugesModule } from 'ng-canvas-gauges';
import { WidgetGaugeNgLinearComponent } from './widget-gauge-ng-linear/widget-gauge-ng-linear.component';
import { WidgetGaugeNgRadialComponent } from './widget-gauge-ng-radial/widget-gauge-ng-radial.component';

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
    FitTextDirective,
    RootDisplayComponent,
    FilterSelfPipe,
    SafePipe,
    WidgetNumericComponent,
    SettingsDatasetsComponent,
    SettingsDatasetsModalComponent,
    SettingsSignalkComponent,
    WidgetHistoricalComponent,
    LayoutSplitComponent,
    WidgetWindComponent,
    SvgWindComponent,
    WidgetGaugeComponent,
    GaugeSteelComponent,
    WidgetGaugeNgLinearComponent,
    WidgetGaugeNgRadialComponent,
    SettingsConfigComponent,
    WidgetTutorialComponent,
    ResetConfigComponent,
    WidgetStateComponent,
    ModalWidgetComponent,
    WidgetSwitchComponent,
    ModalPathSelectorComponent,
    ModalUnitSelectorComponent,
    ObjectKeysPipe,
    SettingsUnitsComponent,
    WidgetIframeComponent,
  ],
  imports: [
    BrowserModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    RouterModule.forRoot(appRoutes, { useHash: true /* , enableTracing: true */ } ),
    AngularSplitModule,
    BrowserAnimationsModule,

    MatMenuModule,
    MatButtonModule,
    MatTooltipModule,
    MatDialogModule,
    MatSelectModule,
    MatToolbarModule,
    MatCheckboxModule,
    MatRadioModule,
    MatTabsModule,
    MatCardModule,
    MatSnackBarModule,
    MatStepperModule,
    MatInputModule,
    MatExpansionModule,
    GaugesModule,
  ],
  entryComponents: [
    WidgetUnknownComponent,
    WidgetBlankComponent,
    WidgetNumericComponent,
    WidgetTextGenericComponent,
    WidgetHistoricalComponent,
    WidgetWindComponent,
    WidgetGaugeComponent,
    WidgetGaugeNgLinearComponent,
    WidgetGaugeNgRadialComponent,
    WidgetStateComponent,
    WidgetSwitchComponent,
    WidgetIframeComponent,
    WidgetTutorialComponent,

    //dialogs
    ModalWidgetComponent,
    UnitWindowModalComponent,
    SettingsDatasetsModalComponent,
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
    UnitsService,
    AppSettingsService,
    NotificationsService
  ],
  bootstrap: [AppComponent]
})




export class AppModule { }
