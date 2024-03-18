import {Directive, ElementRef, Input, AfterViewInit, HostListener} from '@angular/core';

@Directive({
    selector: '[fit-text]',
    standalone: true
})
export class FitTextDirective {


    @Input('fit-text') fitText: boolean = true;
    @Input('container') container: HTMLDivElement;
    @Input('activateOnResize') activateOnResize: boolean = true;
    @Input('minFontSize') minFontSize: number = -1 / 0;
    @Input('maxFontSize') maxFontSize: number = 1 / 0;
    @Input('compression') compression: number = 1;

    constructor(public el: ElementRef) {}

    private setFontSize = (): void => {
        if (this.fitText) {
            let fontSize;
            let width = this.el.nativeElement.parentElement.clientWidth;
            let height = this.el.nativeElement.parentElement.clientHeight;

            fontSize =
                        Math.min(
                            Math.max(
                                Math.min(
                                    width / (this.compression * 10),
                                    this.maxFontSize),
                                this.minFontSize),
                            height); //TODO, does not take text width into consideration :(


            return this.el.nativeElement.style.setProperty('font-size', (fontSize).toString() + 'px');
        }
    };

    /*@HostListener('window:resize', ['$event'])
    public onResize = (): void => { */
    ngOnChanges(changes: any) {
        if (this.activateOnResize) {
            setTimeout(() => {
                this.setFontSize();
                 },10);
        }
    };
}
