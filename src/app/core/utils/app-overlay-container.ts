import { Injectable } from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';

/**
 * Custom OverlayContainer which mounts the CDK overlay container inside
 * a chosen host element (for example `#app-filter-wrapper`) so overlays
 * live in the same stacking context as the app (and sidenavs).
 */
@Injectable()
export class AppOverlayContainer extends OverlayContainer {
  protected override _createContainer(): void {
    const container = document.createElement('div');
    container.classList.add('cdk-overlay-container');

    // Prefer attaching into the app wrapper that creates the app stacking context.
    const host = (
      document.getElementById('app-filter-wrapper') ||
      document.querySelector('app-root') ||
      document.body
    ) as HTMLElement;

    host.appendChild(container);
    this._containerElement = container;
  }
}
