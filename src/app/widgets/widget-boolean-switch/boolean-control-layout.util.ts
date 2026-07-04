import type { IDynamicControl } from '../../core/interfaces/widgets-interface';

export const BOOLEAN_CONTROL_BASE_HEIGHT = 35;
export const BOOLEAN_CONTROL_BASE_FONT_SIZE = 14;

export interface BooleanControlLayout {
  labelX: number;
  labelWidth: number;
  labelFontSize: number;
  shapeLaneWidth: number;
  switchTrackX: number;
  switchTrackY: number;
  switchTrackWidth: number;
  switchTrackHeight: number;
  switchTrackRadius: number;
  switchKnobOffX: number;
  switchKnobOnX: number;
  switchKnobY: number;
  switchKnobRadius: number;
  switchStrokeWidth: number;
  lightCenterX: number;
  lightCenterY: number;
  lightRadius: number;
  lightStrokeWidth: number;
  buttonX: number;
  buttonY: number;
  buttonWidth: number;
  buttonHeight: number;
  buttonRadius: number;
}

function scaleValue(height: number): number {
  return Math.max(height, 1) / BOOLEAN_CONTROL_BASE_HEIGHT;
}

export function getBooleanControlLayout(type: string, width: number, height: number): BooleanControlLayout {
  const safeWidth = Math.max(width, 0);
  const scale = scaleValue(height);
  const shapeLaneWidth = type === '2' ? 0 : 48 * scale;
  const rightPadding = type === '2' ? 12 * scale : 6 * scale;
  const labelX = type === '2' ? 12 * scale : shapeLaneWidth;
  const labelWidth = Math.max(0, safeWidth - labelX - rightPadding);

  return {
    labelX,
    labelWidth,
    labelFontSize: BOOLEAN_CONTROL_BASE_FONT_SIZE * scale,
    shapeLaneWidth,
    switchTrackX: 6 * scale,
    switchTrackY: 6 * scale,
    switchTrackWidth: 37.714306 * scale,
    switchTrackHeight: 22 * scale,
    switchTrackRadius: 11 * scale,
    switchKnobOffX: 17.5 * scale,
    switchKnobOnX: 32.5 * scale,
    switchKnobY: 17 * scale,
    switchKnobRadius: 10 * scale,
    switchStrokeWidth: 1.5 * scale,
    lightCenterX: 24.5 * scale,
    lightCenterY: 17.5 * scale,
    lightRadius: 13.5 * scale,
    lightStrokeWidth: 3 * scale,
    buttonX: 6 * scale,
    buttonY: 5 * scale,
    buttonWidth: Math.max(0, safeWidth - (12 * scale)),
    buttonHeight: 25.025183 * scale,
    buttonRadius: 3.6672263 * scale,
  };
}

export function measureBooleanControlsHeight(
  panelWidth: number,
  panelHeight: number,
  controls: Pick<IDynamicControl, 'type' | 'ctrlLabel'>[],
  measureTextWidth: (text: string, fontSize: number) => number,
): number {
  if (controls.length === 0) {
    return 0;
  }

  const maxByPanel = Math.max(1, Math.floor(panelHeight / controls.length));
  let low = 1;
  let high = maxByPanel;
  let best = 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const fits = controls.every(ctrl => {
      const layout = getBooleanControlLayout(ctrl.type, panelWidth, mid);
      return measureTextWidth(ctrl.ctrlLabel ?? '', layout.labelFontSize) <= layout.labelWidth;
    });

    if (fits) {
      best = mid;
      low = mid + 1;
      continue;
    }

    high = mid - 1;
  }

  return Math.min(best, maxByPanel);
}
