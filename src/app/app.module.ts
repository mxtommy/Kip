// Modules
// Angular
import { BrowserModule, HammerModule, HammerGestureConfig, HAMMER_GESTURE_CONFIG } from '@angular/platform-browser';
import { NgModule, APP_INITIALIZER, Injectable } from '@angular/core';
import { RouterModule, Routes }   from '@angular/router';
import { FormsModule }   from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
// Angular Material components
import {MAT_FORM_FIELD_DEFAULT_OPTIONS} from '@angular/material/form-field';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DEFAULT_OPTIONS, MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatListModule } from '@angular/material/list';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';

import { GaugesModule } from './gauges-module/gauges.module';
import { AngularSplitModule } from 'angular-split';
import { AngularResizeEventModule } from 'angular-resize-event';
import { NgChartsModule } from 'ng2-charts';
// Modules Pipes & Directives
import { FilterSelfPipe } from './core/pipes/filter-self.pipe';
import { ObjectKeysPipe } from './core/pipes/object-keys.pipe';
import { SafePipe } from './core/pipes/safe.pipe';
import { FitTextDirective } from './core/directives/fit-text.directive';
import { DynamicWidgetDirective } from './core/directives/dynamic-widget.directive';
// Services
import { SignalKService } from './core/services/signalk.service';
import { SignalKConnectionService } from './core/services/signalk-connection.service';
import { SignalKDeltaService } from './core/services/signalk-delta.service';
import { DataSetService } from './core/services/data-set.service';
import { LayoutSplitsService } from './core/services/layout-splits.service';
import { AppSettingsService } from './core/services/app-settings.service';
import { WidgetManagerService } from './core/services/widget-manager.service';
import { WidgetListService } from './core/services/widget-list.service';
import { UnitsService } from './core/services/units.service';
import { NotificationsService } from './core/services/notifications.service';
import { TimersService } from './core/services/timers.service';
import { StorageService } from './core/services/storage.service';
import { AppNetworkInitService } from "./core/services/app-initNetwork.service";
import { AuthenticationService } from "./core/services/authentication.service";
import { AuthenticationInterceptor } from "./core/interceptors/authentication-interceptor";
//Components
import { AppComponent } from './app.component';
import { AppHelpComponent } from './app-help/app-help.component';
import { WidgetBlankComponent } from './widgets/widget-blank/widget-blank.component';
import { WidgetUnknownComponent } from './widgets/widget-unknown/widget-unknown.component';
import { WidgetTextGenericComponent } from './widgets/widget-text-generic/widget-text-generic.component';
import { WidgetDateGenericComponent } from './widgets/widget-date-generic/widget-date-generic.component';
import { DynamicWidgetContainerComponent, DynamicWidgetContainerModalComponent } from './dynamic-widget-container/dynamic-widget-container.component';
import { SettingsTabsComponent } from './settings/tabs/tabs.component';
import { RootDisplayComponent } from './root-display/root-display.component';
import { WidgetNumericComponent } from './widgets/widget-numeric/widget-numeric.component';
import { SettingsDatasetsComponent, SettingsDatasetsModalComponent } from './settings/datasets/datasets.component';
import { SettingsSignalkComponent } from './settings/signalk/signalk.component';
import { WidgetHistoricalComponent } from './widgets/widget-historical/widget-historical.component';
import { LayoutSplitComponent } from './layout-split/layout-split.component';
import { WidgetWindComponent, } from './widgets/widget-wind/widget-wind.component';
import { SvgWindComponent } from './widgets/svg-wind/svg-wind.component';
import { WidgetGaugeComponent } from './widgets/widget-gauge/widget-gauge.component';
import { GaugeSteelComponent } from './widgets/gauge-steel/gauge-steel.component';
import { WidgetTutorialComponent } from './widgets/widget-tutorial/widget-tutorial.component';
import { ResetConfigComponent } from './reset-config/reset-config.component';
import { WidgetButtonComponent } from './widgets/widget-button/widget-button.component';
import { ModalWidgetConfigComponent } from './widget-config/modal-widget-config/modal-widget-config.component';
import { WidgetSwitchComponent } from './widgets/widget-switch/widget-switch.component'
import { ModalPathControlConfigComponent } from './widget-config/path-control-config/path-control-config.component';
import { SettingsUnitsComponent } from './settings/units/units.component';
import { SettingsZonesComponent, DialogNewZone, DialogEditZone } from './settings/zones/zones.component';
import { WidgetIframeComponent } from './widgets/widget-iframe/widget-iframe.component';
import { SettingsConfigComponent } from './settings/config/config.component';
import { WidgetGaugeNgLinearComponent } from './widgets/widget-gauge-ng-linear/widget-gauge-ng-linear.component';
import { WidgetGaugeNgRadialComponent } from './widgets/widget-gauge-ng-radial/widget-gauge-ng-radial.component';
import { AlarmMenuComponent } from './alarm-menu/alarm-menu.component';
import { WidgetAutopilotComponent } from './widgets/widget-autopilot/widget-autopilot.component';
import { SvgAutopilotComponent } from './widgets/svg-autopilot/svg-autopilot.component';
import { SettingsGeneralComponent } from './settings/general/general.component';
import { SvgSimpleLinearGaugeComponent } from './widgets/svg-simple-linear-gauge/svg-simple-linear-gauge.component';
import { WidgetSimpleLinearComponent } from './widgets/widget-simple-linear/widget-simple-linear.component';
import { DataBrowserComponent } from './data-browser/data-browser.component';
import { DataBrowserRowComponent, DialogUnitSelect } from './data-browser-row/data-browser-row.component';
import { ModalUserCredentialComponent } from './modal-user-credential/modal-user-credential.component';
import { WidgetRaceTimerComponent } from './widgets/widget-race-timer/widget-race-timer.component';
import { WidgetLoginComponent } from './widgets/widget-login/widget-login.component';
import { WidgetBooleanSwitchComponent } from './widgets/widget-boolean-switch/widget-boolean-switch.component';
import { SvgBooleanSwitchComponent } from './widgets/svg-boolean-switch/svg-boolean-switch.component';
import { BooleanMultiControlOptionsComponent } from './widget-config/boolean-multicontrol-options/boolean-multicontrol-options.component';
import { BooleanControlConfigComponent } from './widget-config/boolean-control-config/boolean-control-config.component';
import { PathsOptionsComponent } from './widget-config/paths-options/paths-options.component';
import { DisplayDatetimeComponent } from './widget-config/display-datetime/display-datetime.component';
import { SvgBooleanButtonComponent } from './widgets/svg-boolean-button/svg-boolean-button.component';
import { SvgBooleanLightComponent } from './widgets/svg-boolean-light/svg-boolean-light.component';


