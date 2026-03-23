import { Component, Input, Directive } from '@angular/core';

export type NgCompInputs = Record<string, unknown>;

export interface NgGridStackNode {
  id?: string;
  [key: string]: unknown;
}

export interface NgGridStackWidget extends NgGridStackNode {
  input?: NgCompInputs;
  selector?: string;
  w?: number;
  h?: number;
  x?: number;
  y?: number;
}

export interface NgGridStackOptions {
  [key: string]: unknown;
  children?: NgGridStackWidget[];
}

@Directive()
export class BaseWidget {
  public serialize(): NgCompInputs {
    return {};
  }
}

@Component({
  selector: 'gridstack',
  template: ''
})
export class GridstackComponent {
  @Input() public options?: NgGridStackOptions;

  public grid = {
    setStatic: (flag: boolean) => {
      void flag;
      return undefined;
    },
    on: (event: string, cb: (...args: unknown[]) => void) => {
      void event;
      void cb;
      return undefined;
    },
    offAll: () => undefined,
    destroy: () => undefined,
    getGridItems: () => [] as (HTMLElement & { gridstackNode?: Record<string, unknown> })[],
    getCellFromPixel: (point: { left: number; top: number }) => {
      void point;
      return { x: 0, y: 0 };
    },
    isAreaEmpty: (x: number, y: number, w: number, h: number) => {
      void x;
      void y;
      void w;
      void h;
      return true;
    },
    addWidget: (widget: unknown) => ({ gridstackNode: widget as Record<string, unknown> }),
    removeWidget: (el: unknown) => {
      void el;
      return undefined;
    },
    save: (saveContent?: boolean, saveGridOpt?: boolean) => {
      void saveContent;
      void saveGridOpt;
      return [] as NgGridStackWidget[];
    },
    load: (widgets: unknown) => {
      void widgets;
      return undefined;
    },
    batchUpdate: (flag?: boolean) => {
      void flag;
      return undefined;
    },
    getRow: () => 24,
    cellHeight: (value: number) => {
      void value;
      return undefined;
    },
  };

  public static addComponentToSelectorType(components: unknown[]): void {
    void components;
    // no-op for tests
  }
}
