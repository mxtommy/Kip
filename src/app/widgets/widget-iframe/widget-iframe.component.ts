import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { Component, inject, OnInit } from '@angular/core';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AppService } from '../../core/services/app-service';

@Component({
    selector: 'widget-iframe',
    templateUrl: './widget-iframe.component.html',
    styleUrls: ['./widget-iframe.component.scss'],
    standalone: true,
    imports: [WidgetHostComponent]
})
export class WidgetIframeComponent extends BaseWidgetComponent implements OnInit {
  private _sanitizer = inject(DomSanitizer);
  protected widgetUrl: SafeResourceUrl | null = null;

  constructor() {
    super();

    this.defaultConfig = {
      widgetUrl: null
    };
  }

  ngOnInit() {
    this.validateConfig();;
    this.validateUrlAccess(this.widgetProperties?.config?.widgetUrl);
  }

  protected startWidget(): void {
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.validateUrlAccess(this.widgetProperties.config.widgetUrl = config.widgetUrl);
  }

  private validateUrlAccess(url: string | null): void {
    if (!url) return;
    this.widgetUrl = this.isValidProtocol(url) ? this._sanitizer.bypassSecurityTrustResourceUrl(url) : null;
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
}
