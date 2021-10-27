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

import { ViewChild, Input, NgZone, ElementRef, OnInit, AfterViewInit, Directive } from '@angular/core';
import * as CanvasGauges from 'canvas-gauges';
import * as Rx from 'rx-dom-html';



// String utils
const toCamelCase = (str: string) => str.replace(/(\-\w)/g, (matches) => matches[1].toUpperCase());

const toKebabCase = (str: string) => str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

const attributeName2PropertyName = (attrName: string) => toCamelCase(attrName);




/**
 * Base gauge component for the Gauges rendering
 * T - Type of the Gauge to be rendered (Currently RadialGauge, LinearGauge from the original library)
 * T2 - Type of config options used by the particular gauge (RadialGaugeOptions, LinearGaugeOptions)
 */
@Directive()
export abstract class BaseGauge<T extends CanvasGauges.BaseGauge, T2 extends CanvasGauges.GenericOptions>
    implements OnInit, AfterViewInit {

    /**
     * Canvas element on the template used by the library to draw gauge element
     */
    @ViewChild('gauge', { static: true })
    protected canvas: ElementRef;

    /**
     * A gauge instance responsible for rendering and updates on the canvas.
     * Subclasses should initialize in their ngOnInit implementation.
     */
    protected gauge: T;


    /**
     * Flag indicating that OnViewInit life-cycle has completed
     */
    private isInited = false;

    /**
     * value property of gauge prior to component view initialization
     */
    private preInitValue: number;

    /**
     * options property of gauge prior to component view initialization
     */
    private preInitOptions: T2;


    /**
     * Listen for attribute changes, i.e., options properties that are stored
     * as attributes on this ElementRef
     */
    private domListener: MutationObserver;


    /**
     *
     * @param el - reference to the element of the whole component, used to scrape options declared on the component itself
     * @param zone - required to redraw gauge outside of Angular, due to animation lags caused by the ovewritten function of the ngZone
     */
    constructor(private el: ElementRef, public zone: NgZone) {
    }


    /**
     * Subclasses should instantiate the CanvasGauge object in the child component
     */
    abstract ngOnInit(): void;


    /**
     * Returns gauges properties as an options object.
     * Option properties consist of the attribute-based properties and those
     * explicitly set.
     * @returns <T2>
     */
    public get options(): T2 {

        const options = {} as T2;
        options.renderTo = this.canvas.nativeElement;

        // Map attribute-based options onto options.
        // Requries converting kebab style attribute names to camelCase property names
        for (const attr of this.el.nativeElement.attributes) {
            const prop = attributeName2PropertyName(attr.name);
            options[prop] = CanvasGauges.DomObserver.parse(attr.value);
        }

        // merge preOptons with attribute-based properties
        // tslint:disable-next-line:forin
        for (const prop in this.preInitOptions) {
            options[prop] = this.preInitOptions[prop];
        }

        // clear the preInitOptions as they have already been merged
        // with the attribute-based properties
        if (this.isInited) {
            this.preInitOptions = null;
        }

        return options;
    }


    /**
     * Assign gauge options at anytime in the lifecycle.
     * @param newOptions - assign the style and size properties
     */
    @Input()
    public set options(newOptions: T2) {

        // cache newOptions as preInitOptions until gauge is ready
        if (!this.isInited) {
            this.preInitOptions = newOptions;
            return;
        }

        this.update(newOptions);
    }


    /**
     * Assign the value of the gauge visual indicator such as a needle or pointer
     * @param newValue  the guage new value
     */
    @Input()
    public set value(newValue: number) {

        // case new gauge value as preInitValue until the gauge is ready
        if (!this.isInited) {
            this.preInitValue = newValue;
            return;
        }

        this.zone.runOutsideAngular(() => {
            this.gauge.value = newValue;
        });
    }


    /**
     * Update the gauge options. Do not use until after OnViewInit() before using.
     *
     * Special implementation note - options.properties are maintained as
     * attribute name->value on this component's elementRef.  Thus this method
     * maps each newOptions property onto the property's corresponding attribute.
     * The attribute update triggers a DOM mutation event which  "this" listens for.
     * See #listenForDOMEvents()
     *
     * @param newOptions  - the options to update the gauge
     */
    public update(newOptions: T2 | {}) {

        // map all options onto this element's attributes
        // Then attribute changes will be detected and pushed to the gauge.update()
        if (!newOptions) { return; }

        // tslint:disable-next-line:forin
        for (const prop in newOptions) {
            const val = newOptions[prop].toString();

            if (prop === 'value') {
                // short circuit the value property update by calling
                // the gauge.value api directly for efficient animated update
                this.value = CanvasGauges.DomObserver.parse(val);
            } else {
                const attrName = toKebabCase(prop);
                this.el.nativeElement.setAttribute(attrName, val);
            }
        }
    }


    /**
     * Perform gauge initialization.
     * Subclasses that override this method must this super version
     * for proper operation.
     */
    public ngAfterViewInit() {

        // initial update of gauge properties
        this.initGauge();

        this.listenForDOMEvents();

        this.isInited = true;

        if (this.preInitValue) {
          this.value = this.preInitValue;
        }
    }


    /**
     * Listen for attribute-change events that are created when updating
     * the options of this gauge.
     */
    protected listenForDOMEvents() {
        // Listen to gauge element for attribute changes
        // Convert all changed attribtues into a GenericOptions or subclass
        // Update the gauge with the new options.
        this.domListener =
            Rx.DOM.fromMutationObserver(this.el.nativeElement, { attributes: true }).
                subscribe(changes => {
                    const newOptions = {} as T2;
                    changes.forEach(change => {
                        if ('attributes' === change.type) {
                            // console.log('DOM, change', change.attributeName);
                            newOptions[attributeName2PropertyName(change.attributeName)] =
                                CanvasGauges.DomObserver.parse(
                                    this.el.nativeElement.getAttribute(change.attributeName));
                        }
                    });

                    this.basicUpdate(newOptions);
                });
    }


    /**
     * Discontinue listening for attribute change events.
     */
    protected stopListeningForDOMEvents() {
        if (this.domListener) {
            this.domListener.disconnect();
            this.domListener = null;
        }
    }


    /**
     * Initalize the gauge with all options defined by attributes and
     * parent component options.
     */
    protected initGauge() {
        const options = this.options;

        // init options.renderTo if needed
        if (!options.hasOwnProperty('renderTo') || !options.renderTo) {
            options.renderTo = this.canvas.nativeElement;
        }

        this.basicUpdate(options);
    }


    /**
     * Performs the gauge update using the current options
     * @param options  The options for the guage
     */
    protected basicUpdate(options: T2) {

        // treat the value property special and update it through the
        // value getter.
        if (typeof options.value === 'number') {

            // use gauge api directly for most efficient update method
            this.value = options.value;

            // filter value property from options to avoid redundant
            // processing by gauge
            delete options.value;
        }

        // do nothing if no option properties to update
        if (Object.keys(options).length) {
            this.gauge.update(options);
        }
    }

}