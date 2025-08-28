import { Component, inject, input } from '@angular/core';
import { MatIconRegistry, MatIconModule } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { MatCardModule } from '@angular/material/card';
import { MatRippleModule } from '@angular/material/core';

export interface LargeIconTile {
  svgIcon: string;
  iconSize: number;
  label: string;
}

@Component({
  selector: 'tile-large-icon',
  standalone: true,
  imports: [MatIconModule, MatCardModule, MatRippleModule],
  templateUrl: './tile-large-icon.component.html',
  styleUrl: './tile-large-icon.component.scss'
})
export class TileLargeIconComponent {
  private static _iconSetRegistered = false;
  public svgIcon = input.required<string>();
  public iconSize = input.required<number>();
  public label = input.required<string>();
  public iconOnly = input<boolean>(false);
  public compact = input<boolean>(false);
  public active = input<boolean>(false);

  constructor() {
    // Register SVG icon set once (MatIconRegistry keeps internal map; guard avoids redundant sanitizer work)
    const iconRegistry = inject(MatIconRegistry);
    const sanitizer = inject(DomSanitizer);
    if (!TileLargeIconComponent._iconSetRegistered) {
      iconRegistry.addSvgIconSet(sanitizer.bypassSecurityTrustResourceUrl('assets/svg/icons.svg'));
      TileLargeIconComponent._iconSetRegistered = true;
    }
  }
}