const appRoutes: Routes = [
  { path: '', redirectTo: 'page/0', pathMatch: 'full' },
  { path: 'page/:id', component: RootDisplayComponent },
  { path: 'settings', component: SettingsTabsComponent },
  { path: 'help', component: AppHelpComponent },
  { path: 'data',  component: DataBrowserComponent },
  { path: 'reset', component: ResetConfigComponent },
  { path: 'login', component: WidgetLoginComponent },
  { path: 'demo', component: ResetConfigComponent }
];


/**
 * Injectable class that override Hammerjs default gesture configuration.
 *
 * @export
 * @class kipHammerConfig
 * @extends {HammerGestureConfig}
 */
@Injectable()
export class kipHammerConfig extends HammerGestureConfig {
  // Override default hammerjs gestures configuration
  overrides = <any>{
    // swipe: { direction: (window as any).Hammer.DIRECTION_ALL },
  };
}

/**
 * Bootstrap function used by AppInitService provider at app initialization
 * that start network, authentication and storage service pre-app.component
 * start. app.component start all other services.
 *
 * @param {AppNetworkInitService} AppNetworkInitService instance
 * @return {*} Promise once AppNetworkInitService is done
 */
const appNetworkInitializerFn = (appNetInitSvc: AppNetworkInitService) => {
  return () => appNetInitSvc.initNetworkServices()
  .then(res => {})
  .catch(res => {})
};

