import { TScaleType } from "../interfaces/signalk-interfaces";

export interface IScale {
  min: number;
  max: number;
  majorTicks: number[];
}

/**
 * Returns an adjusted scale range, with major tick values that are well rounded ie. limiting
 * tick value factions as best as possible. Note that the min/max value are starting points.
 * The returned range may be different from the input range, as the min/max values *may
 * will be adjusted.
 *
 * @private
 * @param {number} minValue suggested range min value
 * @param {number} maxValue suggested range max value
 * @param {boolean} [invert=false] whether the resulting scale should be inverted. When true, min/max are swapped and ticks are reversed.
 * @return {*}  {[number, number, number[]]} array containing calculated rounded range minimal value, maximum value and the corresponding tick array values
 */
export function adjustLinearScaleAndMajorTicks(minValue: number, maxValue: number, invert = false): IScale {
  const tickArray = [] as number[];
  let niceRange = maxValue - minValue;
  let majorTickSpacing = 0;
  const maxNoOfMajorTicks = 10;


  niceRange = calcNiceNumber(maxValue - minValue, false);
  majorTickSpacing = calcNiceNumber(niceRange / (maxNoOfMajorTicks - 1), true);
  const niceMinValue = Math.floor(minValue / majorTickSpacing) * majorTickSpacing;
  const niceMaxValue = Math.ceil(maxValue / majorTickSpacing) * majorTickSpacing;

  tickArray.push(niceMinValue);

  const range: number = niceRange / majorTickSpacing;

  for (let index = 0; index < range; index++) {
    if (tickArray[index] < niceMaxValue) {
      const tick = (Number(tickArray[index].toFixed(2)) * 100 + Number(majorTickSpacing.toFixed(2)) * 100) / 100;
      tickArray.push(tick);
    }
  }
  // Ensure the last tick is the niceMaxValue
  if (tickArray[tickArray.length - 1] !== niceMaxValue) {
    tickArray.push(niceMaxValue);
  }
  if (invert) {
    const invertedTicks = [...tickArray].reverse();
    return { min: niceMinValue, max: niceMaxValue, majorTicks: invertedTicks };
  }
  return { min: niceMinValue, max: niceMaxValue, majorTicks: tickArray };
}

function calcNiceNumber(range: number, round: boolean): number {
  const exponent = Math.floor(Math.log10(range));   // exponent of range
  const fraction = range / Math.pow(10, exponent);  // fractional part of range
  let niceFraction: number = null;                  // nice, rounded fraction

  if (round) {
      if (1.5 > fraction) {
          niceFraction = 1;
      } else if (3 > fraction) {
          niceFraction = 2;
      } else if (7 > fraction) {
          niceFraction = 5;
      } else {
          niceFraction = 10;
      }
  } else {
      if (1 >= fraction) {
          niceFraction = 1;
      } else if (2 >= fraction) {
          niceFraction = 2;
      } else if (5 >= fraction) {
          niceFraction = 5;
      } else {
          niceFraction = 10;
      }
  }
  return niceFraction * Math.pow(10, exponent);
}


export function generateScaleTypeTicks(minValue: number, maxValue: number, scaleType: TScaleType): number[] {
  const ticks: number[] = [];

  switch (scaleType) {
    case 'linear': { const numTicksLinear = calculateNiceLinearNumTicks(minValue, maxValue);
      const rangeLinear = maxValue - minValue;
      const stepLinear = rangeLinear / (numTicksLinear - 1);

      for (let i = 0; i < numTicksLinear; i++) {
        const tick = minValue + (i * stepLinear);
        ticks.push(tick);
      }
      break;
    }
    default:
      throw new Error(`Invalid or or not implemented scale type: ${scaleType}`);
  }

  return ticks;
}


function calculateNiceLinearNumTicks(minValue: number, maxValue: number): number {
  const range = maxValue - minValue;
  let step = range / 10; // Start with a step that divides the range into 10 parts

  // Increase the step until we get a step value with no more than 1 decimal place
  while (Math.floor(step * 10) !== step * 10) {
    step += 0.1;
  }

  // Calculate the number of ticks based on the step
  const numTicks = Math.round(range / step);

  return numTicks;
}


/**
 * Transforms a value to a new value based on a focal range.
 *
 * @export
 * @param {number} value The value to transform
 * @param {number} minValue The minimum value of the original range
 * @param {number} maxValue The maximum value of the original range
 * @param {number} focalRangeStart The start of the focal range
 * @param {number} focalRangeEnd The end of the focal range
 * @param {number} focalRange The size of the focal range
 * @return {*}  {number}
 */
export function focalRangeTransform(value: number, minValue: number, maxValue: number, focalRangeStart: number, focalRangeEnd: number, focalRange: number): number {
  if (value < focalRangeStart) {
    return minValue + ((value - minValue) * 0.4); // Non-focal range (40%)
  } else if (value <= focalRangeEnd) {
    return minValue + (value - focalRangeStart) * ((maxValue - minValue) * 0.6 / focalRange);
  } else {
    return minValue + ((maxValue - minValue) * 0.6) + ((value - focalRangeEnd) * 0.4); // Non-focal range (40%)
  }
};
