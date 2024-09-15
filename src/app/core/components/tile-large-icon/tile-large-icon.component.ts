import { Component, inject, input } from '@angular/core';
import { MatIconRegistry, MatIconModule } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { MatCardModule } from '@angular/material/card';

export interface LargeIconTile {
  svgIcon: string;
  iconSize: number;
  label: string;
}

@Component({
  selector: 'tile-large-icon',
  standalone: true,
  imports: [MatIconModule, MatCardModule],
  templateUrl: './tile-large-icon.component.html',
  styleUrl: './tile-large-icon.component.scss'
})
export class TileLargeIconComponent {
  public svgIcon = input.required<string>();
  public iconSize = input.required<number>();
  public label = input.required<string>();

  constructor() {
    const iconRegistry = inject(MatIconRegistry);
    const sanitizer = inject(DomSanitizer);
    iconRegistry.addSvgIconSet(sanitizer.bypassSecurityTrustResourceUrl('assets/svg/icons.svg'));
  }
}
