import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of, Subject } from 'rxjs';
import { MatIconRegistry } from '@angular/material/icon';
import { WidgetBmsComponent } from './widget-bms.component';
import { DataService, IPathUpdateWithPath } from '../../core/services/data.service';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { UnitsService } from '../../core/services/units.service';
import { States } from '../../core/interfaces/signalk-interfaces';
import type { ITheme } from '../../core/services/app-service';

describe('WidgetBmsComponent', () => {
    let fixture: ComponentFixture<WidgetBmsComponent>;
    let component: WidgetBmsComponent;
    let liveSubject: Subject<IPathUpdateWithPath>;

    const runtimeOptions = {
        color: 'contrast',
        ignoreZones: false,
        bms: {
            trackedDevices: [] as { id: string; source: string; key: string }[],
            banks: [] as unknown[],
            cardMode: {
                displayMode: 'full' as 'full' | 'compact',
                metrics: [] as string[]
            }
        }
    };

    const dataServiceMock = {
        subscribePathTreeWithInitial: vi.fn()
    };

    const runtimeMock = {
        options: () => runtimeOptions
    };

    const unitsMock = {
        convertToUnit: (_unit: string, value: unknown) => value,
        getDefaults: () => ({ Temperature: 'celsius' })
    };

    const iconRegistryMock = {
        addSvgIconSetLiteral: () => iconRegistryMock,
        addSvgIconSetInNamespace: () => iconRegistryMock,
        addSvgIconLiteral: () => iconRegistryMock,
        getNamedSvgIcon: () => of(document.createElementNS('http://www.w3.org/2000/svg', 'svg'))
    };

    const themeMock = {
        contrast: '#fff',
        dim: '#ccc',
        dimmer: '#999',
        zoneNominal: '#00ff00',
        zoneWarn: '#ffaa00',
        zoneAlarm: '#ff0000',
        zoneAlert: '#ff00ff'
    } as unknown as ITheme;

    const makeUpdate = (path: string, value: number | string | null): IPathUpdateWithPath => ({
        path,
        update: {
            data: { value, timestamp: new Date('2026-01-01T00:00:00.000Z') },
            state: States.Normal
        }
    });

    beforeEach(async () => {
        liveSubject = new Subject<IPathUpdateWithPath>();
        runtimeOptions.color = 'contrast';
        runtimeOptions.ignoreZones = false;
        runtimeOptions.bms.trackedDevices = [];
        runtimeOptions.bms.banks = [];
        runtimeOptions.bms.cardMode.displayMode = 'full';
        runtimeOptions.bms.cardMode.metrics = [];

        dataServiceMock.subscribePathTreeWithInitial.mockReturnValue({
            initial: [
                makeUpdate('self.electrical.batteries.bat1.voltage', 12.4),
                makeUpdate('self.electrical.batteries.bat2.voltage', 12.6)
            ],
            live$: liveSubject.asObservable()
        });

        await TestBed.configureTestingModule({
            imports: [WidgetBmsComponent],
            providers: [
                { provide: DataService, useValue: dataServiceMock },
                { provide: WidgetRuntimeDirective, useValue: runtimeMock },
                { provide: UnitsService, useValue: unitsMock },
                { provide: MatIconRegistry, useValue: iconRegistryMock }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(WidgetBmsComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('id', 'w-bms-1');
        fixture.componentRef.setInput('type', 'widget-bms');
        fixture.componentRef.setInput('theme', themeMock);
    });

    it('flushes all initial cached paths once, then batches live updates', async () => {
        vi.useFakeTimers();
        try {
            fixture.detectChanges();

            expect(dataServiceMock.subscribePathTreeWithInitial).toHaveBeenCalledWith('self.electrical.batteries.*');
            expect((component as unknown as {
                discoveredBatteryIds: () => string[];
            }).discoveredBatteryIds()).toEqual(['bat1', 'bat2']);

            const flushSpy = vi.spyOn(component as unknown as {
                flushPendingPathUpdates: () => void;
            }, 'flushPendingPathUpdates');

            flushSpy.mockClear();

            liveSubject.next(makeUpdate('self.electrical.batteries.bat3.voltage', 12.7));

            expect(flushSpy).not.toHaveBeenCalled();
            await vi.advanceTimersByTimeAsync(499);
            expect(flushSpy).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(1);
            expect(vi.mocked(flushSpy).mock.calls.length).toBe(1);
            expect((component as unknown as {
                discoveredBatteryIds: () => string[];
            }).discoveredBatteryIds()).toEqual(['bat1', 'bat2', 'bat3']);
        } finally {
            vi.useRealTimers();
        }
    });

    it('uses host renderMode input over widget card mode', () => {
        runtimeOptions.bms.cardMode.displayMode = 'full';
        runtimeOptions.bms.cardMode.metrics = ['voltage'];

        fixture.detectChanges();
        fixture.componentRef.setInput('renderMode', 'compact');
        fixture.detectChanges();

        const compact = (component as unknown as { isCompactCardMode: () => boolean }).isCompactCardMode();
        expect(compact).toBe(true);
    });

    it('uses compact layout for unassigned batteries when compact mode is active', () => {
        fixture.detectChanges();

        const internals = component as unknown as {
            bankSummaries: () => unknown[];
            visibleBatteries: () => unknown[];
            bankDisplayModels: () => Record<string, unknown>;
            batteryDisplayModels: () => Record<string, unknown>;
            buildRenderLayout: (banks: unknown[], batteries: unknown[], bankDisplayModels: Record<string, unknown>, batteryDisplayModels: Record<string, unknown>, compactMode: boolean) => {
                unassignedBatteries: { compact: boolean; scale: number }[];
                contentHeight: number;
            };
        };

        const fullLayout = internals.buildRenderLayout(
            internals.bankSummaries(),
            internals.visibleBatteries(),
            internals.bankDisplayModels(),
            internals.batteryDisplayModels(),
            false
        );

        fixture.componentRef.setInput('renderMode', 'compact');
        fixture.detectChanges();

        const compactLayout = internals.buildRenderLayout(
            internals.bankSummaries(),
            internals.visibleBatteries(),
            internals.bankDisplayModels(),
            internals.batteryDisplayModels(),
            true
        );

        expect(compactLayout.unassignedBatteries).toHaveLength(2);
        expect(compactLayout.unassignedBatteries.every(item => item.compact)).toBe(true);
        expect(compactLayout.unassignedBatteries.every(item => item.scale < 1)).toBe(true);
        expect(compactLayout.contentHeight).toBeLessThan(fullLayout.contentHeight);
    });

    it('reduces single-row bank height in compact mode', () => {
        runtimeOptions.bms.banks = [{
            id: 'bank-1',
            name: 'House Bank',
            batteryIds: ['bat1'],
            connectionMode: 'parallel'
        }];

        fixture.detectChanges();

        const internals = component as unknown as {
            bankSummaries: () => unknown[];
            visibleBatteries: () => unknown[];
            bankDisplayModels: () => Record<string, unknown>;
            batteryDisplayModels: () => Record<string, unknown>;
            buildRenderLayout: (banks: unknown[], batteries: unknown[], bankDisplayModels: Record<string, unknown>, batteryDisplayModels: Record<string, unknown>, compactMode: boolean) => {
                banks: { height: number }[];
            };
        };

        const fullLayout = internals.buildRenderLayout(
            internals.bankSummaries(),
            internals.visibleBatteries(),
            internals.bankDisplayModels(),
            internals.batteryDisplayModels(),
            false
        );

        fixture.componentRef.setInput('renderMode', 'compact');
        fixture.detectChanges();

        const compactLayout = internals.buildRenderLayout(
            internals.bankSummaries(),
            internals.visibleBatteries(),
            internals.bankDisplayModels(),
            internals.batteryDisplayModels(),
            true
        );

        expect(compactLayout.banks[0]?.height ?? 0).toBeLessThanOrEqual(fullLayout.banks[0]?.height ?? 0);
    });
});
