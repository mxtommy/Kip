import {
  AfterViewInit,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  signal,
  untracked,
  viewChild
} from '@angular/core';
import {WidgetRuntimeDirective} from '../../core/directives/widget-runtime.directive';
import {WidgetStreamsDirective} from '../../core/directives/widget-streams.directive';
import type {IWidgetPath, IWidgetSvcConfig} from '../../core/interfaces/widgets-interface';
import {CanvasService} from '../../core/services/canvas.service';
import {getColors} from '../../core/utils/themeColors.utils';
import {DashboardService} from '../../core/services/dashboard.service';
import {SignalkRequestsService} from '../../core/services/signalk-requests.service';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {ITheme} from '../../core/services/app-service';
import {MatTooltipModule} from '@angular/material/tooltip';
import {NO_VMG, TVmgName, VMG_ARROW, VMG_NAMES, VMG_TITLE} from '../racer-vmg.constants';
import {UnitsService} from '../../core/services/units.service';

/** The share of the widget the button row takes when no fixed height is set. */
const BUTTON_ROW_SHARE = '24%';

@Component({
  selector: 'widget-racer-line',
  // Sized on the host so the row is the same height in every racer widget, whatever
  // the template around it looks like.
  host: {
    '[style.--racer-button-row]': 'buttonRowCss()',
    // Any interaction anywhere in the widget restarts the idle countdown back to mode 0.
    // Bound on the host rather than the button row so no press can be missed as modes
    // are added, and so no plain container has to be made an interaction target.
    '(click)': 'touchMode()'
  },
  templateUrl: './widget-racer-line.component.html',
  styleUrls: ['./widget-racer-line.component.scss'],
  imports: [MatButtonModule, MatIconModule, MatTooltipModule]
})
export class WidgetRacerLineComponent implements AfterViewInit, OnDestroy {
  // Functional inputs (Host2 contract)
  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme>();

  // Host2 directives/services
  protected readonly runtime = inject(WidgetRuntimeDirective);
  private readonly streams = inject(WidgetStreamsDirective);
  private readonly canvas = inject(CanvasService);
  protected readonly dashboard = inject(DashboardService);
  private readonly signalk = inject(SignalkRequestsService);
  private readonly units = inject(UnitsService);
  private readonly destroyRef = inject(DestroyRef);

