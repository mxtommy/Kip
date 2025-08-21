// Global steelseries test shim: provides minimal objects to satisfy component module-time constant initializations.
// This avoids ReferenceError / TypeError in unit test environment where the real script isn't loaded.
// Only minimal keys used across components are provided; values are simple identifiers.
// Extend if specs start needing additional properties.
/* eslint-disable @typescript-eslint/no-explicit-any */
if (typeof (globalThis as any).steelseries === 'undefined') {
  (globalThis as any).steelseries = {};
}
const ss: any = (globalThis as any).steelseries;
ss.BackgroundColor = ss.BackgroundColor || {
  DARK_GRAY: 'darkGray', SATIN_GRAY: 'satinGray', LIGHT_GRAY: 'lightGray', WHITE: 'white', BLACK: 'black',
  BEIGE: 'beige', BROWN: 'brown', RED: 'red', GREEN: 'green', BLUE: 'blue', ANTHRACITE: 'anthracite', MUD: 'mud',
  PUNCHED_SHEET: 'punchedSheet', CARBON: 'carbon', STAINLESS: 'stainless', BRUSHED_METAL: 'brushedMetal',
  BRUSHED_STAINLESS: 'brushedStainless', TURNED: 'turned'
};
ss.FrameDesign = ss.FrameDesign || {
  BLACK_METAL: 'blackMetal', METAL: 'metal', SHINY_METAL: 'shinyMetal', BRASS: 'brass', STEEL: 'steel', CHROME: 'chrome',
  GOLD: 'gold', ANTHRACITE: 'anthracite', TILTED_GRAY: 'tiltedGray', TILTED_BLACK: 'tiltedBlack', GLOSSY_METAL: 'glossyMetal'
};
ss.ColorDef = ss.ColorDef || {
  RED: color('red'), GREEN: color('green'), BLUE: color('blue'), ORANGE: color('orange'), YELLOW: color('yellow'),
  CYAN: color('cyan'), MAGENTA: color('magenta'), WHITE: color('white'), GRAY: color('gray'), BLACK: color('black'),
  RAITH: color('raith'), GREEN_LCD: color('greenLcd'), JUG_GREEN: color('jugGreen')
};
ss.LcdColor = ss.LcdColor || { STANDARD: lcd('standard'), STANDARD_GREEN: lcd('standardGreen'), BLACK: lcd('black') };
ss.PointerType = ss.PointerType || { TYPE1: 'type1', TYPE2: 'type2', TYPE8: 'type8' };
ss.KnobType = ss.KnobType || { STANDARD_KNOB: 'standardKnob', METAL_KNOB: 'metalKnob' };
ss.KnobStyle = ss.KnobStyle || { SILVER: 'silver', BLACK: 'black' };
ss.ForegroundType = ss.ForegroundType || { TYPE1: 'type1' };
ss.LedColor = ss.LedColor || { RED_LED: 'redLed' };
ss.GaugeType = ss.GaugeType || { TYPE1: 'type1', TYPE5: 'type5' };
ss.Orientation = ss.Orientation || { WEST: 'west', EAST: 'east' };
ss.LabelNumberFormat = ss.LabelNumberFormat || { STANDARD: 'standard' };

function color(name: string) {
  return { name, light: simpleShade(name,'light'), medium: simpleShade(name,'medium'), dark: simpleShade(name,'dark'), getRgbaColor: () => name };
}
function lcd(name: string) {
  return { name, textColor: '#fff' };
}
function simpleShade(base: string, shade: string) {
  return { getRgbaColor: () => base + '-' + shade };
}
export {};
