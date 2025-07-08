import { Component, inject, input } from '@angular/core';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'widget-list-card',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './widget-list-card.component.html',
  styleUrl: './widget-list-card.component.scss'
})
export class WidgetListCardComponent {
  protected svgIcon = input.required<string>();
  protected iconSize = input.required<number>();
  protected name = input.required<string>();
  protected description = input.required<string>();
  protected pluginsStatus = input.required<{ name: string; enabled: boolean }[]>();
  protected pluginDependencyValid = input.required<boolean>();

  constructor() {
    const iconRegistry = inject(MatIconRegistry);
    const sanitizer = inject(DomSanitizer);
    iconRegistry.addSvgIconSet(sanitizer.bypassSecurityTrustResourceUrl('assets/svg/icons.svg'));
  }
}

