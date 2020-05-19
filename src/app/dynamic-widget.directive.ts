import { Directive, ViewContainerRef } from '@angular/core';

@Directive({
  selector: '[dynamic-widget]'
})
export class DynamicWidgetDirective {

  constructor(public viewContainerRef: ViewContainerRef) {
    viewContainerRef.constructor.name === "ViewContainerRef"; // true
   }
}
