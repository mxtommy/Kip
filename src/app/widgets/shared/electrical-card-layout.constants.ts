export const ELECTRICAL_DIRECT_CARD_VIEWBOX_WIDTH = 200;
export const ELECTRICAL_DIRECT_CARD_HEIGHT = 114;
// Keep compact mode visually identical to the shared direct card baseline.
export const ELECTRICAL_DIRECT_COMPACT_CARD_HEIGHT = 114;
export const ELECTRICAL_DIRECT_CARD_GAP = 8;

export interface IElectricalDirectCardLayout {
  cardCornerRadius: number;
  stateBarCornerRadius: number;
  titleX: number;
  titleY: number;
  titleFontSize: number;
  idX: number;
  idY: number;
  idFontSize: number;
  metaLeftX: number;
  metaRightX: number;
  metaY: number;
  metaFontSize: number;
  lineOneX: number;
  lineOneY: number;
  lineOneFontSize: number;
  lineTwoX: number;
  lineTwoY: number;
  lineTwoFontSize: number;
}

export const ELECTRICAL_DIRECT_CARD_FULL_LAYOUT: IElectricalDirectCardLayout = {
  cardCornerRadius: 4,
  stateBarCornerRadius: 2.5,
  titleX: 5,
  titleY: 16,
  titleFontSize: 15.5,
  idX: 194,
  idY: 16,
  idFontSize: 7.5,
  metaLeftX: 10,
  metaRightX: 194,
  metaY: 53,
  metaFontSize: 6,
  lineOneX: 10,
  lineOneY: 37,
  lineOneFontSize: 16,
  lineTwoX: 10,
  lineTwoY: 83,
  lineTwoFontSize: 6
};

export const ELECTRICAL_DIRECT_CARD_COMPACT_LAYOUT: IElectricalDirectCardLayout = {
  ...ELECTRICAL_DIRECT_CARD_FULL_LAYOUT
};
