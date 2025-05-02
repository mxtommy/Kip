import { enableProdMode, APP_INITIALIZER, Injectable, importProvidersFrom } from '@angular/core';
import { routes } from './app/app.routes';
import { environment } from './environments/environment';
import { AppComponent } from './app/app.component';
import { MAT_TOOLTIP_DEFAULT_OPTIONS } from '@angular/material/tooltip';
import { provideAnimations } from '@angular/platform-browser/animations';
import { withHashLocation, provideRouter } from '@angular/router';
import { StorageService } from './app/core/services/storage.service';
import { provideMarkdown } from 'ngx-markdown';
import { TimersService } from './app/core/services/timers.service';
import { NotificationsService } from './app/core/services/notifications.service';
import { AppSettingsService } from './app/core/services/app-settings.service';
import { UnitsService } from './app/core/services/units.service';
import { DashboardService } from './app/core/services/dashboard.service';
import { DatasetService } from './app/core/services/data-set.service';
import { SignalKDeltaService } from './app/core/services/signalk-delta.service';
import { SignalKConnectionService } from './app/core/services/signalk-connection.service';
import { DataService } from './app/core/services/data.service';
import { AuthenticationService } from './app/core/services/authentication.service';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { MAT_DIALOG_DEFAULT_OPTIONS } from '@angular/material/dialog';
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

/**
 * Injectable class that override Hammerjs default gesture configuration.
 *
 * @export
 * @class kipHammerConfig
 * @extends {HammerGestureConfig}
 */
@Injectable()
export class kipHammerConfig extends HammerGestureConfig {
  // see: https://angular.dev/api/platform-browser/HammerGestureConfig
  overrides = {
    // Override default hammerjs gestures configuration
    swipe: { direction: Hammer.DIRECTION_ALL, velocity: 0.3, threshold: 10, domEvents: true },
    press: { time: 500, domEvents: true },
  };
  options = {
    domEvents: true,
  };
}

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(
      BrowserModule,
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
      useClass: kipHammerConfig
    },
    // MatDialog App wide default config
    {
      provide: MAT_DIALOG_DEFAULT_OPTIONS,
      useValue: {
        hasBackdrop: true,
        disableClose: false,
        autoFocus: "first-tabbable",
        delayFocusTrap: true,
        backdropClass: "dialogBackdrop"
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
    {
      provide: MAT_TOOLTIP_DEFAULT_OPTIONS,
      useValue: {
        showDelay: 1500,
        hideDelay: 0
      },
    },
    AuthenticationService,
    DataService,
    SignalKConnectionService,
    SignalKDeltaService,
    DatasetService,
    DashboardService,
    UnitsService,
    AppSettingsService,
    NotificationsService,
    TimersService,
    StorageService,
    provideMarkdown(),
    provideHttpClient(withInterceptorsFromDi()),
    provideRouter(routes, withHashLocation()),
    provideAnimations(),
  ],
});
