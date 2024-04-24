/**
* Normalizes a value to a range from 0 to 1 based on the specified scale type.
*
* @param V - The value to normalize.
* @param L - The lower limit of the range to normalize to.
* @param U - The upper limit of the range to normalize to.
* @param scaleType - The type of scale to use. Can be 'linear', 'logarithmic', 'squareroot', or 'power'.
* @param P - The power to use for the 'power' scale type. This parameter is optional and is only used when scaleType is 'power'.
*
* @returns The normalized value.
*
* @throws {Error} If an invalid scaleType is provided.
*/
export function normalizeDataToScaleType(V: number, L: number, U: number, scaleType: string, P?: number): number {
  if (scaleType === 'logarithmic' || scaleType === 'squareroot' || scaleType === 'power') {
    if (V < 0) {
      console.warn(`Logarithmic scale cannot handle non-positive values. Received: ${V}`);
      V = 0.00001;  // or use another approach
    }
    if (V === 0) {
      console.warn(`Value (V) is zero. Setting to 0.00001 to avoid mathematical issues.`);
      V = 0.00001;
    }
    if (L === 0) {
      console.warn(`Lower bound (L) is zero. Setting to 0.00001 to avoid mathematical issues.`);
      L = 0.00001;
    }
    if (U === 0) {
      console.warn(`Upper bound (U) is zero. Setting to 0.00001 to avoid mathematical issues.`);
      U = 0.00001;
    }
  }
 switch(scaleType) {
   case 'linear':
     return linearScale(V, L, U);
   case 'logarithmic':
     return logarithmicScale(V, L, U);
   case 'squareroot':
     return squareRootScale(V, L, U);
   case 'power':
     if (P === undefined) {
       throw new Error('P is required for power scale');
     }
     return powerScale(V, L, U, P);
   default:
     throw new Error(`Invalid scale type: ${scaleType}`);
 }
}

function linearScale(V: number, L: number, U: number): number {
  if (U === L) {
      throw new Error('Upper and lower limits cannot be the same');
  }
  return (V - L) / (U - L);
}

function logarithmicScale(V: number, L: number, U: number): number {
  if (U === L) {
      throw new Error('Upper and lower limits cannot be the same');
  }
  if (V <= 0 || L <= 0 || U <= 0) {
      throw new Error('Values must be greater than 0 for logarithmic scale');
  }
  return (Math.log(V) - Math.log(L)) / (Math.log(U) - Math.log(L));
}

function squareRootScale(V: number, L: number, U: number): number {
  if (U === L) {
      throw new Error('Upper and lower limits cannot be the same');
  }
  if (V < 0 || L < 0 || U < 0) {
      throw new Error('Values must be non-negative for square root scale');
  }
  return (Math.sqrt(V) - Math.sqrt(L)) / (Math.sqrt(U) - Math.sqrt(L));
}

function powerScale(V: number, L: number, U: number, P: number): number {
  if (U === L) {
      throw new Error('Upper and lower limits cannot be the same');
  }
  if (V < 0 || L < 0 || U < 0) {
      throw new Error('Values must be non-negative for power scale');
  }
  return (Math.pow(V, P) - Math.pow(L, P)) / (Math.pow(U, P) - Math.pow(L, P));
}

/**
 * Generates an array of tick values for a gauge, based on the specified scale type.
 * The function automatically calculates a reasonable number of ticks based on the
 * range of values.
 * The number of ticks is approximately 8, but it can be adjusted if necessary to
 * ensure that the tick values are "nice" numbers.
 *
 * @param minValue - The minimum value of the range to be represented on the gauge.
 * @param maxValue - The maximum value of the range to be represented on the gauge.
 * @param scaleType - The type of scale to use. Can be 'linear', 'logarithmic', 'squareRoot', or 'power'.
 * @param P - The power to use for the 'power' scale type. This parameter is optional and is only used when scaleType is 'power'.
 *
 * @returns An array of objects, each with an 'original' property (the original tick value, rounded to a reasonable number of decimal places) and a 'normalized' property (the tick value normalized to the scale).
 *
 * @throws {Error} If scaleType is 'power' but P is not provided.
 * @throws {Error} If an invalid scaleType is provided.
 */
export function generateScaleTypeTicks(minValue: number, maxValue: number, scaleType: string, P?: number): {original: string, normalized: number}[] {
  const numTicks = calculateNiceNumTicks(minValue, maxValue);
  const range = maxValue - minValue;
  const step = range / numTicks;
  let ticks = [];

  // Determine the number of decimal places based on the step size
  let decimalPlaces = (step.toString().split('.')[1] || []).length;

  // Limit the number of decimal places to a maximum of 2
  decimalPlaces = Math.min(decimalPlaces, 2);

  for (let i = 0; i <= numTicks; i++) {
    const originalValue = Number((minValue + (i * step)).toFixed(decimalPlaces)); // Round to the determined decimal places
    let normalizedValue: number;

    if ( scaleType === 'power') {
      normalizedValue = normalizeDataToScaleType(originalValue, minValue, maxValue, scaleType, P);
    } else {
      normalizedValue = normalizeDataToScaleType(originalValue, minValue, maxValue, scaleType);
    }

    ticks.push({original: originalValue.toFixed(decimalPlaces), normalized: normalizedValue});
  }

  return ticks;
}

/**
 * Calculates a reasonable number of ticks for a gauge, based on the range of values.
 * The function aims for approximately 8 ticks, but it can adjust this number if necessary to ensure that the tick values are "nice" numbers.
 *
 * @param minValue - The minimum value of the range to be represented on the gauge.
 * @param maxValue - The maximum value of the range to be represented on the gauge.
 *
 * @returns The calculated number of ticks. This will be approximately 8, but it can be adjusted if necessary.
 */
function calculateNiceNumTicks(minValue: number, maxValue: number): number {
  const range = maxValue - minValue;
  let approxNumTicks = 8; // Aim for approximately 8 ticks
  let roughStep = range / approxNumTicks;

  // Calculate the exponent of the rough step size
  let exponent = Math.floor(Math.log10(roughStep));

  // Calculate the fraction part of the rough step size
  let fraction = roughStep / Math.pow(10, exponent);

  // Round the fraction to the nearest "nice" number
  let niceFraction;
  if (fraction < 1.5) {
    niceFraction = 1;
  } else if (fraction < 3) {
    niceFraction = 2;
  } else if (fraction < 7) {
    niceFraction = 5;
  } else {
    niceFraction = 10;
  }

  // Calculate the actual step size
  const niceStep = niceFraction * Math.pow(10, exponent);

  // Calculate the actual number of ticks
  const numTicks = Math.ceil(range / niceStep);

  // If the actual number of ticks is significantly different from the specified number of ticks,
  // adjust the specified number of ticks to the actual number of ticks
  if (Math.abs(numTicks - approxNumTicks) > approxNumTicks * 0.1) {
    approxNumTicks = numTicks;
  }

  return approxNumTicks;
}
