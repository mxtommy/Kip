import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import { FormGroupDirective, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { ElectricalFamilySetupComponent } from './electrical-family-setup.component';
import { PathDiscoveryService } from '../../core/services/path-discovery.service';
import { DataService } from '../../core/services/data.service';
import type { IPathUpdateEvent, ISkPathData } from '../../core/interfaces/app-interfaces';

interface FamilyCase {
  formGroupName: 'charger' | 'inverter' | 'alternator' | 'ac';
  setupLabel: string;
  discoveryId: string;
  discoveryPattern: string;
  familyRegex: string;
  pathPrefix: string;
  path: string;
  deviceId: string;
  firstSource: string;
  secondSource: string;
}

describe('ElectricalFamilySetupComponent', () => {
  let fixture: ComponentFixture<ElectricalFamilySetupComponent>;
  let component: ElectricalFamilySetupComponent;
  let updates$: Subject<IPathUpdateEvent>;

  const discoveryChanges$ = new Subject<{ type: 'add' | 'remove'; path: string }>();
  const activePaths = new Set<string>();
  const currentFamily = { value: null as FamilyCase | null };
  const pathObject: ISkPathData = {
    path: '',
    pathValue: 48,
    pathTimestamp: '2026-04-02T00:00:00.000Z',
    type: 'number',
    state: 'normal',
    defaultSource: '',
    sources: {}
  };

  const familyCases: FamilyCase[] = [
    {
      formGroupName: 'charger',
      setupLabel: 'Charger',
      discoveryId: 'electrical-chargers',
      discoveryPattern: 'self.electrical.charger*',
      familyRegex: 'self\\.electrical\\.chargers?\\.([^.]+)(?:\\.|$)',
      pathPrefix: 'electrical.charger',
      path: 'self.electrical.chargers.house.dc.voltage',
      deviceId: 'house',
      firstSource: 'venus.1',
      secondSource: 'n2k.42'
    },
    {
      formGroupName: 'inverter',
      setupLabel: 'Inverter',
      discoveryId: 'electrical-inverters',
      discoveryPattern: 'self.electrical.inverter*',
      familyRegex: 'self\\.electrical\\.inverters?\\.([^.]+)(?:\\.|$)',
      pathPrefix: 'electrical.inverter',
      path: 'self.electrical.inverters.house.dc.voltage',
      deviceId: 'house',
      firstSource: 'venus.1',
      secondSource: 'n2k.42'
    },
    {
      formGroupName: 'alternator',
      setupLabel: 'Alternator',
      discoveryId: 'electrical-alternators',
      discoveryPattern: 'self.electrical.alternator*',
      familyRegex: 'self\\.electrical\\.alternators?\\.([^.]+)(?:\\.|$)',
      pathPrefix: 'electrical.alternator',
      path: 'self.electrical.alternators.main.output.voltage',
      deviceId: 'main',
      firstSource: 'smartshunt.1',
      secondSource: 'n2k.18'
    },
    {
      formGroupName: 'ac',
      setupLabel: 'AC',
      discoveryId: 'electrical-ac',
      discoveryPattern: 'self.electrical.ac*',
      familyRegex: 'self\\.electrical\\.ac\\.([^.]+)(?:\\.|$)',
      pathPrefix: 'electrical.ac.',
      path: 'self.electrical.ac.grid.voltage',
      deviceId: 'grid',
      firstSource: 'venus.1',
      secondSource: 'n2k.73'
    }
  ];

  const discoveryMock = {
    register: vi.fn(() => 'token-inverter'),
    unregister: vi.fn(),
    changes: vi.fn(() => discoveryChanges$.asObservable()),
    activePaths: vi.fn(() => activePaths)
  };

  const defaultGetPathObject = (path?: string) => {
    const next = structuredClone(pathObject);
    if (typeof path === 'string') {
      next.path = path;
    }
    return next;
  };

  const dataMock = {
    getCachedPaths: vi.fn(() => Array.from(activePaths)),
    getPathObject: vi.fn(defaultGetPathObject),
    observePathUpdates: vi.fn(() => updates$.asObservable())
  };

  beforeEach(async () => {
    updates$ = new Subject<IPathUpdateEvent>();
    currentFamily.value = familyCases[0];
    activePaths.clear();
    activePaths.add(currentFamily.value.path);
    pathObject.path = currentFamily.value.path;
    pathObject.defaultSource = currentFamily.value.firstSource;
    pathObject.sources = {
      [currentFamily.value.firstSource]: {
        sourceTimestamp: '2026-04-02T00:00:00.000Z',
        sourceValue: 48
      }
    };
    dataMock.getPathObject.mockImplementation(defaultGetPathObject);

    await TestBed.configureTestingModule({
      imports: [ElectricalFamilySetupComponent],
      providers: [
        {
          provide: FormGroupDirective,
          useFactory: () => {
            const root = new UntypedFormGroup({
              charger: new UntypedFormGroup({
                trackedDevices: new UntypedFormControl([])
              }),
              inverter: new UntypedFormGroup({
                trackedDevices: new UntypedFormControl([])
              }),
              alternator: new UntypedFormGroup({
                trackedDevices: new UntypedFormControl([])
              }),
              ac: new UntypedFormGroup({
                trackedDevices: new UntypedFormControl([])
              })
            });

            return { control: root } as Partial<FormGroupDirective> as FormGroupDirective;
          }
        },
        { provide: PathDiscoveryService, useValue: discoveryMock },
        { provide: DataService, useValue: dataMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ElectricalFamilySetupComponent);
    component = fixture.componentInstance;
  });

  const configureFamily = (familyCase: FamilyCase) => {
    currentFamily.value = familyCase;
    activePaths.clear();
    activePaths.add(familyCase.path);
    pathObject.path = familyCase.path;
    pathObject.defaultSource = familyCase.firstSource;
    pathObject.sources = {
      [familyCase.firstSource]: {
        sourceTimestamp: '2026-04-02T00:00:00.000Z',
        sourceValue: 48
      }
    };

    fixture.componentRef.setInput('formGroupName', familyCase.formGroupName);
    fixture.componentRef.setInput('setupLabel', familyCase.setupLabel);
    fixture.componentRef.setInput('discoveryId', familyCase.discoveryId);
    fixture.componentRef.setInput('discoveryPattern', familyCase.discoveryPattern);
    fixture.componentRef.setInput('familyRegex', familyCase.familyRegex);
    fixture.componentRef.setInput('pathPrefix', familyCase.pathPrefix);
    fixture.detectChanges();
  };

  familyCases.forEach(familyCase => {
    it(`refreshes ${familyCase.formGroupName} tracked options when a second source updates an existing path`, () => {
      configureFamily(familyCase);

      const initialDevices = (component as unknown as { discoveredTrackedDevices: () => { key: string }[] }).discoveredTrackedDevices();
      expect(initialDevices.map(device => device.key)).toEqual([`${familyCase.deviceId}||${familyCase.firstSource}`]);

      pathObject.sources = {
        [familyCase.firstSource]: {
          sourceTimestamp: '2026-04-02T00:00:00.000Z',
          sourceValue: 48
        },
        [familyCase.secondSource]: {
          sourceTimestamp: '2026-04-02T00:00:01.000Z',
          sourceValue: 49
        }
      };

      updates$.next({
        fullPath: familyCase.path,
        kind: 'data',
        update: {
          context: 'self',
          path: familyCase.path.replace(/^self\./, ''),
          source: familyCase.secondSource,
          timestamp: '2026-04-02T00:00:01.000Z',
          value: 49
        }
      });

      const refreshedDevices = (component as unknown as { discoveredTrackedDevices: () => { key: string }[] }).discoveredTrackedDevices();
      expect(refreshedDevices.map(device => device.key)).toEqual([
        `${familyCase.deviceId}||${familyCase.secondSource}`,
        `${familyCase.deviceId}||${familyCase.firstSource}`
      ].sort((left, right) => left.localeCompare(right)));
    });

    it(`does not add default for ${familyCase.formGroupName} when the same id has an explicit source on another path`, () => {
      activePaths.clear();
      const rootOnlyPath = familyCase.path.replace(/\.[^.]+$/, '');
      activePaths.add(rootOnlyPath);
      activePaths.add(familyCase.path);
      pathObject.path = familyCase.path;
      pathObject.defaultSource = familyCase.firstSource;

      dataMock.getPathObject.mockImplementation((path: string) => {
        if (path === rootOnlyPath) {
          return {
            ...structuredClone(pathObject),
            path,
            sources: {}
          };
        }

        return {
          ...structuredClone(pathObject),
          path,
          sources: {
            [familyCase.firstSource]: {
              sourceTimestamp: '2026-04-02T00:00:00.000Z',
              sourceValue: 48
            }
          }
        };
      });

      configureFamily(familyCase);

      const discoveredDevices = (component as unknown as { discoveredTrackedDevices: () => { key: string }[] }).discoveredTrackedDevices();
      expect(discoveredDevices.map(device => device.key)).toEqual([`${familyCase.deviceId}||${familyCase.firstSource}`]);
    });
  });
});
