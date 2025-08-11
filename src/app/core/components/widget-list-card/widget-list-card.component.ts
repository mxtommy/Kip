import { Component, inject, input, HostListener } from '@angular/core';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'widget-list-card',
  imports: [MatIconModule],
  templateUrl: './widget-list-card.component.html',
  styleUrl: './widget-list-card.component.scss'
})
export class WidgetListCardComponent {
  private static _iconSetRegistered = false;
  protected svgIcon = input.required<string>();
  protected iconSize = input.required<number>();
  protected name = input.required<string>();
  protected description = input.required<string>();
  protected pluginsStatus = input.required<{ name: string; enabled: boolean }[]>();
  protected pluginDependencyValid = input.required<boolean>();

  constructor() {
    // Register SVG icon set once (MatIconRegistry keeps internal map; guard avoids redundant sanitizer work)
    const iconRegistry = inject(MatIconRegistry);
    const sanitizer = inject(DomSanitizer);
    if (!WidgetListCardComponent._iconSetRegistered) {
      iconRegistry.addSvgIconSet(sanitizer.bypassSecurityTrustResourceUrl('assets/svg/icons.svg'));
      WidgetListCardComponent._iconSetRegistered = true;
    }
  }

  // Allow activation by keyboard when focused
  @HostListener('keydown', ['$event'])
  onKeydown(ev: KeyboardEvent) {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      (ev.target as HTMLElement).click();
    }
  }
}

