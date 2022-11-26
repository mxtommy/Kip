// Modules
import { BrowserModule } from '@angular/platform-browser';
import { NgModule, APP_INITIALIZER } from '@angular/core';
import { RouterModule, Routes }   from '@angular/router';
import { FormsModule }   from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule } from '@angular/material/dialog';
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
// Modules Pipes & Directives
import { FilterSelfPipe } from './filter-self.pipe';
import { ObjectKeysPipe } from './object-keys.pipe';
import { SafePipe } from './safe.pipe';
import { FitTextDirective } from './fit-text.directive';
import { DynamicWidgetDirective } from './dynamic-widget.directive';
// Services
import { SignalKService } from './signalk.service';
import { SignalKConnectionService } from './signalk-connection.service';
import { SignalKDeltaService } from './signalk-delta.service';
import { DataSetService } from './data-set.service';
import { LayoutSplitsService } from './layout-splits.service';
import { AppSettingsService } from './app-settings.service';
import { WidgetManagerService } from './widget-manager.service';
import { WidgetListService } from './widget-list.service';
import { UnitsService } from './units.service';
import { NotificationsService } from './notifications.service';
import { TimersService } from './timers.service';
import { StorageService } from './storage.service';
import { AppNetworkInitService } from "./app-initNetwork.service";
import { AuththeticationService } from "./auththetication.service";
import { AuthenticationInterceptor } from "./authentication-interceptor";
//Components
import { AppComponent } from './app.component';
import { AppHelpComponent } from './app-help/app-help.component';
import { WidgetBlankComponent } from './widget-blank/widget-blank.component';
import { WidgetUnknownComponent } from './widget-unknown/widget-unknown.component';
import { WidgetTextGenericComponent } from './widget-text-generic/widget-text-generic.component';
import { UnitWindowComponent, UnitWindowModalComponent } from './unit-window/unit-window.component';
import { SettingsComponent } from './settings/settings.component';
import { RootDisplayComponent } from './root-display/root-display.component';
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
import { WidgetButtonComponent } from './widget-button/widget-button.component';
import { ModalWidgetComponent } from './modal-widget/modal-widget.component';
import { WidgetSwitchComponent } from './widget-switch/widget-switch.component'
import { ModalPathSelectorComponent } from './modal-path-selector/modal-path-selector.component';
import { SettingsUnitsComponent } from './settings-units/settings-units.component';
import { SettingsZonesComponent, DialogNewZone, DialogEditZone } from './settings-zones/settings-zones.component';
import { WidgetIframeComponent } from './widget-iframe/widget-iframe.component';
import { SettingsConfigComponent } from './settings-config/settings-config.component';
import { WidgetGaugeNgLinearComponent } from './widget-gauge-ng-linear/widget-gauge-ng-linear.component';
import { WidgetGaugeNgRadialComponent } from './widget-gauge-ng-radial/widget-gauge-ng-radial.component';
import { AlarmMenuComponent } from './alarm-menu/alarm-menu.component';
import { WidgetAutopilotComponent } from './widget-autopilot/widget-autopilot.component';
import { SvgAutopilotComponent } from './svg-autopilot/svg-autopilot.component';
import { SettingsNotificationsComponent } from './settings-notifications/settings-notifications.component';
import { SvgSimpleLinearGaugeComponent } from './svg-simple-linear-gauge/svg-simple-linear-gauge.component';
import { WidgetSimpleLinearComponent } from './widget-simple-linear/widget-simple-linear.component';
import { DataBrowserComponent } from './data-browser/data-browser.component';
import { DataBrowserRowComponent, DialogUnitSelect } from './data-browser-row/data-browser-row.component';
import { ModalUserCredentialComponent } from './modal-user-credential/modal-user-credential.component';
import { WidgetRaceTimerComponent } from './widget-race-timer/widget-race-timer.component';
import { WidgetLoginComponent } from './widget-login/widget-login.component';

const appRoutes: Routes = [
  { path: '', redirectTo: '/page/0', pathMatch: 'full' },
  { path: 'page/:id', component: RootDisplayComponent },
  { path: 'settings', component: SettingsComponent },
  { path: 'help', component: AppHelpComponent },
  { path: 'data',  component: DataBrowserComponent },
  { path: 'reset', component: ResetConfigComponent },
  { path: 'login', component: WidgetLoginComponent },
  { path: 'demo', component: ResetConfigComponent }
];

/**
 * Bootstrap function used by AppInitService provider at app initialyzation
 * that start network, authetification and storage service pre-app.compoment
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
    SettingsComponent,
    UnitWindowComponent,
    UnitWindowModalComponent,
    DialogUnitSelect,
    DynamicWidgetDirective,
    WidgetUnknownComponent,
    WidgetBlankComponent,
    WidgetTextGenericComponent,
    FitTextDirective,
    FilterSelfPipe,
    SafePipe,
    WidgetNumericComponent,
    SettingsDatasetsComponent,
    SettingsDatasetsModalComponent,
    SettingsSignalkComponent,
    SettingsConfigComponent,
    SettingsUnitsComponent,
    SettingsZonesComponent,
    DialogNewZone,
    DialogEditZone,
    WidgetHistoricalComponent,
    LayoutSplitComponent,
    WidgetWindComponent,
    SvgWindComponent,
    WidgetGaugeComponent,
    GaugeSteelComponent,
    WidgetGaugeNgLinearComponent,
    WidgetGaugeNgRadialComponent,
    WidgetTutorialComponent,
    ResetConfigComponent,
    WidgetButtonComponent,
    ModalWidgetComponent,
    WidgetSwitchComponent,
    ModalPathSelectorComponent,
    ObjectKeysPipe,
    WidgetIframeComponent,
    AlarmMenuComponent,
    WidgetAutopilotComponent,
    SvgAutopilotComponent,
    SettingsNotificationsComponent,
    SvgSimpleLinearGaugeComponent,
    WidgetSimpleLinearComponent,
    DataBrowserComponent,
    DataBrowserRowComponent,
    WidgetRaceTimerComponent,
    ModalUserCredentialComponent,
    WidgetLoginComponent,
  ],
  imports: [
    BrowserModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    RouterModule.forRoot(appRoutes, { useHash: true /* , enableTracing: true */, relativeLinkResolution: 'legacy' } ),
    AngularSplitModule,
    AngularResizeEventModule,
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
  ],
  providers: [
    // Imports Interceptor to capture http requests and incert authorization
    // Token automatically in every httpClient outbound calls.
    // NOTE: it does not work for WebSockets. Only http/REST calls
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthenticationInterceptor,
      multi: true
    },
    // Imports AppInitService which executes function appInitializerFn()
    // during the application initialisation process (bootstrapping) to
    // get app config from server storage before starting AppSettings service.
    AppNetworkInitService,
      {
        provide: APP_INITIALIZER,
        useFactory: appNetworkInitializerFn,
        deps: [AppNetworkInitService],
        multi: true,
      },
    AuththeticationService,
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