  // Static config from legacy defaultConfig
  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    supportAutomaticHistoricalSeries: false,
    displayName: 'DTS',
    filterSelfPaths: true,
    playBeeps: true,
    convertUnitTo: 'm',
    convertUnitToGroup: 'Length',
    numDecimal: 0,
    ignoreZones: true,
    color: 'contrast',
    modeTimeout: 10,
    showTimeToStart: false,
    buttonRowHeight: 0,
    enableTimeout: false,
    dataTimeout: 5,
    paths: {
      dtsPath: {
        description: 'Distance to Start Line',
        path: 'self.navigation.racing.distanceStartline',
        source: 'default',
        pathType: 'number',
        pathRequired: false,
        isPathConfigurable: false,
        convertUnitTo: 'm',
        showPathSkUnitsFilter: true,
        pathSkUnitsFilter: 'm',
        sampleTime: 500
      },
      lineLengthPath: {
        description: 'Length of the start line',
        path: 'self.navigation.racing.startLineLength',
        source: 'default',
        pathType: 'number',
        pathRequired: false,
        isPathConfigurable: false,
        convertUnitTo: 'm',
        showPathSkUnitsFilter: true,
        pathSkUnitsFilter: 'm',
        sampleTime: 1000
      },
      lineBiasPath: {
        description: 'Bias of the start line to starboard end',
        path: 'self.navigation.racing.stbLineBias',
        source: 'default',
        pathType: 'number',
        pathRequired: false,
        isPathConfigurable: false,
        convertUnitTo: 'm',
        showPathSkUnitsFilter: true,
        pathSkUnitsFilter: 'm',
        sampleTime: 1000
      },
      startLineNamePath: {
        description: 'The current named start line',
        path: 'self.navigation.racing.lines.startLineName',
        source: 'default',
        pathType: 'string',
        pathRequired: false,
        isPathConfigurable: false,
        convertUnitTo: undefined,
        showPathSkUnitsFilter: false,
        pathSkUnitsFilter: null,
        sampleTime: 1000
      },
      linesPath: {
        description: 'The known named lines',
        path: 'self.navigation.racing.lines.lines',
        source: 'default',
        pathType: null,
        pathRequired: false,
        isPathConfigurable: false,
        convertUnitTo: undefined,
        showPathSkUnitsFilter: false,
        pathSkUnitsFilter: null,
        sampleTime: 1000
      },
      ttlPath: {
        description: 'Time to sail to the start line in seconds',
        path: 'self.navigation.racing.timeToLine',
        source: 'default',
        pathType: 'number',
        pathRequired: false,
        isPathConfigurable: false,
        convertUnitTo: 's',
        showConvertUnitTo: false,
        showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 's',
        sampleTime: 500
      },
      ttsPath: {
        description: 'Time to the start in seconds',
        path: 'self.navigation.racing.timeToStart',
        source: 'default', pathType: 'number', pathRequired: false, isPathConfigurable: false,
        convertUnitTo: 's', showConvertUnitTo: false, showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 's', sampleTime: 500
      },
      vmgToCourseSidePath: {
        description: 'Best VMG across the line towards the course side',
        path: 'self.navigation.racing.bestVmg.toCourseSide',
        source: 'default', pathType: 'number', pathRequired: false, isPathConfigurable: false,
        convertUnitTo: 'knots', showConvertUnitTo: true, showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 'm/s', sampleTime: 1000
      },
      vmgToPortEndPath: {
        description: 'Best VMG along the line towards the port end (pin)',
        path: 'self.navigation.racing.bestVmg.toPortEnd',
        source: 'default', pathType: 'number', pathRequired: false, isPathConfigurable: false,
        convertUnitTo: 'knots', showConvertUnitTo: false, showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 'm/s', sampleTime: 1000
      },
      vmgToStbEndPath: {
        description: 'Best VMG along the line towards the starboard end (boat)',
        path: 'self.navigation.racing.bestVmg.toStbEnd',
        source: 'default', pathType: 'number', pathRequired: false, isPathConfigurable: false,
        convertUnitTo: 'knots', showConvertUnitTo: false, showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 'm/s', sampleTime: 1000
      },
      vmgFromCourseSidePath: {
        description: 'Best VMG back across the line from the course side',
        path: 'self.navigation.racing.bestVmg.fromCourseSide',
        source: 'default', pathType: 'number', pathRequired: false, isPathConfigurable: false,
        convertUnitTo: 'knots', showConvertUnitTo: false, showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 'm/s', sampleTime: 1000
      },
      vmgToCourseSideOverridePath: {
        description: 'Manual adjustment behind the best VMG towards the course side',
        path: 'self.navigation.racing.bestVmg.toCourseSide.override',
        source: 'default', pathType: 'number', pathRequired: false, isPathConfigurable: false,
        convertUnitTo: 'knots', showConvertUnitTo: false, showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 'm/s', sampleTime: 1000
      },
      vmgToPortEndOverridePath: {
        description: 'Manual adjustment behind the best VMG towards the port end',
        path: 'self.navigation.racing.bestVmg.toPortEnd.override',
        source: 'default', pathType: 'number', pathRequired: false, isPathConfigurable: false,
        convertUnitTo: 'knots', showConvertUnitTo: false, showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 'm/s', sampleTime: 1000
      },
      vmgToStbEndOverridePath: {
        description: 'Manual adjustment behind the best VMG towards the starboard end',
        path: 'self.navigation.racing.bestVmg.toStbEnd.override',
        source: 'default', pathType: 'number', pathRequired: false, isPathConfigurable: false,
        convertUnitTo: 'knots', showConvertUnitTo: false, showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 'm/s', sampleTime: 1000
      },
      vmgFromCourseSideOverridePath: {
        description: 'Manual adjustment behind the best VMG from the course side',
        path: 'self.navigation.racing.bestVmg.fromCourseSide.override',
        source: 'default', pathType: 'number', pathRequired: false, isPathConfigurable: false,
        convertUnitTo: 'knots', showConvertUnitTo: false, showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 'm/s', sampleTime: 1000
      },
      ttbPath: {
        description: 'Time to delay before sailing to the start line in seconds',
        path: 'self.navigation.racing.timeToBurn',
        source: 'default',
        pathType: 'number',
        pathRequired: false,
        isPathConfigurable: false,
        convertUnitTo: 's',
        showConvertUnitTo: false,
        showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 's',
        sampleTime: 500
      },
    }
  };

  // Canvas refs
  private canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvasMainRef');
  private canvasElement: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private cssWidth = 0;
  private cssHeight = 0;

  // State
  private dtsValue: number | null = null;
  private lengthValue: number | null = null;
  private biasValue: number | null = null;
  private ttlValue: number | null = null;
  private ttbValue: number | null = null;
  private ttsValue: number | null = null;
  protected labelColor = signal<string>('');
  private valueColor = '';
  private dtsColor = '';
  private maxValueTextWidth = 0;
  private maxValueTextHeight = 0;
  private displayLineIndex = 0;
  private lines: string[] = [];
  private startLineName: string | null = null;
  protected portBiasValue = signal<string>('');
  protected lineLengthValue = signal<string>('');
  protected stbBiasValue = signal<string>('');
  // The four best VMGs and any manual adjustment behind each, for the VMG editor.
  private readonly bestVmg = signal<Record<TVmgName, number | null>>({...NO_VMG});
  private readonly vmgOverride = signal<Record<TVmgName, number | null>>({...NO_VMG});
  protected readonly selectedVmg = signal<TVmgName | null>(null);
  /** The canvas area, which the VMG editor draws into instead of the canvas. */
  protected readonly canvasSize = signal<{ width: number; height: number }>({ width: 0, height: 0 });

  protected mode = signal<number>(0);
  private readonly normalizedConfig = signal<IWidgetSvcConfig>(WidgetRacerLineComponent.DEFAULT_CONFIG);
  private get pathsRecord(): Record<string, IWidgetPath> {
    return ((this.runtime.options() ?? WidgetRacerLineComponent.DEFAULT_CONFIG).paths as Record<string, IWidgetPath> | undefined) ?? {};
  }

  /** Fixed height of the button row, so touch targets do not shrink with the widget. */
  /**
   * Height of the button row. 0 - the default - gives it a share of the widget instead
   * of a fixed size, which is how it behaved before the setting existed; anything else
   * is a pixel height, so the touch targets stay put however tall the widget is.
   */
  protected readonly buttonRowHeight = computed<number>(() =>
    (this.runtime.options() ?? WidgetRacerLineComponent.DEFAULT_CONFIG).buttonRowHeight ?? 0);

  /** That height as a CSS length: a percentage when it is left to share the widget. */
  protected readonly buttonRowCss = computed<string>(() => {
    const pixels = this.buttonRowHeight();
    return pixels > 0 ? `${pixels}px` : BUTTON_ROW_SHARE;
  });

  constructor() {
    // Theme/palette effect
    effect(() => {
      const cfg = this.runtime.options() ?? WidgetRacerLineComponent.DEFAULT_CONFIG;
      const theme = this.theme();
      if (!theme) return;
      untracked(() => {
        const palette = getColors(cfg.color ?? 'contrast', theme);
        this.labelColor.set(palette.dim);
        this.valueColor = palette.color;
        this.draw();
      });
    });

    // Observe dtsPath
    effect(() => {
      const pathCfg = this.pathsRecord['dtsPath'];
      if (!pathCfg?.path) return;
      untracked(() => this.streams.observe('dtsPath', pkt => {
        this.dtsValue = pkt?.data?.value ?? null;
        this.updateDtsColor();
        this.draw();
      }));
    });

    // Observe lineLengthPath
    effect(() => {
      const pathCfg = this.pathsRecord['lineLengthPath'];
      if (!pathCfg?.path) return;
      untracked(() => this.streams.observe('lineLengthPath', pkt => {
        this.lengthValue = pkt?.data?.value ?? null;
        this.setLenBias();
        this.draw();
      }));
    });

    // Observe lineBiasPath
    effect(() => {
      const pathCfg = this.pathsRecord['lineBiasPath'];
      if (!pathCfg?.path) return;
      untracked(() => this.streams.observe('lineBiasPath', pkt => {
        this.biasValue = pkt?.data?.value ?? null;
        this.setLenBias();
      }));
    });

    // Observe Start Line Name
    effect(() => {
      const pathCfg = this.pathsRecord['startLineNamePath'];
      if (!pathCfg?.path) return;
      untracked(() => this.streams.observe('startLineNamePath', pkt => {
        console.log('startLineName: ' + JSON.stringify(pkt ?? 'no data'));
        this.startLineName = pkt?.data?.value ?? null;
        this.displayLineIndex = 0;
        for (let i = 0; i < this.lines.length; i++) {
          if (this.lines[i] === this.startLineName) {
            this.displayLineIndex = i;
            break;
          }
        }
        this.draw();
      }));
    });

    // Observe lines
    effect(() => {
      const pathCfg = this.pathsRecord['linesPath'];
      if (!pathCfg?.path) return;
      untracked(() => this.streams.observe('linesPath', pkt => {
        console.log('lines: ' + JSON.stringify(pkt ?? 'no data'));
        this.lines = ['Default'];
        this.displayLineIndex = 0;
        if (pkt?.data?.value && Array.isArray(pkt.data.value)) {
          for (const line of pkt.data.value) {
            if (line.startLineName) {
              if (line.startLineName === this.startLineName)
                this.displayLineIndex = this.lines.length;
              this.lines.push(line.startLineName);
            }
          }
        }
      }));
    });

    // Stream: TTL
    effect(() => {
      const path = this.pathsRecord['ttlPath']?.path;
      if (!path) {
        return;
      }
      untracked(() => this.streams.observe('ttlPath', pkt => {
        this.ttlValue = pkt?.data?.value ?? null;
        this.draw();
      }));
    });

    // Stream: TTB
    effect(() => {
      const path = this.pathsRecord['ttbPath']?.path;
      if (!path) {
        return;
      }
      untracked(() => this.streams.observe('ttbPath', pkt => {
        this.ttbValue = pkt?.data?.value ?? null;
        this.draw();
      }));
    });

    // Request feedback beep
    // The countdown, and the VMGs the editor works on.
    const num = (key: string, apply: (v: number | null) => void) => {
      effect(() => {
        if (!this.pathsRecord[key]?.path) return;
        untracked(() => this.streams.observe(key, pkt => {
          const value = pkt?.data?.value;
          apply(typeof value === 'number' ? value : null);
          this.draw();
        }));
      });
    };
    num('ttsPath', v => this.ttsValue = v);
    for (const name of VMG_NAMES) {
      const cap = name.charAt(0).toUpperCase() + name.slice(1);
      num(`vmg${cap}Path`, v => this.bestVmg.update(d => ({...d, [name]: v})));
      num(`vmg${cap}OverridePath`, v => this.vmgOverride.update(d => ({...d, [name]: v})));
    }

    this.signalk.subscribeRequest().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result => {
      if (result.widgetUUID === this.id()) {
        if (result.statusCode === 200) this.beep(600, 20);
      }
    });
  }

  // Canvas lifecycle
  ngAfterViewInit(): void {
    this.canvasElement = this.canvasRef().nativeElement;
    this.ctx = this.canvasElement.getContext('2d');
    this.canvas.registerCanvas(this.canvasElement, {
      autoRelease: true,
      onResize: (w, h) => {
        this.cssWidth = w; this.cssHeight = h;
        this.canvasSize.set({ width: w, height: h });
        this.maxValueTextWidth = Math.floor(this.cssWidth * 0.95);
        this.maxValueTextHeight = Math.floor(this.cssHeight * 0.95);
        this.draw();
      }
    });
    this.cssHeight = Math.round(this.canvasElement.getBoundingClientRect().height);
    this.cssWidth = Math.round(this.canvasElement.getBoundingClientRect().width);
    this.maxValueTextWidth = Math.floor(this.cssWidth * 0.95);
    this.maxValueTextHeight = Math.floor(this.cssHeight * 0.95);
    this.canvasSize.set({ width: this.cssWidth, height: this.cssHeight });
    this.draw();
  }

  // Interaction methods
  /** The mode that replaces the numbers with the VMG editor. */
  protected readonly isViewMode = computed<boolean>(() => this.mode() === 5);

  /**
   * The four best VMGs, laid out to match the line: the port end on the left, the
   * across-line pair stacked in the middle with the course side above, and the starboard
   * end on the right. Sized to the largest that fits - bounded by a third of the width,
   * since the outer two share a row, and by the height the stacked pair needs.
   */
  protected readonly vmgCross = computed(() => {
    const { width, height } = this.canvasSize();
    if (width <= 0 || height <= 0) return [];
    const values = this.bestVmg(), overrides = this.vmgOverride();
    const selected = this.selectedVmg();
    const decimals = this.cfg().numDecimal ?? 1;
    const text = (v: number | null) => v == null ? '--' : v.toFixed(decimals);
    const texts = VMG_NAMES.map(n => text(values[n]));

    // Roughly 0.56em a character; the box around a selected value adds a little padding
    // but is excluded from the budget, only one being drawn at a time.
    const widestEm = Math.max(...texts.map(t => t.length * 0.56));
    const font = Math.min((width / 3 - 8) / widestEm, height / 2.6, 96);
    const gap = font * 1.05;
    const centreY = height / 2;
    const centres: Record<TVmgName, { x: number; y: number }> = {
      toCourseSide: { x: width / 2, y: centreY - gap / 2 },
      toPortEnd: { x: width / 6, y: centreY },
      toStbEnd: { x: width * 5 / 6, y: centreY },
      fromCourseSide: { x: width / 2, y: centreY + gap / 2 }
    };

    return VMG_NAMES.map((name, index) => {
      const centre = centres[name];
      const label = texts[index];
      const boxWidth = (label.length * 0.56 + 0.18) * font;
      const boxHeight = font * 1.02;
      return {
        name, text: label, font,
        x: centre.x,
        // Digits sit between the baseline and 0.72em above it, so the visual centre is
        // 0.36em up: drop the baseline to put that centre on the column's centre.
        y: centre.y + font * 0.36,
        box: {
          x: Math.min(Math.max(centre.x - boxWidth / 2, 1), Math.max(width - boxWidth - 1, 1)),
          y: centre.y - boxHeight / 2,
          width: boxWidth, height: boxHeight, radius: font * 0.16
        },
        overridden: overrides[name] != null,
        selected: selected === name,
        title: VMG_TITLE[name]
      };
    });
  });

  private cfg(): IWidgetSvcConfig {
    return this.runtime.options() ?? WidgetRacerLineComponent.DEFAULT_CONFIG;
  }

  protected readonly displayName = computed<string>(() => this.cfg().displayName || 'DTS');
  protected readonly numDecimal = computed<number>(() => this.cfg().numDecimal ?? 1);
  protected readonly vmgUnit = computed<string>(() =>
    this.pathsRecord['vmgToCourseSidePath']?.convertUnitTo ?? 'knots');

  /** Label on the VMG select button: the arrow shows where the value sits on the cross. */
  protected readonly vmgButtonLabel = computed<string>(() => {
    const name = this.selectedVmg();
    return name ? `VMG ${VMG_ARROW[name]}` : 'VMG \u2013';
  });

  protected readonly vmgButtonTooltip = computed<string>(() => {
    const name = this.selectedVmg();
    return name ? `Editing: ${VMG_TITLE[name]}. Press to select the next VMG.`
      : 'Select a best VMG to edit';
  });

  protected readonly vmgResetTooltip = computed<string>(() => {
    const name = this.selectedVmg();
    return name ? `Clear the manual adjustment to: ${VMG_TITLE[name]}`
      : 'Clear the manual adjustments to all four best VMGs';
  });

  protected readonly vmgStepLabel = computed<string>(() => {
    const unit = this.vmgUnit();
    return `0.1${unit === 'knots' ? 'kn' : unit}`;
  });

  /** Cycle the edited VMG through the four values and back to none selected. */
  public cycleVmg(): void {
    const current = this.selectedVmg();
    const index = current === null ? 0 : VMG_NAMES.indexOf(current) + 1;
    this.selectedVmg.set(index >= VMG_NAMES.length ? null : VMG_NAMES[index]);
  }

  /**
   * Adjust the selected best VMG by one step. The buttons work in whatever unit the VMG
   * paths display in, the plugin's API in m/s, so the step is converted back.
   */
  public adjustVmg(steps: number): void {
    const name = this.selectedVmg();
    if (!name) return;
    // Speed conversions are linear through zero, so one base unit converted gives the
    // display units per m/s to divide the step by.
    const perBaseUnit = this.units.convertToUnit(this.vmgUnit(), 1) || 1;
    this.signalk.putRequest('navigation.racing.setBestVmg',
      {vmg: name, delta: (steps * 0.1) / perBaseUnit}, this.id());
  }

  /**
   * Clear the manual adjustment behind the selected best VMG. With none selected, all
   * four are cleared - which is what the plugin does when the request names none.
   */
  public resetVmg(): void {
    const name = this.selectedVmg();
    this.signalk.putRequest('navigation.racing.setBestVmg',
      name ? {vmg: name, command: 'reset'} : {command: 'reset'}, this.id());
  }

  /**
   * Throw away every collected VMG sample. Offered in place of the reset button when no
   * VMG is selected, there being no single adjustment to revert then.
   */
  public clearVmgSamples(): void {
    this.signalk.putRequest('navigation.racing.setBestVmg', {command: 'clear'}, this.id());
  }

  protected readonly modeTimeout = computed<number>(() => this.cfg().modeTimeout ?? 10);
  private readonly showTimeToStart = computed<boolean>(() => this.cfg().showTimeToStart ?? false);

  /** Pending revert to the default display, if a control mode is showing. */
  private modeTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Restart the idle countdown after a button press.
   *
   * The control modes are meant to be used and left, and a widget parked on one is a
   * widget not showing its numbers - easily done on a boat, where the last press before
   * a start is rarely followed by a deliberate press back. Bound to the button row
   * rather than to each action, so a press cannot be missed as modes are added.
   */
  protected touchMode(): void {
    if (this.modeTimer) {
      clearTimeout(this.modeTimer);
      this.modeTimer = null;
    }
    const seconds = this.modeTimeout();
    if (this.mode() === 0 || !(seconds > 0)) return;
    this.modeTimer = setTimeout(() => {
      this.modeTimer = null;
      this.mode.set(0);
      this.selectedVmg.set(null);
      this.draw();
    }, seconds * 1000);
  }

  public toggleMode(): void {
    this.mode.update(v => (v + 1) % 6);
    if (this.mode() !== 5) this.selectedVmg.set(null);
    this.touchMode();
    this.draw();
  }

  public setLineEnd(end: string): string {
    return this.signalk.putRequest('navigation.racing.setStartLine', {end, position: 'bow'}, this.id()) ?? '';
  }

  public swapLineEnds(): string {
    // The plugin carries the collected VMG samples across with the ends rather than
    // discarding them, since reversing the bearing just relabels every sample.
    return this.signalk.putRequest('navigation.racing.swapStartLine', {}, this.id()) ?? '';
  }

  public adjustLineEnd(end: string, delta: number, rotateRadians: number): string {
    return this.signalk.putRequest('navigation.racing.setStartLine', {end, delta, rotate: rotateRadians}, this.id()) ?? '';
  }

  public nextDisplayLineName() {
    if (++this.displayLineIndex >= this.lines.length)
      this.displayLineIndex = 0;
  }

  public getDisplayLineName(): string {
    return this.lines[this.displayLineIndex] || 'Default';
  }

  public isDisplayLineCurrent(): boolean {
    return this.getDisplayLineName() === (this.startLineName || 'Default');
  }

  public setStartLine(name: string) {
    const startLineName = (name === 'Default' || !name) ? null : name;
    this.signalk.putRequest(
      'navigation.racing.setStartLineName',
      { startLineName },
      this.id()
    );
    this.mode.set(0);
    this.draw();
  }

  public toRadians(deg: number): number {
    return deg * (Math.PI / 180);
  }
  private draw(): void {
    if (!this.ctx || !this.canvasElement) return;
    const cfg = this.runtime.options() ?? WidgetRacerLineComponent.DEFAULT_CONFIG;
    // The widget's name labels its own value, the way TTS, TTL and TTB do, rather than
    // sitting alone across the top: four readouts with one unlabelled is harder to read
    // than four labelled the same way, and it frees the top band for the numbers.
    const name = cfg?.displayName || 'DTS';
    this.canvas.clearCanvas(this.ctx, this.cssWidth, this.cssHeight);

    // A 50:50 split: the distance to the line owns the top half, the two times the
    // bottom. Each half is sized independently so neither crowds the other whatever the
    // widget's aspect. In each, the label sits at the top of its zone and the value
    // below it, so the four readouts line up as two rows of labels and two of values.
    const half = Math.floor(this.cssHeight * 0.5);
    const labelInset = Math.floor(this.cssHeight * 0.02);
    const labelHeight = Math.floor(half * 0.22);
    const labelWidth = Math.floor(this.cssWidth * 0.11);
    // All four labels are the dim palette colour: they name the readouts rather than
    // carrying a value, so they should not follow the distance into its alarm colours.
    const labelColor = this.labelColor();

    // With the countdown showing it takes the left of the top half, directly above the
    // time to line it has to be read against, and the distance moves over beside it.
    const withTts = this.showTimeToStart();
    const topValueY = Math.floor(this.cssHeight * 0.30);

    if (withTts) {
      this.canvas.drawText(
        this.ctx, 'TTS',
        Math.floor(this.cssWidth * 0.02), labelInset,
        labelWidth, labelHeight,
        'normal', labelColor, 'left', 'top'
      );
      this.canvas.drawText(
        this.ctx, this.toHHMMSS(this.ttsValue),
        Math.floor(this.cssWidth * 0.14), topValueY,
        // Stops short of where the distance begins, so a long countdown cannot run into it.
        Math.floor(this.cssWidth * 0.32),
        Math.floor(half * 0.62),
        'bold', this.dtsColor, 'left', 'middle'
      );
    }

    this.canvas.drawText(
      this.ctx, name,
      Math.floor(this.cssWidth * (withTts ? 0.49 : 0.02)), labelInset,
      labelWidth, labelHeight,
      'normal', labelColor, 'left', 'top'
    );

    this.canvas.drawText(
      this.ctx,
      this.getValueText(),
      // Clears its own label horizontally, so the label sitting at the top of the zone
      // costs the value no height.
      Math.floor(this.cssWidth * (withTts ? 0.79 : 0.55)), topValueY,
      Math.floor(this.cssWidth * (withTts ? 0.36 : 0.80)),
      Math.floor(half * 0.84),
      'bold',
      this.dtsColor,
      'center',
      'middle'
    );

    this.canvas.drawText(
      this.ctx,
      this.pathsRecord['dtsPath']?.convertUnitTo || 'm',
      Math.floor(this.cssWidth * 0.975),
      half,
      Math.floor(this.cssWidth * 0.3),
      Math.floor(half * 0.18),
      'normal',
      this.dtsColor,
      'right',
      'bottom'
    );

    // The bottom half carries TTL on the left and TTB on the right, laid out the same
    // way: the label at the top of the half, the value filling the half beside it. The
    // values sit close to the button row: the space left below them was more than the
    // row needs to read as separate, and the numbers are worth more than the gap.
    const timeY = Math.floor(this.cssHeight * 0.785);
    const timeLabelY = half + labelInset;
    const valueWidth = Math.floor(this.cssWidth * 0.36);
    const valueHeight = Math.floor(half * 0.72);

    this.canvas.drawText(
      this.ctx, 'TTL',
      Math.floor(this.cssWidth * 0.02), timeLabelY,
      labelWidth, labelHeight,
      'normal', labelColor, 'left', 'top'
    );
    this.canvas.drawText(
      this.ctx, this.getTimeToLineText(),
      Math.floor(this.cssWidth * 0.14), timeY,
      valueWidth, valueHeight,
      'bold', this.dtsColor, 'left', 'middle'
    );
    this.canvas.drawText(
      this.ctx, 'TTB',
      Math.floor(this.cssWidth * 0.52), timeLabelY,
      labelWidth, labelHeight,
      'normal', labelColor, 'left', 'top'
    );
    this.canvas.drawText(
      this.ctx, this.getTimeToBurnText(),
      Math.floor(this.cssWidth * 0.64), timeY,
      valueWidth, valueHeight,
      'bold', this.dtsColor, 'left', 'middle'
    );

    this.setLenBias();
  }

  private getValueText(): string {
    if (this.dtsValue === null) return '--';
    const cfg = this.runtime.options() ?? WidgetRacerLineComponent.DEFAULT_CONFIG;
    return this.dtsValue.toFixed(cfg?.numDecimal ?? 0);
  }

  private toHHMMSS(totalSeconds: number | null): string {
    if (totalSeconds == null || isNaN(totalSeconds)) return '-:--';
    const negative = totalSeconds < 0;
    if (negative) totalSeconds = -totalSeconds;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const sign = negative ? '-' : '';
    if (hours === 0)
      return `${sign}${minutes.toString().padStart(1, '0')}:${seconds.toString().padStart(2, '0')}`;
    return `${sign}${hours.toString().padStart(1, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  private getTimeToLineText(): string {
    return this.toHHMMSS(this.ttlValue);
  }

  private getTimeToBurnText(): string {
    // Left as the placeholder when there is no value, rather than falling back to zero:
    // "0:00" reads as no time left to burn, which is a very different thing from the
    // timer not running.
    return this.toHHMMSS(this.ttbValue);
  }
  private setLenBias(): void {
    const cfg = this.runtime.options() ?? WidgetRacerLineComponent.DEFAULT_CONFIG;
    const lineLengthCfg = this.pathsRecord['lineLengthPath'];
    const lineBiasCfg = this.pathsRecord['lineBiasPath'];
    if (lineLengthCfg?.path && this.lengthValue != null) {
      let unit = lineLengthCfg.convertUnitTo;
      if (unit === 'feet') unit = '′';
      this.lineLengthValue.set(`―${this.applyDecorations(this.lengthValue.toFixed(cfg.numDecimal ?? 0))}${unit ?? ''}―`);
    }
    if (lineBiasCfg?.path && this.biasValue != null) {
      let unit = lineBiasCfg.convertUnitTo;
      if (unit === 'feet') unit = '′';
      if (this.biasValue < 0) {
        this.portBiasValue.set('+' + (-this.biasValue).toFixed(cfg.numDecimal ?? 0) + (unit ?? ''));
        this.stbBiasValue.set(this.biasValue.toFixed(cfg.numDecimal ?? 0) + (unit ?? ''));
      } else {
        this.portBiasValue.set(' ' + (-this.biasValue).toFixed(cfg.numDecimal ?? 0) + (unit ?? ''));
        this.stbBiasValue.set(' +' + this.biasValue.toFixed(cfg.numDecimal ?? 0) + (unit ?? ''));
      }
    }
  }

  private applyDecorations(txt: string): string {
    switch (this.pathsRecord['dtsPath']?.convertUnitTo) {
      case 'percent':
      case 'percentraw':
        return txt + '%';
      default:
        return txt;
    }
  }

  private updateDtsColor(): void {
    const theme = this.theme(); const cfg = this.runtime.options() ?? WidgetRacerLineComponent.DEFAULT_CONFIG;
    if (!theme) return;
    if (cfg.ignoreZones) {
      if (!this.dtsValue) this.dtsColor = this.valueColor;
      else if (this.dtsValue < 0) this.dtsColor = theme.zoneAlarm;
      else if (this.dtsValue < 10) this.dtsColor = theme.zoneWarn;
      else if (this.dtsValue < 20) this.dtsColor = theme.zoneAlert;
      else this.dtsColor = this.valueColor;
    } else {
      // Placeholder for potential state-driven colors (legacy used path states)
      this.dtsColor = this.valueColor;
    }
  }

  private beep(frequency = 440, duration = 100) {
    if (!this.runtime.options()?.playBeeps) return;
    const AudioCtx = (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    const audioCtx = new AudioCtx();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gainNode.gain.value = 0.1;
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration / 1000);
  }

  ngOnDestroy(): void {
    if (this.modeTimer) {
      clearTimeout(this.modeTimer);
      this.modeTimer = null;
    }
    try {
      if (this.canvasElement) this.canvas.unregisterCanvas(this.canvasElement);
    } catch { /* ignore */ }
  }
}
