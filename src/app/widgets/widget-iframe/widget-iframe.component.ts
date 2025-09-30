import { AfterViewInit, Component, effect, ElementRef, inject, OnDestroy, signal, viewChild, input, untracked } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DashboardService } from '../../core/services/dashboard.service';
import { generateSwipeScript } from '../../core/utils/iframe-inputs-inject.utils';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { ITheme } from '../../core/services/app-service';

@Component({
  selector: 'widget-iframe',
  templateUrl: './widget-iframe.component.html',
  styleUrls: ['./widget-iframe.component.scss']
})
export class WidgetIframeComponent implements AfterViewInit, OnDestroy {
  // Functional Host2 inputs
  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme | null>();

  // Runtime directive (config merge done by container)
  protected readonly runtime = inject(WidgetRuntimeDirective);
  protected readonly _dashboard = inject(DashboardService);
  private readonly _sanitizer = inject(DomSanitizer);

  // Static default config (legacy parity)
  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    widgetUrl: null,
    allowInput: false
  };

  protected iframe = viewChild.required<ElementRef<HTMLIFrameElement>>('plainIframe');
  protected widgetUrl = signal<SafeResourceUrl | null>(null);
  protected displayTransparentOverlay = signal<string>('block');

  constructor() {
    // Effect to derive overlay state from dashboard edit/static + config.allowInput
    effect(() => {
      const cfg = this.runtime.options();
      const dashIsStatic = this._dashboard.isDashboardStatic();
      if (!cfg) return;
      untracked(() => {
        if (!dashIsStatic) this.displayTransparentOverlay.set('block');
        else this.displayTransparentOverlay.set(cfg.allowInput ? 'none' : 'block');
      });
    });

    // Effect to resolve URL when config changes
    effect(() => {
      const url = this.runtime.options()?.widgetUrl;
      this.widgetUrl.set(this.resolveUrl(url));
    });

    // Register message listener once
    window.addEventListener('message', this.handleIframeGesture);
  }

  ngAfterViewInit(): void {
    if (!this.iframe()) return;
    this.iframe().nativeElement.onload = () => this.injectSwipeScript();
    // Attempt injection if iframe already loaded (cached load edge case)
    try {
      const doc = this.iframe().nativeElement.contentDocument;
      if (doc && (doc.readyState === 'complete' || doc.readyState === 'interactive')) this.injectSwipeScript();
    } catch { /* ignore */ }
  }

  ngOnDestroy(): void {
    window.removeEventListener('message', this.handleIframeGesture);
    // Clear iframe onload to release closure references
    if (this.iframe()) this.iframe().nativeElement.onload = null;
    // Remove injected script from iframe (if same-origin) to avoid lingering closures
    try {
      const iframeDoc = this.iframe()?.nativeElement.contentDocument;
      if (iframeDoc) {
        const id = `kip-gesture-inject-${this.id()}`;
        const existing = iframeDoc.getElementById(id);
        if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      }
    } catch { /* ignore cross-origin or access errors */ }
  }

  private handleIframeGesture = (event: MessageEvent) => {
    if (!event.data) return;

    const instanceId = event.data?.eventData?.instanceId || event.data?.keyEventData?.instanceId;
    if (!instanceId || instanceId !== this.id()) return;

    // Handle gestures
    if (event.data.gesture) {
      switch (event.data.gesture) {
        case 'swipeup':
          this._dashboard.navigateToPreviousDashboard();
          break;
        case 'swipedown':
          this._dashboard.navigateToNextDashboard();
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
    if (event.data.type === 'keydown' && event.data.keyEventData) {
      const { key, ctrlKey, shiftKey } = event.data.keyEventData;
      const keyboardEvent = new KeyboardEvent('keydown', { key, ctrlKey, shiftKey, bubbles: true, cancelable: true });
      document.dispatchEvent(keyboardEvent);
    }
  };

  private injectSwipeScript() {
    const iframeWindow = this.iframe().nativeElement.contentWindow;
    const iframeDocument = this.iframe().nativeElement.contentDocument;
    if (!iframeDocument || !iframeWindow) {
      console.error('[WidgetIframe] Iframe contentDocument or contentWindow is undefined. Possible cross-origin issue or iframe not fully loaded.');
      return;
    }
    try {
      const id = `kip-gesture-inject-${this.id()}`;
      // Avoid double-injecting the same script
      if (iframeDocument.getElementById(id)) return;
      const scriptText = generateSwipeScript({ instanceId: this.id() });
      const script = iframeDocument.createElement('script');
      script.id = id;
      script.textContent = scriptText;
      iframeDocument.body.appendChild(script);
    } catch (e) {
      console.warn('[WidgetIframe] Failed to inject swipe script into iframe:', e);
    }
  }

  private isValidProtocol(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch (e) {
      console.warn(`[Embed Widget] Invalid Url: ${url}, Error: ${e}`);
      return false;
    }
  }

  private resolveUrl(rawUrl: string | null | undefined): SafeResourceUrl | null {
    if (!rawUrl) return null;
    try {
      const parsedUrl = new URL(rawUrl, window.location.origin);
      return this.isValidProtocol(parsedUrl.href) ? this._sanitizer.bypassSecurityTrustResourceUrl(parsedUrl.href) : null;
    } catch (e) {
      console.warn(`[Embed Widget] Can't resolve Url: ${rawUrl}, Error: ${e}`);
      return null;
    }
  }
}
