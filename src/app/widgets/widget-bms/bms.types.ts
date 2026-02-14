export interface BmsBankConfig {
  /**
   * Unique identifier for the bank.
   *
   * @example
   * const bank: BmsBankConfig = { id: 'bank-1', name: 'House', batteryIds: [] };
   */
  id: string;
  /**
   * Human-readable name of the bank.
   *
   * @example
   * const bank: BmsBankConfig = { id: 'bank-1', name: 'House', batteryIds: [] };
   */
  name: string;
  /**
   * Battery ids assigned to this bank.
   *
   * @example
   * const bank: BmsBankConfig = { id: 'bank-1', name: 'House', batteryIds: ['1', '2'] };
   */
  batteryIds: string[];
}

export interface BmsWidgetConfig {
  /**
   * Battery ids the widget should track and display.
   *
   * @example
   * const cfg: BmsWidgetConfig = { trackedBatteryIds: ['1'], banks: [] };
   */
  trackedBatteryIds: string[];
  /**
   * Bank definitions used to aggregate multiple batteries.
   *
   * @example
   * const cfg: BmsWidgetConfig = { trackedBatteryIds: ['1'], banks: [{ id: 'bank-1', name: 'House', batteryIds: ['1'] }] };
   */
  banks: BmsBankConfig[];
}

export interface BmsBatterySnapshot {
  /**
   * Battery instance id parsed from the Signal K path.
   *
   * @example
   * const battery: BmsBatterySnapshot = { id: '1' };
   */
  id: string;
  /**
   * Device name reported by Signal K.
   *
   * @example
   * const battery: BmsBatterySnapshot = { id: '1', name: 'HouseBattery' };
   */
  name?: string | null;
  /**
   * Installation location reported by Signal K.
   *
   * @example
   * const battery: BmsBatterySnapshot = { id: '1', location: 'Engine Bay' };
   */
  location?: string | null;
  /**
   * Voltage in volts.
   *
   * @example
   * const battery: BmsBatterySnapshot = { id: '1', voltage: 12.7 };
   */
  voltage?: number | null;
  /**
   * Current in amps (positive = discharge, negative = charge).
   *
   * @example
   * const battery: BmsBatterySnapshot = { id: '1', current: -4.2 };
   */
  current?: number | null;
  /**
   * Computed power in watts (voltage * current).
   *
   * @example
   * const battery: BmsBatterySnapshot = { id: '1', power: -53.3 };
   */
  power?: number | null;
  /**
   * Temperature in kelvin.
   *
   * @example
   * const battery: BmsBatterySnapshot = { id: '1', temperature: 300 };
   */
  temperature?: number | null;
  /**
   * Capacity remaining in joules.
   *
   * @example
   * const battery: BmsBatterySnapshot = { id: '1', capacityRemaining: 450000 };
   */
  capacityRemaining?: number | null;
  /**
   * Nominal capacity in joules.
   *
   * @example
   * const battery: BmsBatterySnapshot = { id: '1', capacityNominal: 500000 };
   */
  capacityNominal?: number | null;
  /**
   * Actual capacity in joules.
   *
   * @example
   * const battery: BmsBatterySnapshot = { id: '1', capacityActual: 480000 };
   */
  capacityActual?: number | null;
  /**
   * State of charge as a ratio (0-1).
   *
   * @example
   * const battery: BmsBatterySnapshot = { id: '1', stateOfCharge: 0.77 };
   */
  stateOfCharge?: number | null;
  /**
   * Time remaining in seconds.
   *
   * @example
   * const battery: BmsBatterySnapshot = { id: '1', timeRemaining: 7200 };
   */
  timeRemaining?: number | null;
}

export interface BmsBankSummary {
  /**
   * Bank identifier.
   *
   * @example
   * const summary: BmsBankSummary = { id: 'bank-1', name: 'House', batteryIds: [] };
   */
  id: string;
  /**
   * Bank display name.
   *
   * @example
   * const summary: BmsBankSummary = { id: 'bank-1', name: 'House', batteryIds: [] };
   */
  name: string;
  /**
   * Battery ids that belong to the bank.
   *
   * @example
   * const summary: BmsBankSummary = { id: 'bank-1', name: 'House', batteryIds: ['1'] };
   */
  batteryIds: string[];
  /**
   * Summed current in amps across batteries.
   *
   * @example
   * const summary: BmsBankSummary = { id: 'bank-1', name: 'House', batteryIds: ['1'], totalCurrent: -12.4 };
   */
  totalCurrent: number | null;
  /**
   * Summed power in watts across batteries.
   *
   * @example
   * const summary: BmsBankSummary = { id: 'bank-1', name: 'House', batteryIds: ['1'], totalPower: -158.2 };
   */
  totalPower: number | null;
  /**
   * Average state of charge ratio (0-1) across batteries.
   *
   * @example
   * const summary: BmsBankSummary = { id: 'bank-1', name: 'House', batteryIds: ['1'], avgSoc: 0.78 };
   */
  avgSoc: number | null;
  /**
   * Sum of remaining capacity in joules across batteries.
   *
   * @example
   * const summary: BmsBankSummary = { id: 'bank-1', name: 'House', batteryIds: ['1'], remainingCapacity: 450000 };
   */
  remainingCapacity: number | null;
  /**
   * Minimum time remaining across batteries in seconds.
   *
   * @example
   * const summary: BmsBankSummary = { id: 'bank-1', name: 'House', batteryIds: ['1'], timeRemaining: 3600 };
   */
  timeRemaining: number | null;
}
