import { AfterViewInit, Component, effect, ElementRef, inject, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { DashboardService } from '../../core/services/dashboard.service';

@Component({
    selector: 'widget-iframe',
    templateUrl: './widget-iframe.component.html',
    styleUrls: ['./widget-iframe.component.scss'],
    standalone: true,
    imports: [WidgetHostComponent]
})
export class WidgetIframeComponent extends BaseWidgetComponent implements OnInit, AfterViewInit, OnDestroy {
  private _sanitizer = inject(DomSanitizer);
  protected _dashboard = inject(DashboardService);
  @ViewChild('plainIframe', { static: false }) iframe!: ElementRef<HTMLIFrameElement>;
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
    if (this.iframe) {
      this.iframe.nativeElement.onload = () => this.injectHammerJS();
    }
  }

  protected startWidget(): void {
  }

  ngOnDestroy() {
    window.removeEventListener('message', this.handleIframeGesture);
  }

  private handleIframeGesture = (event: MessageEvent) => {
    if (!event.data) return;

    // Handle gestures
    if (event.data.gesture && event.data.eventData.instanceId === this.widgetProperties.uuid) {
      switch (event.data.gesture) {
        case 'swipeup':
          this._dashboard.previousDashboard();
          break;
        case 'swipedown':
          this._dashboard.nextDashboard();
          break;
        case 'swipeleft':
          const leftSidebarEvent = new Event('openLeftSidenav', { bubbles: true, cancelable: true });
          window.document.dispatchEvent(leftSidebarEvent);
          break;
        case 'swiperight':
          const rightSidebarEvent = new Event('openRightSidenav', { bubbles: true, cancelable: true });
          window.document.dispatchEvent(rightSidebarEvent);
          break;
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

  private injectHammerJS() {
    const baseHref = document.getElementsByTagName('base')[0]?.href || '/';
    const iframeWindow = this.iframe.nativeElement.contentWindow;
    const iframeDocument = this.iframe.nativeElement.contentDocument;

    if (!iframeDocument || !iframeWindow) {
      console.error('[WidgetIframe] Iframe contentDocument or contentWindow is undefined. Possible cross-origin issue or iframe not fully loaded.');
      return;
    }

    if ((iframeWindow as any).Hammer) {
      console.log('[WidgetIframe] HammerJS already loaded in iframe');
      return;
    }

    // Inject HammerJS
    const hammerScript = iframeDocument.createElement('script');
    hammerScript.src = `${baseHref}assets/hammer.min.js`;
    hammerScript.onload = () => this.injectSwipeHandler();
    iframeDocument.body.appendChild(hammerScript);
  }

  private injectSwipeHandler() {
    const iframeDocument = this.iframe.nativeElement.contentDocument;
    if (!iframeDocument) {
      console.error('[WidgetIframe] Iframe contentDocument is undefined. Possible cross-origin issue or iframe not fully loaded.');
      return;
    }

    // Create a script to listen for gestures and send a message to the parent page
    const script = iframeDocument.createElement('script');
    script.textContent = `
      if (!window.hammerInstance) {
        const hammer = new Hammer(document.body);
        hammer.get('swipe').set({ direction: Hammer.DIRECTION_ALL, velocity: 1.5, threshold: 200, domEvents: true });

        const instanceId = '${this.widgetProperties.uuid}'; // Include the instance ID in the script to prevent multiple listeners

        hammer.on('swipeleft', (ev) => {
          ev.preventDefault();
          ev.srcEvent.stopPropagation(); // Stop propagation to prevent FSK from handling the gesture
          const eventData = {
            type: ev.type,
            deltaX: ev.deltaX,
            deltaY: ev.deltaY,
            velocityX: ev.velocityX,
            velocityY: ev.velocityY,
            direction: ev.direction,
            distance: ev.distance,
            angle: ev.angle,
            center: ev.center,
            offsetDirection: ev.offsetDirection,
            scale: ev.scale,
            rotation: ev.rotation,
            isFinal: ev.isFinal,
            instanceId: instanceId // Include the instance ID in the event data
          };
          window.parent.postMessage({ gesture: 'swipeleft', eventData: eventData }, '*');
        });

        hammer.on('swiperight', (ev) => {
          ev.preventDefault();
          ev.srcEvent.stopPropagation(); // Stop propagation to prevent FSK from handling the gesture
          const eventData = {
            type: ev.type,
            deltaX: ev.deltaX,
            deltaY: ev.deltaY,
            velocityX: ev.velocityX,
            velocityY: ev.velocityY,
            direction: ev.direction,
            distance: ev.distance,
            angle: ev.angle,
            center: ev.center,
            offsetDirection: ev.offsetDirection,
            scale: ev.scale,
            rotation: ev.rotation,
            isFinal: ev.isFinal,
            instanceId: instanceId // Include the instance ID in the event data
          };
          window.parent.postMessage({ gesture: 'swiperight', eventData: eventData }, '*');
        });

        hammer.on('swipeup', (ev) => {
          ev.preventDefault();
          ev.srcEvent.stopPropagation(); // Stop propagation to prevent FSK from handling the gesture
          const eventData = {
            type: ev.type,
            deltaX: ev.deltaX,
            deltaY: ev.deltaY,
            velocityX: ev.velocityX,
            velocityY: ev.velocityY,
            direction: ev.direction,
            distance: ev.distance,
            angle: ev.angle,
            center: ev.center,
            offsetDirection: ev.offsetDirection,
            scale: ev.scale,
            rotation: ev.rotation,
            isFinal: ev.isFinal,
            instanceId: instanceId // Include the instance ID in the event data
          };
          window.parent.postMessage({ gesture: 'swipeup', eventData: eventData }, '*');
        });

        hammer.on('swipedown', (ev) => {
          ev.preventDefault();
          ev.srcEvent.stopPropagation(); // Stop propagation to prevent FSK from handling the gesture
          const eventData = {
            type: ev.type,
            deltaX: ev.deltaX,
            deltaY: ev.deltaY,
            velocityX: ev.velocityX,
            velocityY: ev.velocityY,
            direction: ev.direction,
            distance: ev.distance,
            angle: ev.angle,
            center: ev.center,
            offsetDirection: ev.offsetDirection,
            scale: ev.scale,
            rotation: ev.rotation,
            isFinal: ev.isFinal,
            instanceId: instanceId // Include the instance ID in the event data
          };
          window.parent.postMessage({ gesture: 'swipedown', eventData: eventData }, '*');
        });

        // Add keydown listener
        document.addEventListener('keydown', (event) => {
          if (event.ctrlKey && event.shiftKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'E', 'F', 'N'].includes(event.key)) {
            const keyEventData = {
              key: event.key,
              ctrlKey: event.ctrlKey,
              shiftKey: event.shiftKey,
              instanceId: instanceId
            };
            window.parent.postMessage({ type: 'keydown', keyEventData: keyEventData }, '*');
          }
        });

        window.hammerInstance = hammer; // Store the instance to prevent multiple listeners
      }
    `;
    iframeDocument.body.appendChild(script);
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetUrl = this.resolveUrl(config.widgetUrl);
  }

  private isValidProtocol(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch (e) {
      console.warn('[Embed Widget] isValidUrl: Invalid URL:', url);
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
      console.warn('[Embed Widget] Invalid URL:', rawUrl);
      return null; // Return an empty string if the URL is invalid
    }
  }
}
