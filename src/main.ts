import { enableProdMode, APP_INITIALIZER, Injectable, importProvidersFrom } from '@angular/core';
import { environment } from './environments/environment';
import { AppComponent } from './app/app.component';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatListModule } from '@angular/material/list';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatBadgeModule } from '@angular/material/badge';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatInputModule } from '@angular/material/input';
import { MatStepperModule } from '@angular/material/stepper';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatRadioModule } from '@angular/material/radio';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { provideAnimations } from '@angular/platform-browser/animations';
import { AngularResizeEventModule } from 'angular-resize-event';
import { GaugesModule } from '@biacsics/ng-canvas-gauges';
import { AngularSplitModule } from 'angular-split';
import { WidgetLoginComponent } from './app/widgets/widget-login/widget-login.component';
import { DataBrowserComponent } from './app/data-browser/data-browser.component';
import { AppHelpComponent } from './app/app-help/app-help.component';
import { SettingsTabsComponent } from './app/settings/tabs/tabs.component';
import { RootDisplayComponent } from './app/root-display/root-display.component';
import { withHashLocation, provideRouter, Routes } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { StorageService } from './app/core/services/storage.service';
import { TimersService } from './app/core/services/timers.service';
import { NotificationsService } from './app/core/services/notifications.service';
import { AppSettingsService } from './app/core/services/app-settings.service';
import { UnitsService } from './app/core/services/units.service';
import { WidgetManagerService } from './app/core/services/widget-manager.service';
import { WidgetListService } from './app/core/services/widget-list.service';
import { LayoutSplitsService } from './app/core/services/layout-splits.service';
import { DatasetService } from './app/core/services/data-set.service';
import { SignalKDeltaService } from './app/core/services/signalk-delta.service';
import { SignalKConnectionService } from './app/core/services/signalk-connection.service';
import { SignalKDataService } from './app/core/services/signalk-data.service';
import { AuthenticationService } from './app/core/services/authentication.service';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { MAT_DIALOG_DEFAULT_OPTIONS, MatDialogModule } from '@angular/material/dialog';
import { HAMMER_GESTURE_CONFIG, HammerGestureConfig, BrowserModule, HammerModule, bootstrapApplication } from '@angular/platform-browser';
import { AppNetworkInitService } from './app/core/services/app-initNetwork.service';
import { AuthenticationInterceptor } from './app/core/interceptors/authentication-interceptor';
import { HTTP_INTERCEPTORS, withInterceptorsFromDi, provideHttpClient } from '@angular/common/http';

import 'hammerjs';

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
    .then(res => { })
    .catch(res => { })
};
const appRoutes: Routes = [
  { path: '', redirectTo: 'page/0', pathMatch: 'full' },
  { path: 'page/:id', component: RootDisplayComponent },
  { path: 'settings', component: SettingsTabsComponent },
  { path: 'help', component: AppHelpComponent },
  { path: 'data', component: DataBrowserComponent },
  { path: 'login', component: WidgetLoginComponent }
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

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(
      BrowserModule,
      FormsModule,
      ReactiveFormsModule,
      AngularSplitModule,
      AngularResizeEventModule,
      GaugesModule,
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
      MatTableModule,
      MatPaginatorModule,
      MatSortModule,
      HammerModule
    ),
    // Imports Interceptor that capture http requests and inserts authorization
    // Token automatically in every httpClient outbound calls.
    // NOTE: it does not work for WebSockets. Only http/REST calls
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthenticationInterceptor,
      multi: true,
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
      useClass: kipHammerConfig,
    },
    // MatDialog App wide default config
    {
      provide: MAT_DIALOG_DEFAULT_OPTIONS,
      useValue: {
        panelClass: "mat-dialog-panel",
        backdropClass: "mat-dialog-backdrop",
        minWidth: "60%",
        minHeight: "50%",
        autoFocus: "first-tabbable",
      },
    },
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: {
        appearance: "outline",
        floatLabel: "always",
        subscriptSizing: "dynamic",
      },
    },
    AuthenticationService,
    SignalKDataService,
    SignalKConnectionService,
    SignalKDeltaService,
    DatasetService,
    LayoutSplitsService,
    WidgetListService,
    WidgetManagerService,
    UnitsService,
    AppSettingsService,
    NotificationsService,
    TimersService,
    StorageService,
    provideHttpClient(withInterceptorsFromDi()),
    provideRouter(appRoutes, withHashLocation()),
    provideAnimations(),
  ],
});
