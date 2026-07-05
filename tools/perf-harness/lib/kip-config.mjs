/*
 * Builders for the KIP localStorage bundle that puts the app in anonymous,
 * local-config mode pointed at our mock Signal K server. Shapes are taken
 * verbatim from src/default-config/* and the widget registry (configVersion 12).
 */
export const SELF_URN = 'vessels.urn:mrn:signalk:uuid:11111111-1111-4111-8111-111111111111';

const DEFAULT_UNITS = {
  Unitless: 'unitless', Speed: 'knots', Flow: 'l/h', Temperature: 'celsius', Length: 'm',
  Volume: 'liter', Current: 'A', Potential: 'V', Charge: 'C', Power: 'W', Energy: 'J',
  Pressure: 'mmHg', 'Fuel Distance': 'nm/l', 'Energy Distance': 'nm/kWh', Density: 'kg/m3',
  Time: 'Hours', 'Angular Velocity': 'deg/min', Angle: 'deg', Frequency: 'Hz', Ratio: 'ratio',
  Resistance: 'ohm',
};

const DEFAULT_NOTIF = {
  disableNotifications: false, menuGrouping: true,
  security: { disableSecurity: true },
  devices: { disableDevices: false, showNormalState: false, showNominalState: false },
  sound: { disableSound: false, muteNormal: true, muteNominal: true, muteWarn: true,
    muteAlert: false, muteAlarm: false, muteEmergency: false },
};

export function appConfig(extra = {}) {
  return {
    configVersion: 12, autoNightMode: false, redNightMode: false, nightModeBrightness: 0.27,
    isRemoteControl: false, instanceName: '', dataSets: [], unitDefaults: DEFAULT_UNITS,
    notificationConfig: DEFAULT_NOTIF, splitShellEnabled: false, splitShellSide: 'left',
    splitShellSwipeDisabled: false, splitShellWidth: 0.5, ...extra,
  };
}

export function connectionConfig(subscribeAll = false) {
  return {
    configVersion: 12, kipUUID: '00000000-0000-4000-8000-000000000001',
    signalKUrl: '__ORIGIN__', // replaced with the served origin at inject time
    proxyEnabled: false, signalKSubscribeAll: subscribeAll, useDeviceToken: false,
    loginName: null, loginPassword: null, useSharedConfig: false, sharedConfigName: 'default',
  };
}

export const themeConfig = { themeName: '' };

// --- widget factories (gridstack node wrapping widget-host2 + widgetProperties) ---
let seq = 0;
const uid = (p) => `${p}-0000-0000-0000-${String(++seq).padStart(12, '0')}`;

function node(w, h, x, y, widgetProperties) {
  const id = widgetProperties.uuid;
  return { x, y, w, h, id, selector: 'widget-host2', input: { widgetProperties } };
}

export function numericWidget({ path = 'self.navigation.speedOverGround', unit = 'knots', sampleTime = 500, miniChart = false } = {}) {
  const uuid = uid('num');
  return (x, y) => node(4, 6, x, y, {
    type: 'widget-numeric', uuid,
    config: {
      displayName: 'N', filterSelfPaths: true,
      paths: { numericPath: { description: 'Numeric Data', path, source: 'default', pathType: 'number', isPathConfigurable: true, convertUnitTo: unit, sampleTime } },
      numDecimal: 1, showMiniChart: miniChart, color: 'blue', enableTimeout: false, dataTimeout: 5, ignoreZones: false,
    },
  });
}

export function radialGaugeWidget({ path = 'self.navigation.speedOverGround', unit = 'knots', sampleTime = 500 } = {}) {
  const uuid = uid('rad');
  return (x, y) => node(4, 6, x, y, {
    type: 'widget-gauge-ng-radial', uuid,
    config: {
      displayName: 'G', filterSelfPaths: true,
      paths: { gaugePath: { description: 'Gauge', path, source: 'default', pathType: 'number', isPathConfigurable: true, convertUnitTo: unit, sampleTime } },
      gauge: { type: 'ngRadial', subType: 'measuring' }, minValue: 0, maxValue: 30, numInt: 2, numDecimal: 1,
      color: 'blue', enableTimeout: false, dataTimeout: 5,
    },
  });
}

export function aisRadarWidget() {
  const uuid = uid('ais');
  return (x, y) => node(24, 24, x, y, {
    type: 'widget-ais-radar', uuid,
    config: {
      filterSelfPaths: false, enableTimeout: false, dataTimeout: 5, color: 'grey',
      ais: {
        filters: { anchoredMoored: false, noCollisionRisk: false, allAton: false, allButSar: false, allVessels: false, vesselTypes: [] },
        viewMode: 'course-up', rangeRings: [1, 3, 6, 12, 24, 48], rangeIndex: '3',
        showCogVectors: true, cogVectorsMinutes: 10, showLostTargets: true, showUnconfirmedTargets: true, showSelf: true,
      },
    },
  });
}

/** Lay out widget factories in a grid and wrap them in one dashboard. */
export function buildDashboards(factories, cols = 24) {
  let x = 0, y = 0, rowH = 0;
  const configuration = factories.map((make) => {
    const probe = make(0, 0);
    const w = probe.w, h = probe.h;
    if (x + w > cols) { x = 0; y += rowH; rowH = 0; }
    const n = make(x, y);
    x += w; rowH = Math.max(rowH, h);
    return n;
  });
  return [{ id: uid('dash'), name: 'Perf', icon: 'dashboard-dashboard', collapseSplitShell: false, configuration }];
}

/** The full localStorage bundle as {key: jsonString}. signalKUrl is patched to `origin` at inject time. */
export function localStorageBundle({ origin, subscribeAll, dashboards, app = appConfig() }) {
  const cc = connectionConfig(subscribeAll);
  cc.signalKUrl = origin;
  return {
    connectionConfig: JSON.stringify(cc),
    appConfig: JSON.stringify(app),
    dashboardsConfig: JSON.stringify(dashboards),
    themeConfig: JSON.stringify(themeConfig),
  };
}
