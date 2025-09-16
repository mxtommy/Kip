import { DashboardService } from './../../core/services/dashboard.service';
import { AuthenticationService } from './../../core/services/authentication.service';
import { AppSettingsService } from './../../core/services/app-settings.service';
import { AfterViewInit, Component, ElementRef, inject, input, OnDestroy, OnInit, viewChild } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { SafePipe } from "../../core/pipes/safe.pipe";
import { Subscription } from 'rxjs';
import { generateSwipeScript } from '../../core/utils/iframe-inputs-inject.utils';

@Component({
  selector: 'widget-freeboardsk',
  templateUrl: './widget-freeboardsk.component.html',
  styleUrl: './widget-freeboardsk.component.scss',
  imports: [WidgetHostComponent, SafePipe]
})
export class WidgetFreeboardskComponent extends BaseWidgetComponent implements OnInit, AfterViewInit, OnDestroy {
  private appSettings = inject(AppSettingsService);
  private auth = inject(AuthenticationService);
  private _dashboard = inject(DashboardService);
  protected iframe = viewChild.required<ElementRef<HTMLIFrameElement>>('freeboardSkIframe');
  public widgetUrl: string = null;
  public disableWidgetShell = input<boolean>(false);
  private _authTokenSubscription: Subscription = null;
  protected dashboard = inject(DashboardService);

  constructor() {
    super();
  }

  ngOnInit(): void {
    let loginToken: string = null;
    this._authTokenSubscription = this.auth.authToken$.subscribe(AuthServiceToken => {
      loginToken = AuthServiceToken?.token;
    }
    );

    this.widgetUrl = loginToken ? `${this.appSettings.signalkUrl.url}/@signalk/freeboard-sk/?token=${loginToken}` : `${this.appSettings.signalkUrl.url}/@signalk/freeboard-sk/`;
    window.addEventListener('message', this.handleIframeGesture);
  }

  ngAfterViewInit() {
    if (this.iframe) {
      this.iframe().nativeElement.onload = () => this.injectSwipeScript();
    }
  }

  protected startWidget(): void {
  }

  protected updateConfig(): void {
  }

  private handleIframeGesture = (event: MessageEvent) => {
    if (!event.data) return;

    if (event.data.gesture && event.data.eventData.instanceId === this.widgetProperties.uuid) {
      switch (event.data.gesture) {
        case 'swipeup':
          if (this.dashboard.isDashboardStatic()) {
            this.dashboard.navigateToPreviousDashboard();
          }
          break;
        case 'swipedown':
          if (this.dashboard.isDashboardStatic()) {
            this.dashboard.navigateToNextDashboard();
          }
          break;
        case 'swipeleft': {
          const leftSidebarEvent = new Event('openLeftSidenav', { bubbles: true, cancelable: true });
          window.document.dispatchEvent(leftSidebarEvent);
          break;
        }
        case 'swiperight': {
          const rightSidebarEvent = new Event('openRightSidenav', { bubbles: true, cancelable: true });
          window.document.dispatchEvent(rightSidebarEvent);
          break;
        }
        default:
          break;
      }
    }

    // Handle keydown events
    if (event.data.type === 'keydown' && event.data.keyEventData.instanceId === this.widgetProperties.uuid) {
      const { key, ctrlKey, shiftKey } = event.data.keyEventData;

      // Re-dispatch the keydown event
      const keyboardEvent = new KeyboardEvent('keydown', {
        key,
        ctrlKey,
        shiftKey,
        bubbles: true, // Ensure the event bubbles up the DOM
        cancelable: true, // Allow the event to be canceled
      });
      document.dispatchEvent(keyboardEvent);
    }
  };

  injectSwipeScript() {
    const iframeWindow = this.iframe().nativeElement.contentWindow;
    const iframeDocument = this.iframe().nativeElement.contentDocument;
    if (!iframeDocument || !iframeWindow) {
      console.error('[FSK Widget] Iframe contentDocument or contentWindow is undefined. Possible cross-origin issue or iframe not fully loaded.');
      return;
    }
    try {
      const id = `kip-gesture-inject-${this.widgetProperties.uuid}`;
      if (iframeDocument.getElementById(id)) return; // already injected
      const scriptText = generateSwipeScript({ instanceId: this.widgetProperties.uuid });
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
    this.destroyDataStreams();
    // Clear iframe onload to release closure references
    if (this.iframe) {
  try { this.iframe().nativeElement.onload = null; } catch (err) { void err; }
      // Remove injected script from iframe (if same-origin)
      try {
        const iframeDoc = this.iframe()?.nativeElement.contentDocument;
        if (iframeDoc) {
          const id = `kip-gesture-inject-${this.widgetProperties.uuid}`;
          const existing = iframeDoc.getElementById(id);
          if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
        }
      } catch { /* ignore cross-origin or access errors */ }
    }
  }
}
