export type GridStackOptions = Record<string, unknown>;

export type GridItemHTMLElement = HTMLElement & {
  gridstackNode?: Record<string, unknown>;
};

export class GridStack {}

export default GridStack;
