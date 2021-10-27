/*!
 * The MIT License (MIT)
 *
 * Copyright (c) 2017 Vlad Martynenko <vladimir.martynenko.work@gmail.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import {Component, NgZone, ElementRef, OnInit} from '@angular/core';
import {BaseGauge} from './base-gauge';
import * as CanvasGauges from 'canvas-gauges';

export { LinearGaugeOptions } from 'canvas-gauges';

/**
 * Implements Linear Gauge from the original library
 */
@Component({
    // tslint:disable-next-line:component-selector
    selector: 'linear-gauge',
    template: '<canvas #gauge></canvas>'
})
// tslint:disable-next-line:component-class-suffix
export class LinearGauge extends BaseGauge<CanvasGauges.LinearGauge, CanvasGauges.LinearGaugeOptions> implements OnInit {

    constructor(el: ElementRef, zone: NgZone) {
        super(el, zone);
    }


    ngOnInit(): void {
        this.gauge = new CanvasGauges.LinearGauge(this.options).draw();
    }
}