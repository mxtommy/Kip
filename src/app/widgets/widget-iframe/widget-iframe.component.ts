import { AfterViewInit, Component, effect, ElementRef, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { DashboardService } from '../../core/services/dashboard.service';
import { generateSwipeScript } from '../../core/utils/iframe-inputs-inject.utils';

@Component({
    selector: 'widget-iframe',
    templateUrl: './widget-iframe.component.html',
    styleUrls: ['./widget-iframe.component.scss'],
    imports: [WidgetHostComponent]
})
export class WidgetIframeComponent extends BaseWidgetComponent implements OnInit, AfterViewInit, OnDestroy {
  private _sanitizer = inject(DomSanitizer);
  protected _dashboard = inject(DashboardService);
  protected iframe = viewChild.required<ElementRef<HTMLIFrameElement>>('plainIframe');
  protected widgetUrl: SafeResourceUrl | null = null;
  protected displayTransparentOverlay = signal<string>('block');

  constructor() {
    super();

    this.defaultConfig = {
      widgetUrl: null,
      allowInput: false
    };

    effect(() => {
      if (!this._dashboard.isDashboardStatic()) {
        this.displayTransparentOverlay.set('block');
      } else {
        this.displayTransparentOverlay.set(this.widgetProperties.config.allowInput ? 'none' : 'block');
      }
    });
  }

  ngOnInit() {
    this.validateConfig();
    window.addEventListener('message', this.handleIframeGesture);
    this.displayTransparentOverlay.set(this.widgetProperties.config.allowInput ? 'none' : 'block');
    this.widgetUrl = this.resolveUrl(this.widgetProperties.config.widgetUrl);
  }

  ngAfterViewInit() {
    if (this.iframe()) {
  this.iframe().nativeElement.onload = () => this.injectSwipeScript();
    }
  }

  protected startWidget(): void {
  }

  ngOnDestroy() {
    window.removeEventListener('message', this.handleIframeGesture);
    // Clear iframe onload to release closure references
    if (this.iframe()) {
      this.iframe().nativeElement.onload = null;
    }
    // Remove injected script from iframe (if same-origin) to avoid lingering closures
    try {
      const iframeDoc = this.iframe()?.nativeElement.contentDocument;
      if (iframeDoc) {
        const id = `kip-gesture-inject-${this.widgetProperties.uuid}`;
        const existing = iframeDoc.getElementById(id);
        if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      }
    } catch { /* ignore cross-origin or access errors */ }
    // Ensure any data streams from BaseWidget are cleaned up
    try { this.destroyDataStreams(); } catch { /* noop if not present */ }
  }

  private handleIframeGesture = (event: MessageEvent) => {
    if (!event.data) return;

    // Handle gestures
    if (event.data.gesture && event.data.eventData.instanceId === this.widgetProperties.uuid) {
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
        case 'swiperight':{
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
        bubbles: true,
        cancelable: true,
      });
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
      const id = `kip-gesture-inject-${this.widgetProperties.uuid}`;
      // Avoid double-injecting the same script
      if (iframeDocument.getElementById(id)) return;
      const scriptText = generateSwipeScript({ instanceId: this.widgetProperties.uuid });
      const script = iframeDocument.createElement('script');
      script.id = id;
      script.textContent = scriptText;
      iframeDocument.body.appendChild(script);
    } catch (e) {
      console.warn('[WidgetIframe] Failed to inject swipe script into iframe:', e);
    }
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetUrl = this.resolveUrl(config.widgetUrl);
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

  private resolveUrl(rawUrl: string): SafeResourceUrl | null {
    if (!rawUrl) return null;
    try {
      // Check if the URL is absolute
      const parsedUrl = new URL(rawUrl, window.location.origin);
      const resolvedUrl = this.isValidProtocol(parsedUrl.href) ? this._sanitizer.bypassSecurityTrustResourceUrl(parsedUrl.href) : null;
      return resolvedUrl;
    } catch (e) {
      console.warn(`[Embed Widget] Can't resolve Url: ${rawUrl}, Error: ${e}`);
      return null; // Return an empty string if the URL is invalid
    }
  }
}
