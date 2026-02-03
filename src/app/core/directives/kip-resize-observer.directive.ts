import { Directive, ElementRef, EventEmitter, NgZone, OnDestroy, Output, inject } from '@angular/core';

export interface IKipResizeEvent {
  width: number;
  height: number;
  entry: ResizeObserverEntry;
}

@Directive({
  selector: '[kipResizeObserver]',
  standalone: true,
})
export class KipResizeObserverDirective implements OnDestroy {
  @Output() resizeChange = new EventEmitter<ResizeObserverEntry>();
  @Output() kipResize = new EventEmitter<IKipResizeEvent>();

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);

  private ro: ResizeObserver | null = null;

  constructor() {
    this.zone.runOutsideAngular(() => {
      this.ro = new ResizeObserver((entries) => {
        const entry = entries[entries.length - 1];
        const { width, height } = entry.contentRect;
        this.zone.run(() => {
          this.resizeChange.emit(entry);
          this.kipResize.emit({ width, height, entry });
        });
      });

      this.ro.observe(this.el.nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
    this.ro = null;
  }
}
