import { Component, input, output, signal, inject, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';

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
  private static _iconSetRegistered = false;
  private iconRegistry = inject(MatIconRegistry);
  private sanitizer = inject(DomSanitizer);

  iconFile = input<string>('assets/svg/icons.svg');
  currentIcon = input<string>('');
  selectedIcon = output<string>();

  icons = signal<IconData[]>([]);
  selected = signal<string>('');

  constructor() {
    this.registerIconSet();
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

  private registerIconSet() {
    // Register SVG icon set once (same pattern as widget-list-card)
    if (!SelectIconComponent._iconSetRegistered) {
      this.iconRegistry.addSvgIconSet(this.sanitizer.bypassSecurityTrustResourceUrl(this.iconFile()));
      SelectIconComponent._iconSetRegistered = true;
    }
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
        if (id) {
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
