import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatRippleModule } from '@angular/material/core';

export interface LargeIconTile {
  svgIcon: string;
  iconSize: number;
  label: string;
}

@Component({
  selector: 'tile-large-icon',
  imports: [MatIconModule, MatCardModule, MatRippleModule],
  templateUrl: './tile-large-icon.component.html',
  styleUrl: './tile-large-icon.component.scss'
})
export class TileLargeIconComponent {
  public svgIcon = input.required<string>();
  public iconSize = input.required<number>();
  public label = input.required<string>();
  public iconOnly = input<boolean>(false);
  public compact = input<boolean>(false);
  public active = input<boolean>(false);
}
