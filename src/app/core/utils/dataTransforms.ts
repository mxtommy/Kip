import { TScaleType } from "../interfaces/signalk-interfaces";

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
export function normalizeDataToScaleType(V: number, L: number, U: number, scaleType: TScaleType, P?: number): number {
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

/**
 * Scales a given value within a specified range to a normalized range between 0 and 1.
 *
 * @param {number} V - The value to be scaled.
 * @param {number} L - The lower limit of the range.
 * @param {number} U - The upper limit of the range.
 * @returns {number} The scaled value, normalized to a range between 0 and 1.
 * @throws {Error} Throws an error if the upper limit and lower limit are the same (to prevent division by zero).
 */
function linearScale(V: number, L: number, U: number): number {
  if (U === L) {
      throw new Error('Upper and lower limits cannot be the same');
  }
  return (V - L) / (U - L);
}

/**
 * Scales a given value within a specified range to a normalized range between 0 and 1 using a logarithmic scale.
 *
 * @param {number} V - The value to be scaled.
 * @param {number} L - The lower limit of the range.
 * @param {number} U - The upper limit of the range.
 * @returns {number} The scaled value, normalized to a range between 0 and 1.
 * @throws {Error} Throws an error if the upper limit and lower limit are the same (to prevent division by zero).
 * @throws {Error} Throws an error if any of the values are less than or equal to zero (as logarithm of non-positive numbers is undefined).
 */
function logarithmicScale(V: number, L: number, U: number): number {
  if (U === L) {
      throw new Error('Upper and lower limits cannot be the same');
  }
  if (V <= 0 || L <= 0 || U <= 0) {
      throw new Error('Values must be greater than 0 for logarithmic scale');
  }
  return (Math.log(V) - Math.log(L)) / (Math.log(U) - Math.log(L));
}

/**
 * Scales a given value within a specified range to a normalized range between 0 and 1 using a logarithmic scale.
 *
 * @param {number} V - The value to be scaled.
 * @param {number} L - The lower limit of the range.
 * @param {number} U - The upper limit of the range.
 * @returns {number} The scaled value, normalized to a range between 0 and 1.
 * @throws {Error} Throws an error if the upper limit and lower limit are the same (to prevent division by zero).
 * @throws {Error} Throws an error if any of the values are less than or equal to zero (as logarithm of non-positive numbers is undefined).
 */
function squareRootScale(V: number, L: number, U: number): number {
  if (U === L) {
      throw new Error('Upper and lower limits cannot be the same');
  }
  if (V < 0 || L < 0 || U < 0) {
      throw new Error('Values must be non-negative for square root scale');
  }
  return (Math.sqrt(V) - Math.sqrt(L)) / (Math.sqrt(U) - Math.sqrt(L));
}

/**
 * Scales a given value within a specified range to a normalized range between 0 and 1 using a power scale.
 *
 * @param {number} V - The value to be scaled.
 * @param {number} L - The lower limit of the range.
 * @param {number} U - The upper limit of the range.
 * @param {number} P - The power to which the values are raised.
 * @returns {number} The scaled value, normalized to a range between 0 and 1.
 * @throws {Error} Throws an error if the upper limit and lower limit are the same (to prevent division by zero).
 * @throws {Error} Throws an error if any of the values are negative (as power of negative numbers can result in complex numbers).
 */
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
 * Converts a radian value to a degree value.
 *
 * The input is expected to be in the range of -π to +π.
 * The output will be in the range of 0 to 360, where 0 radian is equivalent to 0 degree.
 *
 * @param {number} radian - The radian value to convert. Should be in the range -π to +π.
 * @returns {number} The converted degree value, in the range 0 to 360.
 */
export function convertSplitRadianToDegree(radian: number): number {
  let degree = radian * (180 / Math.PI);
  if (degree < 0) {
    degree = 360 + degree;
  }
  return degree;
}
