import { Directive, ViewContainerRef, inject } from '@angular/core';

@Directive({
    selector: '[dynamic-widget]',
    standalone: true
})
export class DynamicWidgetDirective {
  viewContainerRef = inject(ViewContainerRef);

  constructor() {
    const viewContainerRef = this.viewContainerRef;

    viewContainerRef.constructor.name === "ViewContainerRef"; // true
   }
}
