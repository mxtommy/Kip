import { DashboardService } from './../../core/services/dashboard.service';
import { AuthenticationService } from './../../core/services/authentication.service';
import { AppSettingsService } from './../../core/services/app-settings.service';
import { AfterViewInit, Component, ElementRef, effect, inject, input, OnDestroy, viewChild, signal } from '@angular/core';
import { SafePipe } from "../../core/pipes/safe.pipe";
import { Subscription } from 'rxjs';
import { generateSwipeScript } from '../../core/utils/iframe-inputs-inject.utils';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { ITheme } from '../../core/services/app-service';

@Component({
  selector: 'widget-freeboardsk',
  templateUrl: './widget-freeboardsk.component.html',
  styleUrl: './widget-freeboardsk.component.scss',
  imports: [SafePipe]
})
export class WidgetFreeboardskComponent implements AfterViewInit, OnDestroy {
  public id = input<string>();
  public type = input<string>();
  public theme = input<ITheme | null>();

  private readonly runtime = inject(WidgetRuntimeDirective, { optional: true });

  private appSettings = inject(AppSettingsService);
  private auth = inject(AuthenticationService);
  protected dashboard = inject(DashboardService);
  protected iframe = viewChild.required<ElementRef<HTMLIFrameElement>>('freeboardSkIframe');
  public widgetUrl: string = null;
  public disableWidgetShell = input<boolean>(false);
  public swipeDisabled = input<boolean>(false);
  private _authTokenSubscription: Subscription = null;

  private viewReady = signal(false);

  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
  };

  constructor() {
    effect(() => {
      const _cfg = this.runtime?.options();
      void _cfg;
      if (!this._authTokenSubscription) {
        this._authTokenSubscription = this.auth.authToken$.subscribe(token => {
          const loginToken = token?.token;
          this.widgetUrl = loginToken ? `${this.appSettings.signalkUrl.url}/@signalk/freeboard-sk/?token=${loginToken}` : `${this.appSettings.signalkUrl.url}/@signalk/freeboard-sk/`;
        });
      }
    });
    window.addEventListener('message', this.handleIframeGesture);
  }

  ngAfterViewInit(): void {
    this.viewReady.set(true);
    if (this.iframe) {
      try { this.iframe().nativeElement.onload = () => this.injectSwipeScript(); } catch { /* ignore */ }
    }
  }

  private handleIframeGesture = (event: MessageEvent) => {
    if (!event.data) return;
    const instanceId = this.id();
    if (event.data.gesture && event.data.eventData.instanceId === instanceId) {
      switch (event.data.gesture) {
        case 'swipeup':
          if (this.dashboard.isDashboardStatic()) this.dashboard.navigateToPreviousDashboard();
          break;
        case 'swipedown':
          if (this.dashboard.isDashboardStatic()) this.dashboard.navigateToNextDashboard();
          break;
        case 'swipeleft':
          window.document.dispatchEvent(new Event('openLeftSidenav', { bubbles: true, cancelable: true }));
          break;
        case 'swiperight':
          window.document.dispatchEvent(new Event('openRightSidenav', { bubbles: true, cancelable: true }));
          break;
      }
    }
    if (event.data.type === 'keydown' && event.data.keyEventData.instanceId === instanceId) {
      const { key, ctrlKey, shiftKey } = event.data.keyEventData;
      const keyboardEvent = new KeyboardEvent('keydown', { key, ctrlKey, shiftKey, bubbles: true, cancelable: true });
      document.dispatchEvent(keyboardEvent);
    }
  };

  injectSwipeScript() {
    if (this.swipeDisabled()) return;
    const iframeWindow = this.iframe().nativeElement.contentWindow;
    const iframeDocument = this.iframe().nativeElement.contentDocument;
    if (!iframeDocument || !iframeWindow) {
      console.error('[FSK Widget] Iframe contentDocument or contentWindow is undefined.');
      return;
    }
    try {
      const id = `kip-gesture-inject-${this.id()}`;
      if (iframeDocument.getElementById(id)) return;
      const scriptText = generateSwipeScript({ instanceId: this.id() });
      const script = iframeDocument.createElement('script');
      script.id = id;
      script.textContent = scriptText;
      iframeDocument.body.appendChild(script);
    } catch (e) {
      console.warn('[FSK Widget] Failed to inject swipe script into iframe:', e);
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('message', this.handleIframeGesture);
    this._authTokenSubscription?.unsubscribe();
    if (this.iframe) {
      try { this.iframe().nativeElement.onload = null; } catch (err) { void err; }
      try {
        const iframeDoc = this.iframe()?.nativeElement.contentDocument;
        if (iframeDoc) {
          const id = `kip-gesture-inject-${this.id()}`;
          const existing = iframeDoc.getElementById(id);
          if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
        }
      } catch { /* ignore cross-origin */ }
    }
  }
}
