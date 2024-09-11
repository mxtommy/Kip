import { Component, inject, input } from '@angular/core';
import { MatIconRegistry, MatIconModule } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';

export interface LargeIconTile {
  svgIcon: string;
  iconSize: number;
  label: string;
}

@Component({
  selector: 'large-icon-tile',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './large-icon-tile.component.html',
  styleUrl: './large-icon-tile.component.scss'
})
export class LargeIconTileComponent {
  public svgIcon = input.required<string>();
  public iconSize = input.required<number>();
  public label = input.required<string>();

  constructor() {
    const iconRegistry = inject(MatIconRegistry);
    const sanitizer = inject(DomSanitizer);
    iconRegistry.addSvgIconSet(sanitizer.bypassSecurityTrustResourceUrl('assets/svg-icons/actions.svg'));
  }
}
