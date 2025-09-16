import { enableProdMode, importProvidersFrom, provideAppInitializer } from '@angular/core';
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
import { BrowserModule, bootstrapApplication } from '@angular/platform-browser';
import { AppNetworkInitService } from './app/core/services/app-initNetwork.service';
import { ConnectionStateMachine } from './app/core/services/connection-state-machine.service';
import { AuthenticationInterceptor } from './app/core/interceptors/authentication-interceptor';
import { HTTP_INTERCEPTORS, withInterceptorsFromDi, provideHttpClient } from '@angular/common/http';
import { OverlayContainer } from '@angular/cdk/overlay';
import { AppOverlayContainer } from './app/core/utils/app-overlay-container';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
  importProvidersFrom(BrowserModule),
    // Imports Interceptor that capture http requests and inserts authorization
    // Token automatically in every httpClient outbound calls.
    // NOTE: it does not work for WebSockets. Only http/REST calls
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthenticationInterceptor,
      multi: true,
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
    ConnectionStateMachine,
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
    // Ensure CDK Overlay container is created inside the application root so
    // overlays share the same stacking context as the app elements (sidenavs, etc.)
    {
      provide: OverlayContainer,
      useClass: AppOverlayContainer,
    },
    /**
     * Bootstrap function that starts network, authentication and storage service
     * and gets the configuration from Signal K before app.component is started.
     *
     * This is needed to ensure that the app has the configuration
     * before it starts.
     *
     * app.component then starts all other services.
     *
     * @param {AppNetworkInitService} AppNetworkInitService instance
     * @return {*} Promise once AppNetworkInitService is done
     */
    provideAppInitializer(() => {
      const appNetInitSvc = new AppNetworkInitService();
      return appNetInitSvc.initNetworkServices()
        .then(() => { })
        .catch(() => { });
    }),
  ],
});
