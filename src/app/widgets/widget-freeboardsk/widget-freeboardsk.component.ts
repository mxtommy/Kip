import { DashboardService } from './../../core/services/dashboard.service';
import { AuthenticationService } from './../../core/services/authentication.service';
import { AppSettingsService } from './../../core/services/app-settings.service';
import { AfterViewInit, Component, ElementRef, inject, OnDestroy, OnInit, viewChild } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { SafePipe } from "../../core/pipes/safe.pipe";
import { Subscription } from 'rxjs';

@Component({
    selector: 'widget-freeboardsk',
    standalone: true,
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
      this.iframe().nativeElement.onload = () => this.injectHammerJS();
    }
  }

  protected startWidget(): void {
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
  }

  private handleIframeGesture = (event: MessageEvent) => {
    if (!event.data) return;

    if (event.data.gesture && event.data.eventData.instanceId === this.widgetProperties.uuid) {
      switch (event.data.gesture) {
        case 'swipeup':
          if (this.dashboard.isDashboardStatic()) {
            this.dashboard.previousDashboard();
          }
          break;
        case 'swipedown':
          if (this.dashboard.isDashboardStatic()) {
            this.dashboard.nextDashboard();
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

  injectHammerJS() {
    const baseHref = document.getElementsByTagName('base')[0]?.href || '/';
    const iframeWindow = this.iframe().nativeElement.contentWindow;
    const iframeDocument = this.iframe().nativeElement.contentDocument;

    if (!iframeDocument || !iframeWindow) {
      console.error('[FSK Widget] Iframe contentDocument or contentWindow is undefined. Possible cross-origin issue or iframe not fully loaded.');
      return;
    }

    if ((iframeWindow as any).Hammer) {
      console.log("[FSK Widget] HammerJS already loaded in iframe");
      return;
    }

    // Inject HammerJS
    const hammerScript = iframeDocument.createElement('script');
    hammerScript.src = `${baseHref}assets/hammer.min.js`;
    hammerScript.onload = () => this.injectSwipeHandler();
    iframeDocument.body.appendChild(hammerScript);
  }

  injectSwipeHandler() {
    const iframeDocument = this.iframe().nativeElement.contentDocument;
    if (!iframeDocument) {
      console.error('[FSK Widget] Iframe contentDocument is undefined. Possible cross-origin issue or iframe not fully loaded.');
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

  ngOnDestroy(): void {
    window.removeEventListener('message', this.handleIframeGesture);
    this._authTokenSubscription?.unsubscribe();
    this.destroyDataStreams();
  }
}
