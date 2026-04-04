export const ELECTRICAL_DIRECT_CARD_VIEWBOX_WIDTH = 200;
export const ELECTRICAL_DIRECT_CARD_HEIGHT = 100;
// Keep compact mode visually identical to the shared direct card baseline.
export const ELECTRICAL_DIRECT_COMPACT_CARD_HEIGHT = 100;
export const ELECTRICAL_DIRECT_CARD_GAP = 8;

export interface IElectricalDirectCardLayout {
  cardCornerRadius: number;
  stateBarCornerRadius: number;
  titleX: number;
  titleY: number;
  titleFontSize: number;
  primaryX: number;
  primaryY: number;
  primaryFontSize: number;
  primaryFontWeight: number;
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
  titleX: 0, //TODO: remove once title is removed from the design
  titleY: 10, //TODO: remove once title is removed from the design
  titleFontSize: 12.5, //TODO: remove once title is removed from the design
  primaryX: 135,
  primaryY: 48,
  primaryFontSize: 34,
  primaryFontWeight: 700,
  lineOneX: 5,
  lineOneY: 30,
  lineOneFontSize: 20,
  lineTwoX: 10,
  lineTwoY: 93,
  lineTwoFontSize: 8,
  idX: 194,
  idY: 26,
  idFontSize: 7.5,
  metaLeftX: 5,
  metaRightX: 194,
  metaY: 63,
  metaFontSize: 8
};

export const ELECTRICAL_DIRECT_CARD_COMPACT_LAYOUT: IElectricalDirectCardLayout = {
  ...ELECTRICAL_DIRECT_CARD_FULL_LAYOUT
};