@NgModule({
  declarations: [
    RootDisplayComponent,
    AppComponent,
    AppHelpComponent,
    SettingsTabsComponent,
    DynamicWidgetContainerComponent,
    DynamicWidgetContainerModalComponent,
    DialogUnitSelect,
    DynamicWidgetDirective,
    WidgetUnknownComponent,
    WidgetBlankComponent,
    WidgetTextGenericComponent,
    WidgetDateGenericComponent,
    WidgetNumericComponent,
    WidgetHistoricalComponent,
    WidgetGaugeNgLinearComponent,
    WidgetGaugeNgRadialComponent,
    WidgetTutorialComponent,
    WidgetWindComponent,
    WidgetButtonComponent,
    WidgetSwitchComponent,
    WidgetGaugeComponent,
    WidgetAutopilotComponent,
    WidgetSimpleLinearComponent,
    WidgetRaceTimerComponent,
    WidgetIframeComponent,
    WidgetLoginComponent,
    SvgWindComponent,
    SvgAutopilotComponent,
    SvgSimpleLinearGaugeComponent,
    GaugeSteelComponent,
    FitTextDirective,
    FilterSelfPipe,
    SafePipe,
    ObjectKeysPipe,
    SettingsDatasetsComponent,
    SettingsDatasetsModalComponent,
    SettingsSignalkComponent,
    SettingsConfigComponent,
    SettingsUnitsComponent,
    SettingsZonesComponent,
    DialogNewZone,
    DialogEditZone,
    LayoutSplitComponent,
    ResetConfigComponent,
    ModalWidgetConfigComponent,
    ModalPathControlConfigComponent,
    ModalUserCredentialComponent,
    AlarmMenuComponent,
    SettingsGeneralComponent,
    DataBrowserComponent,
    DataBrowserRowComponent,
    WidgetBooleanSwitchComponent,
    SvgBooleanSwitchComponent,
    BooleanMultiControlOptionsComponent,
    BooleanControlConfigComponent,
    PathsOptionsComponent,
    DisplayDatetimeComponent,
    SvgBooleanButtonComponent,
    SvgBooleanLightComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    RouterModule.forRoot(appRoutes, { useHash: true /*, enableTracing: true*/ } ),
    AngularSplitModule,
    AngularResizeEventModule,
    NgChartsModule,
    BrowserAnimationsModule,
    MatMenuModule,
    MatButtonModule,
    MatTooltipModule,
    MatDialogModule,
    MatSelectModule,
    MatToolbarModule,
    MatCheckboxModule,
    MatGridListModule,
    MatRadioModule,
    MatTabsModule,
    MatCardModule,
    MatSnackBarModule,
    MatStepperModule,
    MatInputModule,
    MatExpansionModule,
    MatBadgeModule,
    MatSlideToggleModule,
    MatListModule,
    MatAutocompleteModule,
    GaugesModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    HammerModule
  ],
  providers: [
    // Imports Interceptor that capture http requests and inserts authorization
    // Token automatically in every httpClient outbound calls.
    // NOTE: it does not work for WebSockets. Only http/REST calls
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthenticationInterceptor,
      multi: true
    },
    // Imports AppInitService which executes function appInitializerFn()
    // during the application initialization process (bootstrapping) to
    // get app config from server storage before starting AppSettings service.
    AppNetworkInitService,
      {
        provide: APP_INITIALIZER,
        useFactory: appNetworkInitializerFn,
        deps: [AppNetworkInitService],
        multi: true,
      },
    // Binds KIP's Hammerjs configuration overrides to a provider
    {
      provide: HAMMER_GESTURE_CONFIG,
      useClass: kipHammerConfig
    },
    // MatDialog App wide default config
    {
      provide: MAT_DIALOG_DEFAULT_OPTIONS,
      useValue: {
        panelClass: 'mat-dialog-panel',
        backdropClass: 'mat-dialog-backdrop',
        minWidth: '60%',
        minHeight: '50%',
        autoFocus: 'first-tabbable'
      }
    },
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: {
        appearance: 'outline',
        floatLabel: "always",
        subscriptSizing: "dynamic"
      }

    },
    AuthenticationService,
    SignalKService,
    SignalKConnectionService,
    SignalKDeltaService,
    DataSetService,
    LayoutSplitsService,
    WidgetListService,
    WidgetManagerService,
    UnitsService,
    AppSettingsService,
    NotificationsService,
    TimersService,
    StorageService
  ],
  bootstrap: [AppComponent]
})


export class AppModule {
  constructor() {

  }
}
