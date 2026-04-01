import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DataService, IPathUpdateWithPath } from '../../core/services/data.service';
import { UnitsService } from '../../core/services/units.service';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import type { ITheme } from '../../core/services/app-service';
import type { ElectricalGroupConfig, IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { resolveZoneAwareColor } from '../../core/utils/themeColors.utils';
import { States, TState } from '../../core/interfaces/signalk-interfaces';

interface IElectricalUnitSnapshot {
  id: string;
  name?: string | null;
  location?: string | null;
  associatedBus?: string | null;
  voltage?: number | null;
  current?: number | null;
  power?: number | null;
  temperature?: number | null;
  frequency?: number | null;
  line1Voltage?: number | null;
  line1Current?: number | null;
  line1Frequency?: number | null;
  line2Voltage?: number | null;
  line2Current?: number | null;
  line2Frequency?: number | null;
  line3Voltage?: number | null;
  line3Current?: number | null;
  line3Frequency?: number | null;
  state?: TState | null;
}

@Component({
  selector: 'electrical-family-widget',
  templateUrl: './widget-electrical-family.component.html',
  styleUrl: './widget-electrical-family.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WidgetElectricalFamilyComponent {
  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme | null>();
  public familyKey = input.required<'chargers' | 'inverters' | 'alternators' | 'ac'>();
  public configKey = input.required<'charger' | 'inverter' | 'alternator' | 'ac'>();
  public title = input.required<string>();

  private readonly runtime = inject(WidgetRuntimeDirective);
  private readonly data = inject(DataService);
  private readonly units = inject(UnitsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly discoveredIds = signal<string[]>([]);
  protected readonly trackedIds = signal<string[]>([]);
  protected readonly groups = signal<ElectricalGroupConfig[]>([]);
  protected readonly unitsById = signal<Record<string, IElectricalUnitSnapshot>>({});

  protected readonly visibleIds = computed(() => {
    const tracked = this.trackedIds();
    if (tracked.length) {
      return tracked;
    }

    return this.discoveredIds();
  });

  protected readonly visibleUnits = computed(() => {
    const ids = this.visibleIds();
    const map = this.unitsById();
    return ids.map(id => map[id]).filter((unit): unit is IElectricalUnitSnapshot => !!unit);
  });

  protected readonly hasUnits = computed(() => this.visibleUnits().length > 0);

  constructor() {
    const treeSubscription = this.data.subscribePathTreeWithInitial(this.buildRootPattern());

    if (treeSubscription.initial.length) {
      treeSubscription.initial.forEach(update => this.handlePathUpdate(update));
    }

    treeSubscription.live$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(update => this.handlePathUpdate(update));

    effect(() => {
      const cfg = this.runtime.options();
      if (!cfg) {
        return;
      }

      untracked(() => this.applyConfig(cfg));
    });
  }

  protected asVoltage(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
      return '-';
    }

    return this.asNumber(value, 'V');
  }

  protected asCurrent(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
      return '-';
    }

    return this.asNumber(value, 'A');
  }

  protected asPower(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
      return '-';
    }

    return this.asNumber(value, 'W');
  }

  protected asFrequency(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
      return '-';
    }

    return this.asNumber(value, 'Hz');
  }

  protected asTemperature(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
      return '-';
    }

    return this.asNumber(value, this.units.getDefaults().Temperature);
  }

  protected resolveStateColor(state: TState | null | undefined): string {
    return resolveZoneAwareColor(state ?? null, 'var(--kip-contrast-color)', this.theme(), false);
  }

  private buildRootPattern(): string {
    return `self.electrical.${this.familyKey()}.*`;
  }

  private applyConfig(cfg: IWidgetSvcConfig): void {
    const familyConfig = (cfg as unknown as Record<string, unknown>)[this.configKey()] as {
      trackedIds?: unknown;
      groups?: unknown;
    } | undefined;

    this.trackedIds.set(this.normalizeStringArray(familyConfig?.trackedIds));
    this.groups.set(this.normalizeGroups(familyConfig?.groups));
  }

  private normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const next = new Set<string>();
    value.forEach(item => {
      if (typeof item !== 'string') {
        return;
      }

      const normalized = item.trim();
      if (normalized.length > 0) {
        next.add(normalized);
      }
    });

    return [...next].sort((left, right) => left.localeCompare(right));
  }

  private normalizeGroups(value: unknown): ElectricalGroupConfig[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const mapped = value
      .map(group => {
        const id = this.normalizeOptionalString((group as { id?: unknown }).id);
        const name = this.normalizeOptionalString((group as { name?: unknown }).name);
        const memberIds = this.normalizeStringArray((group as { memberIds?: unknown }).memberIds);

        if (!id || !name) {
          return null;
        }

        return {
          id,
          name,
          memberIds,
          connectionMode: (group as { connectionMode?: unknown }).connectionMode === 'series' ? 'series' : 'parallel'
        } satisfies ElectricalGroupConfig;
      })
      .filter(group => group !== null);

    return mapped as ElectricalGroupConfig[];
  }

  private normalizeOptionalString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private handlePathUpdate(update: IPathUpdateWithPath): void {
    const parsed = this.parsePath(update.path);
    if (!parsed) {
      return;
    }

    const value = update.update?.data?.value;
    const state = update.update?.state ?? null;

    this.trackDiscoveredId(parsed.id);
    this.unitsById.update(current => {
      const existing = current[parsed.id] ?? { id: parsed.id };
      const next = { ...existing };
      const changed = this.applyValue(next, parsed.key, value, state);

      if (!changed) {
        return current;
      }

      return {
        ...current,
        [parsed.id]: next
      };
    });
  }

  private parsePath(path: string): { id: string; key: string } | null {
    const regex = new RegExp(`^self\\.electrical\\.${this.familyKey()}\\.([^.]+)\\.(.+)$`);
    const match = regex.exec(path);
    if (!match) {
      return null;
    }

    return {
      id: match[1],
      key: match[2]
    };
  }

  private trackDiscoveredId(id: string): void {
    const ids = this.discoveredIds();
    if (ids.includes(id)) {
      return;
    }

    this.discoveredIds.set([...ids, id].sort((left, right) => left.localeCompare(right)));
  }

  private applyValue(snapshot: IElectricalUnitSnapshot, key: string, value: unknown, state: TState | null): boolean {
    switch (key) {
      case 'name': return this.setValue(snapshot, 'name', this.toString(value), state);
      case 'location': return this.setValue(snapshot, 'location', this.toString(value), state);
      case 'associatedBus': return this.setValue(snapshot, 'associatedBus', this.toString(value), state);
      case 'voltage': return this.setValue(snapshot, 'voltage', this.toNumber(value, 'V'), state);
      case 'current': return this.setValue(snapshot, 'current', this.toNumber(value, 'A'), state);
      case 'power': return this.setValue(snapshot, 'power', this.toNumber(value, 'W'), state);
      case 'temperature': return this.setValue(snapshot, 'temperature', this.toNumber(value, this.units.getDefaults().Temperature), state);
      case 'frequency': return this.setValue(snapshot, 'frequency', this.toNumber(value, 'Hz'), state);
      case 'line1.voltage': return this.setValue(snapshot, 'line1Voltage', this.toNumber(value, 'V'), state);
      case 'line1.current': return this.setValue(snapshot, 'line1Current', this.toNumber(value, 'A'), state);
      case 'line1.frequency': return this.setValue(snapshot, 'line1Frequency', this.toNumber(value, 'Hz'), state);
      case 'line2.voltage': return this.setValue(snapshot, 'line2Voltage', this.toNumber(value, 'V'), state);
      case 'line2.current': return this.setValue(snapshot, 'line2Current', this.toNumber(value, 'A'), state);
      case 'line2.frequency': return this.setValue(snapshot, 'line2Frequency', this.toNumber(value, 'Hz'), state);
      case 'line3.voltage': return this.setValue(snapshot, 'line3Voltage', this.toNumber(value, 'V'), state);
      case 'line3.current': return this.setValue(snapshot, 'line3Current', this.toNumber(value, 'A'), state);
      case 'line3.frequency': return this.setValue(snapshot, 'line3Frequency', this.toNumber(value, 'Hz'), state);
      default:
        return false;
    }
  }

  private setValue<K extends keyof IElectricalUnitSnapshot>(
    target: IElectricalUnitSnapshot,
    key: K,
    nextValue: IElectricalUnitSnapshot[K],
    state: TState | null
  ): boolean {
    const stateChanged = !Object.is(target.state ?? null, state ?? null);
    if (Object.is(target[key], nextValue) && !stateChanged) {
      return false;
    }

    target[key] = nextValue;
    target.state = state;
    return true;
  }

  private toString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
  }

  private toNumber(value: unknown, unitHint: string): number | null {
    if (value == null || typeof value === 'boolean') {
      return null;
    }

    const rawNumber = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(rawNumber)) {
      return null;
    }

    const converted = this.units.convertToUnit(unitHint, rawNumber);
    return Number.isFinite(converted) ? converted : rawNumber;
  }

  private asNumber(value: number, unit: string): string {
    return `${value.toFixed(1)} ${unit}`;
  }

  protected readonly States = States;
}
