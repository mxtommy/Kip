import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'widget-list-card',
  imports: [CommonModule, MatIconModule],
  templateUrl: './widget-list-card.component.html',
  styleUrl: './widget-list-card.component.scss',
  host: { '(keydown)': 'onKeydown($event)' }
})
export class WidgetListCardComponent {
  protected svgIcon = input.required<string>();
  protected iconSize = input.required<number>();
  protected name = input.required<string>();
  protected description = input.required<string>();
  protected pluginsStatus = input.required<{ name: string; enabled: boolean; required: boolean }[]>();
  protected pluginDependencyValid = input.required<boolean>();

  onKeydown(ev: KeyboardEvent) {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      (ev.target as HTMLElement).click();
    }
  }
}

