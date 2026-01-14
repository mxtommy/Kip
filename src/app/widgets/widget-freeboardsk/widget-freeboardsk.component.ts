import { DashboardService } from './../../core/services/dashboard.service';
import { AuthenticationService, IAuthorizationToken } from './../../core/services/authentication.service';
import { AppSettingsService } from './../../core/services/app-settings.service';
import { AfterViewInit, Component, ElementRef, effect, inject, input, OnDestroy, viewChild, untracked } from '@angular/core';
import { SafePipe } from "../../core/pipes/safe.pipe";
import { generateSwipeScript } from '../../core/utils/iframe-inputs-inject.utils';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { AppService, ITheme } from '../../core/services/app-service';
import { toSignal } from '@angular/core/rxjs-interop';

interface FreeboardCommandMessage {
  settings?: {
    autoNightMode?: boolean;
  };
  commands?: {
    nightModeEnable?: boolean;
  };
};


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

  public disableWidgetShell = input<boolean>(false);
  public swipeDisabled = input<boolean>(false);

  private readonly runtime = inject(WidgetRuntimeDirective, { optional: true });
  private readonly appSettings = inject(AppSettingsService);
  private readonly app = inject(AppService);
  private readonly auth = inject(AuthenticationService);
  protected readonly dashboard = inject(DashboardService);

  protected iframe = viewChild.required<ElementRef<HTMLIFrameElement>>('freeboardSkIframe');

  private readonly authToken = toSignal<IAuthorizationToken | null>(this.auth.authToken$, { initialValue: null });

  private viewReady = false;
  private iframeLoaded = false;
  public widgetUrl: string = null;
  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {};

  constructor() {
    window.addEventListener('message', this.handleIframeGesture);

    effect(() => {
      const token = this.authToken();

      untracked(() => {
        const loginToken = token?.token;
        this.widgetUrl = loginToken
          ? `${this.appSettings.signalkUrl.url}/@signalk/freeboard-sk/?token=${loginToken}`
          : `${this.appSettings.signalkUrl.url}/@signalk/freeboard-sk/`;
      });
    });

    effect(() => {
      const nightModeEnabled = this.app.isNightMode();

      untracked(() => {
        if (!this.iframeLoaded || !this.viewReady) return;
        if(this.appSettings.getRedNightMode()) {
          this.sendMessage({ commands: { nightModeEnable: nightModeEnabled } });
        }
      });
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;

    // Ensure we mark the iframe loaded AND inject gestures.
    try {
      this.iframe().nativeElement.onload = () => {
        this.iframeLoaded = true;
        this.sendMessage({ settings: { autoNightMode: false } });
        this.injectSwipeScript();
      };
    } catch {
      /* ignore */
    }
  }

  private sendMessage(msg: FreeboardCommandMessage, targetOrigin = '*'): void {
    const window = this.iframe()?.nativeElement?.contentWindow;
    if (!window) return;
    if (!this.iframeLoaded) return;

    window.postMessage(msg, targetOrigin);
  }

  private injectSwipeScript() {
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

  private handleIframeGesture = (event: MessageEvent) => {
    if (!event.data) return;

    // Only accept messages originating from this widget's iframe.
    if (!this.viewReady) return;
    let iframeWindow: Window | null = null;
    try {
      iframeWindow = this.iframe()?.nativeElement?.contentWindow ?? null;
    } catch {
      iframeWindow = null;
    }
    if (!iframeWindow || event.source !== iframeWindow) return;

    const expectedOrigin = this.getExpectedIframeOrigin();
    if (expectedOrigin && event.origin !== expectedOrigin) return;

    const instanceId = this.id();
    if (event.data.gesture && event.data.eventData?.instanceId === instanceId) {
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
    if (event.data.type === 'keydown' && event.data.keyEventData?.instanceId === instanceId) {
      const { key, ctrlKey, shiftKey } = event.data.keyEventData;
      const keyboardEvent = new KeyboardEvent('keydown', { key, ctrlKey, shiftKey, bubbles: true, cancelable: true });
      document.dispatchEvent(keyboardEvent);
    }
  };

  private getExpectedIframeOrigin(): string | null {
    const candidate = this.widgetUrl || this.appSettings.signalkUrl.url;
    if (!candidate) return null;
    try {
      return new URL(candidate).origin;
    } catch {
      return null;
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('message', this.handleIframeGesture);
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
