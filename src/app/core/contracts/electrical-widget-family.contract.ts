export type ElectricalWidgetSelector =
  | 'widget-bms'
  | 'widget-solar-charger'
  | 'widget-charger'
  | 'widget-inverter'
  | 'widget-alternator'
  | 'widget-ac';

export type ElectricalFamilyKey =
  | 'batteries'
  | 'solar'
  | 'chargers'
  | 'inverters'
  | 'alternators'
  | 'ac';

export type ElectricalTemplateExpansionMode =
  | 'bms-battery-tree'
  | 'solar-tree'
  | 'charger-tree'
  | 'inverter-tree'
  | 'alternator-tree'
  | 'ac-tree';

export interface IElectricalWidgetFamilyDescriptor {
  selector: ElectricalWidgetSelector;
  familyKey: ElectricalFamilyKey;
  selfRootPath: `self.electrical.${ElectricalFamilyKey}`;
  displayTitle: string;
  templateExpansionMode: ElectricalTemplateExpansionMode | null;
}

export const ELECTRICAL_WIDGET_FAMILY_DESCRIPTORS: Readonly<Record<ElectricalWidgetSelector, IElectricalWidgetFamilyDescriptor>> = {
  'widget-bms': {
    selector: 'widget-bms',
    familyKey: 'batteries',
    selfRootPath: 'self.electrical.batteries',
    displayTitle: 'Battery Monitor',
    templateExpansionMode: 'bms-battery-tree'
  },
  'widget-solar-charger': {
    selector: 'widget-solar-charger',
    familyKey: 'solar',
    selfRootPath: 'self.electrical.solar',
    displayTitle: 'Solar Charger',
    templateExpansionMode: 'solar-tree'
  },
  'widget-charger': {
    selector: 'widget-charger',
    familyKey: 'chargers',
    selfRootPath: 'self.electrical.chargers',
    displayTitle: 'Charger',
    templateExpansionMode: 'charger-tree'
  },
  'widget-inverter': {
    selector: 'widget-inverter',
    familyKey: 'inverters',
    selfRootPath: 'self.electrical.inverters',
    displayTitle: 'Inverter',
    templateExpansionMode: 'inverter-tree'
  },
  'widget-alternator': {
    selector: 'widget-alternator',
    familyKey: 'alternators',
    selfRootPath: 'self.electrical.alternators',
    displayTitle: 'Alternator',
    templateExpansionMode: 'alternator-tree'
  },
  'widget-ac': {
    selector: 'widget-ac',
    familyKey: 'ac',
    selfRootPath: 'self.electrical.ac',
    displayTitle: 'AC',
    templateExpansionMode: 'ac-tree'
  }
};

export function isElectricalWidgetSelector(value: string | null | undefined): value is ElectricalWidgetSelector {
  if (!value) {
    return false;
  }

  return Object.hasOwn(ELECTRICAL_WIDGET_FAMILY_DESCRIPTORS, value);
}

export function getElectricalWidgetFamilyDescriptor(selector: string | null | undefined): IElectricalWidgetFamilyDescriptor | null {
  if (!isElectricalWidgetSelector(selector)) {
    return null;
  }

  return ELECTRICAL_WIDGET_FAMILY_DESCRIPTORS[selector];
}
