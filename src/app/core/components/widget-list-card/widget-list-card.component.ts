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
  public svgIcon = input.required<string>();
  public iconSize = input.required<number>();
  public name = input.required<string>();
  public description = input.required<string>();

  constructor() {
    const iconRegistry = inject(MatIconRegistry);
    const sanitizer = inject(DomSanitizer);
    iconRegistry.addSvgIconSet(sanitizer.bypassSecurityTrustResourceUrl('assets/svg/icons.svg'));
  }
}

