import { Component, input, output, signal, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

interface IconData {
  id: string;
}

@Component({
  selector: 'select-icon',
  imports: [CommonModule, MatIconModule],
  templateUrl: './select-icon.component.html',
  styleUrl: './select-icon.component.scss'
})
export class SelectIconComponent {
  iconFile = input<string>('assets/svg/icons.svg');
  currentIcon = input<string>('');
  selectedIcon = output<string>();

  icons = signal<IconData[]>([]);
  selected = signal<string>('');

  constructor() {
    this.loadIcons();
    // Watch for changes to currentIcon and update selection
    effect(() => {
      const current = this.currentIcon();
      untracked(() => {
        if (current && this.selected() !== current) {
          this.selected.set(current);
        }
      });
    });
  }

  private async loadIcons() {
    try {
      // Load the SVG file to extract icon IDs
      const response = await fetch(this.iconFile());
      const svgText = await response.text();
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
      const defs = svgDoc.querySelector('defs');
      if (!defs) return;

      const iconElements = defs.querySelectorAll('svg');
      const icons: IconData[] = [];
      iconElements.forEach(el => {
        const id = el.getAttribute('id');
        if (id && id.startsWith('dashboard-')) {
          icons.push({ id });
        }
      });
      this.icons.set(icons);

      // Set initial selection after icons are loaded
      const current = this.currentIcon();
      if (current) {
        this.selected.set(current);
      }
    } catch (error) {
      console.error('Error loading icons:', error);
    }
  }

  selectIcon(iconId: string) {
    this.selected.set(iconId);
    this.selectedIcon.emit(iconId);
  }
}
