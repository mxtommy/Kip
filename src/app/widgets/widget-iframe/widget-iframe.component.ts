import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { AfterViewInit, Component, ElementRef, inject, OnDestroy, OnInit, viewChild } from '@angular/core';
import { SafePipe } from '../../core/pipes/safe.pipe';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { DashboardService } from '../../core/services/dashboard.service';
import { AppSettingsService } from '../../core/services/app-settings.service';

@Component({
    selector: 'widget-iframe',
    templateUrl: './widget-iframe.component.html',
    styleUrls: ['./widget-iframe.component.scss'],
    standalone: true,
    imports: [WidgetHostComponent, SafePipe]
})
export class WidgetIframeComponent extends BaseWidgetComponent implements OnInit, AfterViewInit, OnDestroy {
  protected _dashboard = inject(DashboardService);
  private _appSettings = inject(AppSettingsService);
  protected widgetUrl: string = null;
  protected iframe = viewChild<ElementRef<HTMLIFrameElement>>('plainIframe');
  private _widgetHost = viewChild(WidgetHostComponent);

  constructor() {
    super();

    this.defaultConfig = {
      widgetUrl: null
    };
  }

  ngOnInit() {
    this.initWidget();
    this.widgetUrl = this.widgetProperties.config.widgetUrl;
    window.addEventListener('message', this.handleIframeGesture);
  }

  ngAfterViewInit() {
    if (this.iframe() && this.iframe()?.nativeElement) {
      this.iframe().nativeElement.onload = () => this.injectHammerJS();
    }
  }

  protected startWidget(): void {
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetUrl = this.widgetProperties.config.widgetUrl = config.widgetUrl;
  }

  protected handleIframeGesture = (event: any) => {
    if (!event.data || !event.data.gesture || event.data.eventData.instanceId !== this.widgetProperties.uuid) return;

    switch (event.data.gesture) {
      case 'swipeup':
        if (this._dashboard.isDashboardStatic()) {
          this._dashboard.previousDashboard();
        }
        break;
      case 'swipedown':
        if (this._dashboard.isDashboardStatic()) {
          this._dashboard.nextDashboard();
        }
        break;
      case 'swipeleft':
          const leftSidebarEvent = new Event('openLeftSidenav', { bubbles: true, cancelable: true });
          window.document.dispatchEvent(leftSidebarEvent);
        break;
      case 'swiperight':
          const rightSidebarEvent = new Event('openRightSidenav', { bubbles: true, cancelable: true });
          window.document.dispatchEvent(rightSidebarEvent);
        break;
      case 'press':
        this._widgetHost()?.openBottomSheet();
        break;
      case 'doubletap':
        this._widgetHost()?.openWidgetOptions();
        break;
      default:
        break;
    }
  };

  injectHammerJS() {
    const iframeWindow = this.iframe().nativeElement.contentWindow;
    const iframeDocument = this.iframe().nativeElement.contentDocument;

    if (!iframeDocument || !iframeWindow) {
      console.error('[IFrame Widget] Iframe contentDocument or contentWindow is undefined. Possible cross-origin issue, bad or empty widget URL.');
      return;
    }

    if ((iframeWindow as any).Hammer) {
      console.log("[IFrame Widget] HammerJS already loaded in iframe");
      return;
    }

    // Inject HammerJS
    const hammerScript = iframeDocument.createElement('script');
    hammerScript.src = `${this._appSettings.signalkUrl.url}/@mxtommy/kip/assets/hammer.min.js`;
    hammerScript.onload = () => this.injectSwipeHandler();
    iframeDocument.body.appendChild(hammerScript);
  }

  injectSwipeHandler() {
    const iframeDocument = this.iframe().nativeElement.contentDocument;
    if (!iframeDocument) {
      console.error('[IFrame Widget] Iframe contentDocument is undefined. Possible cross-origin issue or iframe not fully loaded.');
      return;
    }

    // Create a script to listen for gestures and send a message to the parent page
    const script = iframeDocument.createElement('script');
    script.textContent = `
      if (!window.hammerInstance) {
        const hammer = new Hammer(document.body);
        hammer.get('swipe').set({ direction: Hammer.DIRECTION_ALL, velocity: 0.3, threshold: 10, domEvents: true });
        hammer.get('press').set({ time: 500 });
        hammer.get('doubletap').set({ taps: 2 });

        const instanceId = '${this.widgetProperties.uuid}'; // Include the instance ID in the script to prevent multiple listeners

        hammer.on('swipeleft', (ev) => {
          ev.preventDefault();
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

        hammer.on('press', (ev) => {
          ev.preventDefault();
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
          window.parent.postMessage({ gesture: 'press', eventData: eventData }, '*');
        });

        hammer.on('doubletap', (ev) => {
          ev.preventDefault();
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
          window.parent.postMessage({ gesture: 'doubletap', eventData: eventData }, '*');
        });

        window.hammerInstance = hammer; // Store the instance to prevent multiple listeners
      }
    `;
    iframeDocument.body.appendChild(script);
  }

  ngOnDestroy(): void {
    window.removeEventListener('message', this.handleIframeGesture);
  }
}
