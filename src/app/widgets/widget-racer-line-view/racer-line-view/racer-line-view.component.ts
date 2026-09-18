import {
  AfterViewInit,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  signal,
  untracked,
  viewChild
} from '@angular/core';
import { UnitsService } from '../../../core/services/units.service';
import { ILatLon, ILineGeometry, lineGeometry, screenVector } from './start-line-geometry.util';
import { TVmgName, VMG_NAMES, VMG_TITLE } from '../../racer-vmg.constants';
export type { TVmgName };

declare global {
  interface Window {
    /** Turns the approach trace below on: set it from the browser console. */
    kipRacerStartLineDebug?: boolean;
    /** Every row the trace has logged this run, for copying out in one go. */
    kipRacerStartLineTrace?: Record<string, number | string | null>[];
  }
}

const MODE_LINE = 0;
const MODE_VMG = 1;

/**
 * Floor under a derived effective VMG, in m/s - one knot, matching the plugin's own
 * `minEffectiveVmg` default. Only used when the plugin does not publish its effective
 * VMGs; when it does, its configured value governs.
 */
const MIN_EFFECTIVE_VMG = 0.514444;

const LEGEND_CURRENT = 'Current cog/sog to start';
const LEGEND_STUB = 'Current course over ground (no timer running)';

/**
 * Everything the drawing needs from the Signal K stream. The host widget owns the
 * subscriptions and hands the values down, so this component stays a pure view.
 */
export interface IRacerLineViewData {
  portLat: number | null; portLon: number | null;
  stbLat: number | null; stbLon: number | null;
  lat: number | null; lon: number | null;
  /** Signal K's timestamp for the current position fix, for the approach trace. */
  fixTime: number | null;
  heading: number | null; cog: number | null; sog: number | null;
  lineLength: number | null; lineBearing: number | null;
  timeToStart: number | null; timerRunning: boolean;
  /** True wind direction, the bearing the wind blows FROM. */
  twd: number | null;
  boatLength: number | null;
  /** The effective VMGs as the plugin publishes them; null against an older one. */
  effVmgToLine: number | null; effVmgAlongLine: number | null;
  bestVmg: Record<TVmgName, number | null>;
  vmgOverride: Record<TVmgName, number | null>;
}

/** The projection running from the boat towards the line. */
interface ISceneProjection {
  x1: number; y1: number; x2: number; y2: number;
  width: number; opacity: number; title: string;
}

/** One arm of the VMG cross. */
interface ISceneVmg {
  name: TVmgName;
  x: number; y: number;
  text: string;
  /** Selection box hugging this value, sized from its own text. */
  box: { x: number; y: number; width: number; height: number };
  /** Highlighted when the value stands in for the collected samples. */
  overridden: boolean;
  selected: boolean;
  title: string;
}

/** The two ends of the line, drawn at an exaggerated size so they stay legible. */
interface ISceneEnds {
  /** Radius of the pin at the port end. */
  pinRadius: number;
  /** Hull of the committee boat at the starboard end. */
  hull: string;
  /** Cabin sitting on that hull. */
  cabin: { x: number; y: number; width: number; height: number };
}

/**
 * The fitted view of the line drawing, held steady between re-fits so the line stays put
 * and the boat moves against it.
 */
interface IViewFrame {
  /** viewBox units per metre. */
  scale: number;
  /** Along-line and across-line model coordinates at the centre of the drawing. */
  midA: number;
  midC: number;
}

/**
 * One leg of the approach, drawn as a dimension line: a rule with a tick at each end and
 * its value set into a break in the middle, so it reads as a measurement rather than as
 * a course to steer. Both legs are axis-aligned on screen, the drawing being line-up.
 */
interface ISceneLeg {
  x1: number; y1: number; x2: number; y2: number;
  /** End ticks, drawn across the leg. */
  ticks: string;
  label: string;
  labelX: number; labelY: number;
  /** Horizontal legs label above the rule, vertical ones label beside it. */
  anchor: 'middle' | 'start' | 'end';
  title: string;
}

/** Everything the template draws, in viewBox units. */
interface IScene {
  portX: number; stbX: number; lineY: number;
  ends: ISceneEnds;
  label: string; labelX: number; labelY: number;
  projections: ISceneProjection[];
  boat: { path: string; ocs: boolean; title: string } | null;
  vmgs: ISceneVmg[] | null;
  /**
   * The start zone: the line's own extensions and the 45 degree wedges off each end,
   * drawn faintly because they are what decides which legs the time to line is built
   * from, not part of the course itself.
   */
  guides: { x1: number; y1: number; x2: number; y2: number }[];
  /** The approach the time to line is computed over: along to the zone, then across. */
  legs: ISceneLeg[];
  /** Where the boat reaches along those legs at the gun, at the effective VMGs. */
  gun: { x: number; y: number; title: string } | null;
  /** Size of the VMG values, grown to fill whatever room the cross has. */
  vmgFont: number;
  /** Size of the length and heading label, shrunk from LABEL_FONT if it would not fit. */
  labelFont: number;
  /** The wind, shown against the line's own orientation. Null when TWD is unknown. */
  wind: { points: string; title: string } | null;
}

/**
 * The start line drawing: the line "line up" with the boat against it, the start zone it
 * sits in, and the approach the time to line is computed over - or, in VMG mode, the four
 * best VMGs laid out to match. Purely presentational: the host widget owns the data and
 * the buttons.
 */
@Component({
  selector: 'racer-line-view',
  templateUrl: './racer-line-view.component.html',
  styleUrls: ['./racer-line-view.component.scss']
})
export class RacerLineViewComponent implements AfterViewInit, OnDestroy {
  /** Everything live, from the host widget's subscriptions. */
  public data = input.required<IRacerLineViewData>();
  /** Swaps the boat and its approach for the four best VMGs. */
  public vmgMode = input<boolean>(false);
  public selectedVmg = input<TVmgName | null>(null);
  public title = input<string>('');
  public palette = input.required<{ color: string; dim: string; dimmer: string }>();
  /** Unit the line length and the approach legs are shown in. */
  public lengthUnit = input<string>('m');
  /** Unit the best VMGs are shown in. */
  public vmgUnit = input<string>('knots');
  public numDecimal = input<number>(1);
  /** Percent of the drawing's height the view may drift before it re-fits. */
  public viewSmoothing = input<number>(10);

  private readonly units = inject(UnitsService);

  // The drawing was written against signals holding each value; these keep that shape so
  // the geometry below reads the same whether the data arrives as inputs or as streams.
  private readonly portLat = computed(() => this.data().portLat);
  private readonly portLon = computed(() => this.data().portLon);
  private readonly stbLat = computed(() => this.data().stbLat);
  private readonly stbLon = computed(() => this.data().stbLon);
  private readonly lat = computed(() => this.data().lat);
  private readonly lon = computed(() => this.data().lon);
  private readonly fixTime = computed(() => this.data().fixTime);
  private readonly heading = computed(() => this.data().heading);
  private readonly cog = computed(() => this.data().cog);
  private readonly sog = computed(() => this.data().sog);
  private readonly lineLength = computed(() => this.data().lineLength);
  private readonly lineBearing = computed(() => this.data().lineBearing);
  private readonly timeToStart = computed(() => this.data().timeToStart);
  private readonly timerRunning = computed(() => this.data().timerRunning);
  private readonly twd = computed(() => this.data().twd);
  private readonly boatLength = computed(() => this.data().boatLength);
  private readonly effVmgToLine = computed(() => this.data().effVmgToLine);
  private readonly effVmgAlongLine = computed(() => this.data().effVmgAlongLine);
  private readonly bestVmg = computed(() => this.data().bestVmg);
  private readonly vmgOverride = computed(() => this.data().vmgOverride);
  private readonly mode = computed(() => this.vmgMode() ? MODE_VMG : MODE_LINE);

  // Drawing coordinate system. The height is fixed so that font sizes scale with the
  // widget; the width tracks the container aspect so the drawing fills it undistorted.
  protected readonly VB_HEIGHT = 260;
  // Band kept clear at the top for the widget title, so the drawing can never run into
  // it however the boat lies.
  protected readonly VB_TOP_BAND = 26;
  // The line is never drawn into the bottom of the viewport: at a glance a line low
  // in the frame reads as one about to leave it. 10% of the height.
  private readonly VB_BOTTOM_MARGIN = 26;
  private readonly VB_MARGIN = 28;
  // Font size of the length and start heading label. Everything sitting above the line -
  // the label and the arrow beside it - is scaled from it, and LABEL_HEADROOM is the
  // space that has to stay clear above the line to hold them.
  private readonly LABEL_FONT = 36;
  private readonly LABEL_HEADROOM = 56;
  // Both ends of the line are taken to be 10m objects. They are drawn at this multiple
  // of their true size so they stay legible landmarks whatever the line's zoom.
  private readonly END_METRES = 10;
  private readonly END_EXAGGERATION = 2;
  // The vessel, in contrast, is drawn at true scale, so it can be read against the line.
  // Fallback length for a vessel that does not publish one, and the beam its hull is
  // drawn with as a fraction of that length.
  private readonly DEFAULT_BOAT_METRES = 10;
  private readonly HULL_BEAM_RATIO = 0.36;
  protected readonly vbWidth = signal<number>(400);

  private readonly vizRef = viewChild.required<ElementRef<HTMLDivElement>>('vizRef');
  private resizeObserver: ResizeObserver | null = null;

  // The view the line drawing is currently using. Re-fitting on every update makes the
  // line drift about under a distant boat, so the frame is kept until it has actually
  // gone stale - see updateViewFrame.
  private readonly viewFrame = signal<IViewFrame | null>(null);
  /** What the held frame was fitted for; a change here forces a re-fit. */
  private frameKey: string | null = null;

  constructor() {
    // Keep the view frame up to date. Reading the geometry, width and mode here makes
    // this fire on every position update and on any resize.
    effect(() => {
      const geo = this.geometry();
      const width = this.vbWidth();
      const vmgMode = this.mode() === MODE_VMG;
      const smoothing = this.viewSmoothing();
      untracked(() => this.updateViewFrame(geo, width, vmgMode, smoothing));
    });

    // Diagnostic trace of the approach. Reading the geometry here makes this fire on
    // every position and countdown update.
    effect(() => {
      const geo = this.geometry();
      untracked(() => this.traceApproach(geo));
    });
  }

  ngAfterViewInit(): void {
    const host = this.vizRef().nativeElement;
    this.resizeObserver = new ResizeObserver(() => this.measure(host));
    this.resizeObserver.observe(host);
    this.measure(host);
  }

  private measure(host: HTMLElement): void {
    const rect = host.getBoundingClientRect();
    if (rect.height <= 0) return;
    // Clamped so an extreme aspect cannot squash the drawing into a sliver.
    const width = Math.round(this.VB_HEIGHT * Math.min(Math.max(rect.width / rect.height, 0.6), 4));
    if (width !== this.vbWidth()) this.vbWidth.set(width);
  }

  private readonly geometry = computed<ILineGeometry | null>(() =>
    // The plugin nulls the length when the line is lost, while the end positions keep
    // their last flattened latitude/longitude, so the length is what says there is a line.
    this.lineLength() == null ? null : lineGeometry(
      this.latLon(this.portLat(), this.portLon()),
      this.latLon(this.stbLat(), this.stbLon()),
      this.latLon(this.lat(), this.lon())
    ));

  /** The whole drawing, in viewBox units. Null when there is no line to draw. */
  protected readonly scene = computed<IScene | null>(() => {
    const geo = this.geometry();
    if (!geo) return null;

    const W = this.vbWidth(), margin = this.VB_MARGIN;
    // The band the drawing gets: below the title, with room above the line kept clear
    // for the length and heading label that sits there.
    const yMin = this.VB_TOP_BAND + this.LABEL_HEADROOM;
    const yMax = this.VB_HEIGHT - this.VB_BOTTOM_MARGIN;
    const vmgMode = this.mode() === MODE_VMG;
    const boat = geo.boat;

    let scale: number;
    let sx: (a: number) => number;
    let sy: (c: number) => number;

    if (vmgMode) {
      // The boat is replaced by the VMG cross, so there is nothing to fit across the
      // line: the line goes to the top of the band and the cross takes the space below
      // it, the way the webapp stacks them.
      scale = (W - 2 * margin) / Math.max(geo.length, 1);
      sx = (a: number) => W / 2 - (a - geo.length / 2) * scale;
      sy = (c: number) => yMin + c * scale;
    } else {
      // The frame the effect is holding, or a fresh fit on the very first paint before
      // that effect has run.
      const frame = this.viewFrame() ?? this.fitFrame(geo, W);
      scale = frame.scale;
      // The port (pin) end draws to the left, so the along axis runs against screen x.
      sx = (a: number) => W / 2 - (a - frame.midA) * scale;
      // The pre-start side draws below the line, so across runs with screen y.
      sy = (c: number) => (yMin + yMax) / 2 + (c - frame.midC) * scale;
    }

    const portX = sx(geo.length), stbX = sx(0), lineY = sy(0);

    // Prefer the published length and bearing, falling back to the computed geometry.
    const length = this.lineLength() ?? geo.length;
    const lineBearingRad = this.lineBearing();
    const lineBearing = lineBearingRad != null
      ? (lineBearingRad * 180 / Math.PI + 360) % 360
      : geo.bearing;
    // The heading worth reporting is the one you sail to cross the line: perpendicular
    // to it, towards the course side. That is 90 degrees clockwise of the line bearing
    // (which runs starboard end -> port end), and in this line-up view it is always
    // straight up the screen.
    const startBearing = (lineBearing + 90) % 360;

    // The trailing arrow says the heading is the way to sail to start - in this line-up
    // view always straight up the screen - so it needs no separate arrowhead.
    const label = `${this.formatDistance(length)} \u00b7 ` +
      `${startBearing.toFixed(0).padStart(3, '0')}\u00b0T\u2191`;
    // Full size unless the label would run off a narrow widget.
    const font = Math.min(this.LABEL_FONT, (W - 8) / (label.length * 0.51));
    const labelY = lineY - font * 0.5;
    // Centred on the line, but held inside the drawing: the line can sit well off centre
    // when the fit has to reach out to a distant boat, and the label is often wider than
    // the line itself.
    const labelHalf = label.length * font * 0.51 / 2;
    const labelX = Math.min(
      Math.max((portX + stbX) / 2, labelHalf + 4), W - labelHalf - 4);

    const scene: IScene = {
      portX, stbX, lineY, ends: this.buildEnds(stbX, lineY, scale),
      label, labelX, labelY,
      projections: [], boat: null, vmgs: null,
      guides: [], legs: [], gun: null,
      vmgFont: 0, labelFont: font,
      // The arrow's angle only means anything beside the line it is measured against.
      wind: vmgMode ? null : this.buildWind(geo, W)
    };

    if (vmgMode) {
      // Nothing but the four values: the line, its ends and the wind are not drawn in
      // this mode, so the cross gets the whole frame and the largest text it will hold.
      this.buildVmgCross(scene, W, this.VB_TOP_BAND + 4, yMax);
    } else if (boat) {
      this.buildZone(scene, geo, sx, sy, W, scale);
      this.buildApproach(scene, geo, sx, sy, scale, W);
      this.buildBoat(scene, geo, sx(boat.a), sy(boat.c), lineY, boat.c < 0, scale);
    }
    return scene;
  });

  /**
   * Decide whether the line drawing keeps the view it has or takes a fresh one.
   *
   * Re-fitting on every position update means the scale changes every time the boat
   * moves, so the line slides and breathes under a boat that appears to stand still -
   * worst when approaching from a distance, where each update is a large fraction of
   * the span being fitted. Holding the frame inverts that: the line stays put and the
   * boat visibly closes on it.
   *
   * The trigger is how far the drawing has gone out of true rather than a count of
   * updates, because the need is not spread evenly over an approach: far out, an update
   * moves the boat a tiny fraction of the span and a re-fit would change nothing
   * visible, while closing in the same update is a large fraction. Counting updates
   * therefore re-fits too often early and too coarsely late, and its meaning changes
   * with the position source's update rate. Drift is indifferent to all of that.
   *
   * The frame is replaced when any of these is true:
   *  - there is no frame yet, or the drawing was resized, or the line itself changed
   *  - re-fitting now would move the drawing further than `viewSmoothing` percent
   *  - the boat would be drawn outside the viewBox under it, which must never wait
   *
   * @param smoothing Percent of the drawing's height the view may drift; 0 re-fits on
   *   every update.
   */
  private updateViewFrame(geo: ILineGeometry | null, W: number, vmgMode: boolean,
    smoothing: number | undefined): void {
    // VMG mode lays the line out for itself and never uses a fitted frame.
    if (!geo || vmgMode) {
      this.viewFrame.set(null);
      this.frameKey = null;
      return;
    }

    // A resize, or an edit to the line itself, invalidates the frame outright.
    const key = `${W}|${geo.length.toFixed(1)}`;
    const current = this.viewFrame();
    const tolerance = Math.max(0, smoothing ?? 10) / 100;

    if (!current || key !== this.frameKey
      || this.frameDrift(current, this.fitFrame(geo, W), geo, W) > tolerance
      || !this.lineFitsIn(current)
      || !this.boatFitsIn(current, geo, W)) {
      this.viewFrame.set(this.fitFrame(geo, W));
      this.frameKey = key;
    }
  }

  /**
   * How far re-fitting now would shift the drawing: the largest movement of either end
   * of the line, as a fraction of the drawing's height. Measuring the line's own ends
   * catches both a change of scale and a pure pan - the latter happens whenever the
   * across axis is the binding one and the boat works its way along the line.
   */
  private frameDrift(held: IViewFrame, ideal: IViewFrame, geo: ILineGeometry, W: number): number {
    const yMin = this.VB_TOP_BAND + this.LABEL_HEADROOM;
    const yMax = this.VB_HEIGHT - this.VB_BOTTOM_MARGIN;
    const at = (frame: IViewFrame, a: number) => ({
      x: W / 2 - (a - frame.midA) * frame.scale,
      y: (yMin + yMax) / 2 - frame.midC * frame.scale
    });
    let worst = 0;
    for (const a of [0, geo.length]) {
      const from = at(held, a), to = at(ideal, a);
      worst = Math.max(worst, Math.hypot(from.x - to.x, from.y - to.y));
    }
    return worst / Math.max(yMax - yMin, 1);
  }

  /** Fit the line and the boat, with the boat's drawn size allowed for. */
  private fitFrame(geo: ILineGeometry, W: number): IViewFrame {
    const margin = this.VB_MARGIN;
    const yMin = this.VB_TOP_BAND + this.LABEL_HEADROOM;
    const yMax = this.VB_HEIGHT - this.VB_BOTTOM_MARGIN;
    const boat = geo.boat;
    // The boat is drawn around its position, not at it, so the fit has to hold its
    // outline rather than just its centre or it gets clipped at the edge.
    const pad = boat ? this.boatHalfExtent(boat.c) : 0;

    const minA = Math.min(0, boat ? boat.a - pad : 0);
    const maxA = Math.max(geo.length, boat ? boat.a + pad : geo.length);
    const minC = Math.min(0, boat ? boat.c - pad : 0);
    const maxC = Math.max(0, boat ? boat.c + pad : 0);

    // Keep the across axis from collapsing when the boat is sitting on the line.
    const spanA = Math.max(maxA - minA, 1);
    const spanC = Math.max(maxC - minC, spanA * 0.35);
    return {
      scale: Math.min((W - 2 * margin) / spanA, (yMax - yMin) / spanC),
      midA: (minA + maxA) / 2,
      midC: (minC + maxC) / 2
    };
  }

  /**
   * Half the boat's drawn length, in metres. The outline's outer edge is the hull plus
   * a fifth of the boat's distance off the line (see buildBoat), and both of those are
   * model quantities, so this is independent of the scale and can be fed straight into
   * the fit.
   */
  private boatHalfExtent(c: number): number {
    const boatMetres = this.boatLength() ?? this.DEFAULT_BOAT_METRES;
    return (boatMetres + Math.abs(c) / 5) / 2;
  }

  /**
   * Whether the line itself is still clear of the bottom of the drawing under this
   * frame. The fit keeps it clear, but a frame held through several updates can drift,
   * and a line sitting on the bottom edge reads as one about to disappear.
   */
  private lineFitsIn(frame: IViewFrame): boolean {
    const yMin = this.VB_TOP_BAND + this.LABEL_HEADROOM;
    const yMax = this.VB_HEIGHT - this.VB_BOTTOM_MARGIN;
    const lineY = (yMin + yMax) / 2 - frame.midC * frame.scale;
    return lineY >= yMin && lineY <= yMax;
  }

  /** Whether the boat's whole outline still lands inside the viewBox under this frame. */
  private boatFitsIn(frame: IViewFrame, geo: ILineGeometry, W: number): boolean {
    const boat = geo.boat;
    if (!boat) return true;
    const yMin = this.VB_TOP_BAND + this.LABEL_HEADROOM;
    const yMax = this.VB_HEIGHT - this.VB_BOTTOM_MARGIN;
    const bx = W / 2 - (boat.a - frame.midA) * frame.scale;
    const by = (yMin + yMax) / 2 + (boat.c - frame.midC) * frame.scale;
    const radius = this.boatHalfExtent(boat.c) * frame.scale;
    return bx - radius >= 2 && bx + radius <= W - 2
      && by - radius >= this.VB_TOP_BAND && by + radius <= this.VB_HEIGHT - 2;
  }

  /**
   * The line's own extensions, and the 45 degree wedge off each end. Together these
   * bound the start zone: inside it the line is closed straight across, outside it the
   * boat must first run along the line to get in. The plugin decides its legs on exactly
   * this boundary, so drawing it is what makes the approach below explicable.
   */
  private buildZone(scene: IScene, geo: ILineGeometry, sx: (a: number) => number,
    sy: (c: number) => number, W: number, scale: number): void {
    // Far enough that every guide leaves the drawing rather than stopping inside it.
    const reach = (W + this.VB_HEIGHT) / Math.max(scale, 1e-6);
    const L = geo.length;
    const add = (a1: number, c1: number, a2: number, c2: number) =>
      scene.guides.push({ x1: sx(a1), y1: sy(c1), x2: sx(a2), y2: sy(c2) });

    // The line carried on past each end.
    add(0, 0, -reach, 0);
    add(L, 0, L + reach, 0);
    // The wedges: 45 degrees off each end, on both sides of the line.
    add(0, 0, -reach, reach);
    add(0, 0, -reach, -reach);
    add(L, 0, L + reach, reach);
    add(L, 0, L + reach, -reach);
  }

  /**
   * The approach the time to line is actually computed over, drawn as dimension lines.
   *
   * The plugin does not sail a bearing to work out the time to line. It takes two legs:
   * outside the start zone, the distance along the line needed to enter the zone divided
   * by the best VMG in that direction, plus the perpendicular distance to the line
   * divided by the best VMG across it. Drawing a straight line on the course that
   * happened to record the best sample - which is what the faint line used to be - shows
   * a different quantity from the number beside it, which is why it read as nothing in
   * particular.
   *
   * So this draws the legs themselves, at their true lengths, with a mark showing how far
   * along them the boat gets by the gun. Nobody sails parallel to the line and then turns
   * ninety degrees, so the legs are styled as dimension lines: they are a measurement,
   * not a course.
   */
  private buildApproach(scene: IScene, geo: ILineGeometry, sx: (a: number) => number,
    sy: (c: number) => number, scale: number, W: number): void {
    const boat = geo.boat;
    if (!boat) return;
    const L = geo.length, a = boat.a, c = boat.c;
    const ocs = c < 0;
    const across = Math.abs(c);

    // How far past an end the boat lies, and which way it would have to run to get back.
    let overshoot = 0, beyondPort = false;
    if (a > L) { overshoot = a - L; beyondPort = true; } else if (a < 0) { overshoot = -a; }

    // Inside the 45 degree wedge the zone leg vanishes: the boat can close straight
    // across. Outside it, the corner sits where the wedge meets the boat's own offset.
    const toZone = Math.max(0, overshoot - across);
    const cornerA = toZone > 0 ? (beyondPort ? L + across : -across) : a;

    // The VMGs the plugin would use for these legs: the collected best, or whatever the
    // boat is achieving right now if that is better - which is what computeTimeToLine
    // does, so the drawing matches the published time rather than undercutting it.
    const parallelName: TVmgName = beyondPort ? 'toStbEnd' : 'toPortEnd';
    const normalName: TVmgName = ocs ? 'fromCourseSide' : 'toCourseSide';
    // Prefer what the plugin says it used; fall back to deriving it the same way when
    // running against a version that does not publish it.
    const parallel = this.effVmgAlongLine() ?? this.deriveEffectiveVmg(parallelName, geo.bearing);
    const normal = this.effVmgToLine() ?? this.deriveEffectiveVmg(normalName, geo.bearing);

    // Each leg is labelled with how far it is - a dimension states a distance - while the
    // VMG it would be sailed at stays on the hover text and on the VMG tab.
    if (toZone > 0) {
      scene.legs.push(this.buildLeg(
        sx(a), sy(c), sx(cornerA), sy(c), true, this.formatDistance(toZone),
        `Along the line to the start zone at `
        + `${VMG_TITLE[parallelName].replace('Best VMG ', '')}`, W));
    }
    if (across > 0) {
      scene.legs.push(this.buildLeg(
        sx(cornerA), sy(c), sx(cornerA), sy(0), false, this.formatDistance(across),
        `Across to the line at `
        + `${VMG_TITLE[normalName].replace('Best VMG ', '')}`, W));
    }

    // Where the boat gets to by the gun, walked along those legs at those VMGs. Short of
    // the line is late, past it is over early - the same reading as the COG projection,
    // but as a position along a route rather than the tip of a floating bearing.
    const tts = this.timeToStart();
    if (!this.timerRunning() || tts == null || tts <= 0) return;
    // A leg with no VMG behind it costs no time, which is what computeTimeToLine does:
    // it simply omits that term. Treating it as unreachable instead stalled the mark on
    // the boat, so it never showed the across leg at all.
    const alongTime = parallel > 0 ? toZone / parallel : 0;
    let gunA: number, gunC: number;
    if (tts <= alongTime) {
      const run = parallel * tts;
      gunA = beyondPort ? a - run : a + run;
      gunC = c;
    } else {
      if (!(normal > 0)) return;
      // Clamped a little past the line: a long countdown runs the mark off the drawing.
      const run = Math.min(normal * (tts - alongTime), across + 400 / Math.max(scale, 1e-6));
      gunA = cornerA;
      gunC = ocs ? c + run : c - run;
    }
    scene.gun = {
      x: sx(gunA), y: sy(gunC),
      title: 'Where you reach at the gun, sailing these legs at these VMGs'
    };
  }

  /** One leg of the approach, as a dimension line with end ticks and a labelled break. */
  private buildLeg(x1: number, y1: number, x2: number, y2: number, horizontal: boolean,
    label: string, title: string, W: number): ISceneLeg {
    const tick = 5;
    const ticks = horizontal
      ? `M${x1},${y1 - tick} L${x1},${y1 + tick} M${x2},${y2 - tick} L${x2},${y2 + tick}`
      : `M${x1 - tick},${y1} L${x1 + tick},${y1} M${x2 - tick},${y2} L${x2 + tick},${y2}`;

    // A dimension's value sits in a break in the rule, but a short leg has no room for
    // one - and the along-line leg is often very short, the boat being just outside the
    // wedge. Below that, the label goes outside the far tick instead, the way a drawing
    // takes a dimension outside its own extension lines.
    const length = Math.hypot(x2 - x1, y2 - y1);
    const roomy = length > label.length * 9 + 16;
    let labelX: number, labelY: number, anchor: ISceneLeg['anchor'];
    if (horizontal) {
      if (roomy) {
        labelX = (x1 + x2) / 2;
        labelY = (y1 + y2) / 2 - 6;
        anchor = 'middle';
      } else {
        // Out past the corner and below the rule: the boat sits on this leg's other end,
        // and the across leg runs up from the corner, so this corner is the free quarter.
        labelX = x1 < x2 ? x2 + 8 : x2 - 8;
        labelY = (y1 + y2) / 2 + 17;
        anchor = x1 < x2 ? 'start' : 'end';
      }
    } else {
      labelX = x1 + 8;
      anchor = 'start';
      labelY = roomy ? (y1 + y2) / 2 + 5 : (y1 < y2 ? y1 - 8 : y1 + 14);
    }
    // Held inside the drawing: a label pushed outside a short leg can otherwise run off
    // the edge, which is exactly when it gets pushed out.
    const width = label.length * 9;
    const lead = anchor === 'end' ? width : anchor === 'middle' ? width / 2 : 0;
    const trail = anchor === 'start' ? width : anchor === 'middle' ? width / 2 : 0;
    labelX = Math.min(Math.max(labelX, lead + 3), Math.max(W - trail - 3, lead + 3));

    return { x1, y1, x2, y2, ticks, label, title, labelX, labelY, anchor };
  }

  /**
   * A distance in metres, in whatever length unit the widget is configured for - so the
   * legs, and the line's own length, all read in the same units.
   *
   * @param unit Defaults to the unit the line length is displayed in.
   */
  private formatDistance(metres: number, unit?: string): string {
    const to = unit ?? this.lengthUnit();
    const value = this.units.convertToUnit(to, metres) ?? metres;
    // Nautical miles and kilometres need decimals to say anything at these distances.
    const decimals = to === 'nm' || to === 'km' || to === 'mi' ? 2 : 0;
    return `${value.toFixed(decimals)}${this.unitSuffix(to)}`;
  }

  /**
   * The VMG the plugin would divide a leg by: the collected best, or the one the boat is
   * achieving right now if that is better - the same rule as the plugin's own
   * effectiveVmg. Only used against a plugin that does not publish that directly.
   * Returned in metres per second, whatever unit the path is displayed in.
   */
  private deriveEffectiveVmg(name: TVmgName, lineBearingDeg: number): number {
    const display = this.bestVmg()[name];
    const unit = this.vmgUnit();
    const perBaseUnit = this.units.convertToUnit(unit, 1) || 1;
    let best = display == null ? 0 : display / perBaseUnit;

    const cog = this.cog(), sog = this.sog();
    if (cog != null && sog != null) {
      const angle = cog - lineBearingDeg * Math.PI / 180;
      // Positive towards the course side, and towards the port end, matching the
      // plugin's own decomposition.
      const normal = sog * Math.sin(angle);
      const tangent = sog * Math.cos(angle);
      const instant = name === 'toCourseSide' ? normal
        : name === 'fromCourseSide' ? -normal
          : name === 'toPortEnd' ? tangent : -tangent;
      if (instant > 0) best = Math.max(best, instant);
    }
    // The same floor the plugin puts under its effective VMGs, so this fallback agrees
    // with the published time to line rather than undercutting it.
    return Math.max(best, MIN_EFFECTIVE_VMG);
  }

  /**
   * An arrow in the top corner showing where the wind sits relative to the line.
   *
   * The whole drawing is rotated so the line lies flat, which is what makes the wind
   * worth drawing here: against a fixed line the arrow's angle *is* the wind's angle to
   * the line, so which end is favoured can be read off it directly without doing the
   * arithmetic between two bearings. It points downwind - the way the air is going - and
   * is drawn faintly, being context rather than part of the approach.
   */
  private buildWind(geo: ILineGeometry, W: number): IScene['wind'] {
    const from = this.twd();
    if (from == null) return null;

    // Downwind, in the drawing's own frame.
    const dir = screenVector(from + Math.PI, geo.bearing);
    // Kept clear of the viewBox edges at its full size, whichever way it points.
    const cx = W - 40, cy = 38;
    const perp = { x: -dir.y, y: dir.x };
    const at = (fwd: number, side: number) =>
      `${(cx + dir.x * fwd + perp.x * side).toFixed(1)},${(cy + dir.y * fwd + perp.y * side).toFixed(1)}`;
    // Tip, head barbs, then the shaft back to the tail.
    const points = [
      at(30, 0), at(4, 16), at(4, 6), at(-30, 6),
      at(-30, -6), at(4, -6), at(4, -16)
    ].join(' ');

    const degrees = ((from * 180 / Math.PI) % 360 + 360) % 360;
    // Angle off the line, so the reading the arrow gives has a number behind it.
    const offLine = (((from * 180 / Math.PI) - geo.bearing) % 360 + 360) % 360;
    const acute = offLine > 180 ? 360 - offLine : offLine;
    return {
      points,
      title: `Wind from ${degrees.toFixed(0).padStart(3, '0')}\u00b0T, `
        + `${acute.toFixed(0)}\u00b0 to the line`
    };
  }

  /**
   * The pin and the committee boat marking the ends. Both stand for a 10m object, drawn
   * at an exaggerated multiple of the line's own scale and then clamped, so they read as
   * landmarks whether the drawing is zoomed out to a distant line or in on a close one.
   */
  private buildEnds(stbX: number, lineY: number, scale: number): ISceneEnds {
    const size = Math.min(Math.max(
      this.END_METRES * scale * this.END_EXAGGERATION, 12), 40);
    // The committee boat's shape is drawn at 24 units wide, so scale it to `size`.
    const k = size / 24;
    return {
      pinRadius: size * 0.29,
      hull: `${stbX - 13 * k},${lineY - 4 * k} ${stbX + 11 * k},${lineY - 4 * k} ` +
        `${stbX + 9 * k},${lineY + 4 * k} ${stbX - 7 * k},${lineY + 4 * k}`,
      cabin: { x: stbX - 3 * k, y: lineY - 10 * k, width: 9 * k, height: 6 * k }
    };
  }

  /**
   * The boat, and the projection running from it along the current COG.
   *
   * While the timer counts down the projection runs for the distance the boat will
   * actually cover before the gun, so its tip shows where it gets to at zero: short of
   * the line is late, beyond it is early. With no timer running there is nothing to
   * project against, so it degrades to a short stub showing course only.
   */
  private buildBoat(scene: IScene, geo: ILineGeometry, bx: number, by: number,
    lineY: number, ocs: boolean, scale: number): void {
    // Clamped past the far corner of the viewBox: a long countdown projects well off
    // the drawing, and it is clipped there anyway.
    const tts = this.timeToStart() ?? 0;
    const project = (speed: number) => Math.min(speed * tts * scale, 600);

    let courseLabel: string | null = null;
    const cog = this.cog();
    if (cog != null) {
      const running = this.timerRunning() && tts > 0;
      const v = screenVector(cog, geo.bearing);
      const sog = this.sog();

      if (running) {
        if (sog != null) {
          const len = project(sog);
          scene.projections.push({
            x1: bx, y1: by, x2: bx + v.x * len, y2: by + v.y * len,
            width: 6, opacity: 0.55, title: LEGEND_CURRENT
          });
          courseLabel = LEGEND_CURRENT;
        }
      } else {
        scene.projections.push({
          x1: bx, y1: by, x2: bx + v.x * 40, y2: by + v.y * 40,
          width: 6, opacity: 0.55, title: LEGEND_STUB
        });
        courseLabel = LEGEND_STUB;
      }
    }

    const heading = this.heading() ?? cog;
    const v = heading != null ? screenVector(heading, geo.bearing) : { x: 0, y: -1 };
    const dx = v.x, dy = v.y, px = -dy, py = dx;

    // The hull is drawn at the drawing's own scale, so the boat measures truly against
    // the line - which leaves it tiny whenever the fit has zoomed out to reach a distant
    // boat. So what is drawn is the band between the true hull and a scaled-up copy of
    // it: the inner edge is always the vessel's real size, and the outer grows with how
    // far the boat is standing off, reaching twice the hull at five boat lengths out.
    // Scaling the outline, rather than thickening a stroke around it, keeps the band a
    // boat shape at any thickness - a uniform stroke would fatten the beam as much as
    // the length and blot the hull into a lozenge.
    const boatMetres = this.boatLength() ?? this.DEFAULT_BOAT_METRES;
    const hullLength = Math.min(Math.max(boatMetres * scale, 6), 200);
    // Floored so the band cannot close to nothing as the boat settles onto the line.
    const outerLength = Math.max(hullLength + Math.abs(by - lineY) / 5, hullLength + 9);
    // A point on the hull, given in boat coordinates: forward, and out to starboard.
    const at = (fwd: number, stbd: number) =>
      `${(bx + dx * fwd + px * stbd).toFixed(1)},${(by + dy * fwd + py * stbd).toFixed(1)}`;
    // Outer first, then the true hull: filled even-odd, the second knocks a hole in the
    // first and what is left is the outline.
    const path = `${this.hullPath(at, outerLength)} ${this.hullPath(at, hullLength)}`;

    // Hovering the boat reports what it is doing, and says what the line running from
    // it means - it is only described here, to keep the drawing uncluttered.
    const tip = [`SOG ${this.formatKnots(this.sog())}  COG ${this.formatBearing(cog)}`];
    if (courseLabel) tip.push(courseLabel);

    scene.boat = { path, ocs, title: tip.join('\n') };
  }

  /**
   * One closed hull outline of the given length, centred on the boat and pointing along
   * it: a fine entry at the bow, maximum beam a little aft of midships, and a transom
   * across the stern.
   *
   * @param at Maps a point in boat coordinates - forward, and out to starboard - to the
   *   drawing.
   * @param length Overall length of this outline, in viewBox units.
   */
  private hullPath(at: (fwd: number, stbd: number) => string, length: number): string {
    const h = length / 2, b = length * this.HULL_BEAM_RATIO / 2;
    return `M${at(h, 0)} C${at(h * 0.55, b * 0.42)} ${at(-h * 0.15, b)} ${at(-h, b * 0.55)}` +
      ` L${at(-h, -b * 0.55)} C${at(-h * 0.15, -b)} ${at(h * 0.55, -b * 0.42)} ${at(h, 0)} Z`;
  }

  /**
   * The four best VMGs as a cross, laid out to match the drawing it sits in: course
   * side up, from the course side down, and the port and starboard ends left and right.
   * It stands where the boat would be, clamped so it stays inside the viewBox.
   */
  private buildVmgCross(scene: IScene, W: number, top: number, yMax: number): void {
    // The cross owns the whole drawing area. The width splits into three columns: the port end alone on the left, the across-line
    // pair stacked close together in the middle, and the starboard end alone on the
    // right - which still matches the drawing above, course side up and port to the
    // left, while giving each value a third of the width to grow into.
    const availH = Math.max(yMax - top, 1);
    const values = this.bestVmg(), overrides = this.vmgOverride();
    const selected = this.selectedVmg();
    const texts: Record<TVmgName, string> = {
      toCourseSide: this.formatVmg(values.toCourseSide),
      toPortEnd: this.formatVmg(values.toPortEnd),
      toStbEnd: this.formatVmg(values.toStbEnd),
      fromCourseSide: this.formatVmg(values.fromCourseSide)
    };

    // Sized off the values actually showing rather than a worst case, at roughly 0.56em
    // a character. The budget is the text alone, not the selection box around it: only
    // one value is boxed at a time and a little overhang into the neighbouring column
    // costs nothing, whereas paying for it here would shrink all four. The stacked pair
    // sets the height: separated by 1.05em, they stand about 1.95em tall together.
    const widestEm = Math.max(...VMG_NAMES.map(n => texts[n].length * 0.56));
    const font = Math.min((W / 3 - 8) / widestEm, availH / 1.95, 96);
    const gap = font * 1.05;
    const y = top + availH / 2;

    const centres: Record<TVmgName, { x: number; y: number }> = {
      toCourseSide: { x: W / 2, y: y - gap / 2 },
      toPortEnd: { x: W / 6, y },
      toStbEnd: { x: W * 5 / 6, y },
      fromCourseSide: { x: W / 2, y: y + gap / 2 }
    };

    scene.vmgFont = font;
    scene.vmgs = VMG_NAMES.map(name => {
      const text = texts[name];
      const centre = centres[name];
      // Digits sit between the baseline and 0.72em above it, so the visual centre is
      // 0.36em up: drop the baseline to put that centre on the column's centre, and
      // hang the box off it rather than off the baseline.
      const baseline = centre.y + font * 0.36;
      const width = (text.length * 0.56 + 0.18) * font;
      const height = font * 1.02;
      // The box is wider than its text, so on the outer columns it can reach past the
      // edge: nudged back inside rather than clipped, since a few units off centre on a
      // box this wide does not read.
      const boxX = Math.min(Math.max(centre.x - width / 2, 1), Math.max(W - width - 1, 1));
      return {
        name, x: centre.x, y: baseline, text,
        box: { x: boxX, y: centre.y - height / 2, width, height },
        overridden: overrides[name] != null,
        selected: selected === name,
        title: VMG_TITLE[name]
      };
    });
  }

  /** Label on the VMG select button: the arrow shows where the value sits on the cross. */
  private latLon(latitude: number | null, longitude: number | null): ILatLon | null {
    return latitude == null || longitude == null ? null : { latitude, longitude };
  }

  private unitSuffix(unit: string | null | undefined): string {
    if (!unit) return '';
    if (unit === 'feet') return '′';
    if (unit === 'knots') return 'kn';
    return unit;
  }

  private formatVmg(value: number | null): string {
    return value == null ? '--' : value.toFixed(this.numDecimal());
  }

  private formatKnots(metresPerSecond: number | null): string {
    return metresPerSecond == null ? '--'
      : `${(this.units.convertToUnit('knots', metresPerSecond) ?? 0).toFixed(1)}kn`;
  }

  private formatBearing(radians: number | null): string {
    if (radians == null) return '--';
    const degrees = ((radians * 180 / Math.PI) % 360 + 360) % 360;
    return `${degrees.toFixed(0).padStart(3, '0')}°T`;
  }

  /** Previous trace sample, for differencing the ground actually covered. */
  private lastTrace: { at: number; a: number; c: number } | null = null;
  /** Running totals, which average out the noise in any single pair of samples. */
  private traceTotals = { seconds: 0, ground: 0, bySog: 0 };

  /**
   * Log one row of the approach, when the console has set
   * `window.kipRacerStartLineDebug = true`. Rows also accumulate in
   * `window.kipRacerStartLineTrace` so a whole run can be copied out at once.
   *
   * The point of the trace is one invariant. While COG and SOG hold steady, the tip of
   * the current-course projection sits a fixed distance from the line: the boat closes
   * the line at `vPerp` and the projection shortens at exactly the same rate, so
   * `gapAtGun = across - vPerp * timeToStart` should not move. If it drifts - the tip
   * creeping towards and through the line as the countdown runs - then the boat is
   * covering more ground than its reported COG and SOG account for, or the countdown is
   * running at the wrong rate.
   *
   * `sogRatio` separates those: it is the speed the boat actually made good between
   * fixes over the SOG it reported, so a value steady above 1 is the boat over-running
   * its own SOG, while a ratio of 1 with a drifting gap points at the clock instead.
   * `trackDeg` against `cogDeg` does the same for direction - the bearing the boat
   * actually moved on, against the one it claims. `ratioCumulative` is the same
   * comparison over the whole run rather than one pair of fixes, so it is the number to
   * trust: a single pair is at the mercy of when the fixes happened to land.
   */
  private traceApproach(geo: ILineGeometry | null): void {
    if (!window.kipRacerStartLineDebug) {
      this.lastTrace = null;
      this.traceTotals = { seconds: 0, ground: 0, bySog: 0 };
      return;
    }
    if (!geo?.boat) return;

    // Signal K's own timestamp for the fix where there is one, so the interval is the
    // one the position actually moved over rather than whenever the browser saw it.
    const wallClock = Date.now();
    const now = this.fixTime() ?? wallClock;
    const { a, c } = geo.boat;
    const previous = this.lastTrace;
    if (previous && now === previous.at) return; // same fix redelivered
    this.lastTrace = { at: now, a, c };

    const sog = this.sog();
    const cog = this.cog();
    const tts = this.timeToStart();
    // The line is crossed towards the course side, 90 degrees clockwise of the line
    // bearing, so that is the direction the boat has to close in.
    const bearingRad = geo.bearing * Math.PI / 180;
    const startBearing = bearingRad + Math.PI / 2;
    // Closing speed the reported COG/SOG accounts for, and the gap the projection tip
    // should therefore hold against the line.
    const vPerpFromSog = sog != null && cog != null ? sog * Math.cos(cog - startBearing) : null;
    const gapAtGun = vPerpFromSog != null && tts != null ? c - vPerpFromSog * tts : null;

    // What the boat actually did on the ground since the last fix.
    let dt: number | null = null;
    let vPerpMeasured: number | null = null;
    let sogMeasured: number | null = null;
    let trackDeg: number | null = null;
    if (previous) {
      dt = (now - previous.at) / 1000;
      if (dt > 0.05) {
        const alongDelta = a - previous.a, acrossDelta = c - previous.c;
        vPerpMeasured = -acrossDelta / dt;
        sogMeasured = Math.hypot(alongDelta, acrossDelta) / dt;
        // Back out of the along/across frame into a compass bearing: along runs on the
        // line's bearing, across 90 degrees anticlockwise of it.
        const east = alongDelta * Math.sin(bearingRad) + acrossDelta * Math.sin(bearingRad - Math.PI / 2);
        const north = alongDelta * Math.cos(bearingRad) + acrossDelta * Math.cos(bearingRad - Math.PI / 2);
        if (Math.hypot(east, north) > 0.01) {
          trackDeg = ((Math.atan2(east, north) * 180 / Math.PI) % 360 + 360) % 360;
        }
        if (sog != null) {
          this.traceTotals.seconds += dt;
          this.traceTotals.ground += sogMeasured * dt;
          this.traceTotals.bySog += sog * dt;
        }
      }
    }

    const round = (value: number | null, places = 2) =>
      value == null || !Number.isFinite(value) ? null : Number(value.toFixed(places));

    const row = {
      time: new Date(now).toISOString().slice(11, 23),
      // How far the browser lagged the fix, to show the clock is not the confound.
      lagMs: round(wallClock - now, 0),
      dt: round(dt),
      // Perpendicular distance to the line, positive on the pre-start side.
      across: round(c, 1),
      // Distance along the line from the starboard end towards the port end.
      along: round(a, 1),
      timeToStart: round(tts, 1),
      sogReported: round(sog, 3),
      sogMeasured: round(sogMeasured, 3),
      sogRatio: round(sogMeasured != null && sog ? sogMeasured / sog : null, 3),
      // The same comparison over the whole run, which is the one to trust.
      ratioCumulative: round(this.traceTotals.bySog > 0
        ? this.traceTotals.ground / this.traceTotals.bySog : null, 3),
      cogDeg: round(cog == null ? null : ((cog * 180 / Math.PI) % 360 + 360) % 360, 1),
      // The bearing the boat actually moved on, which should match cogDeg.
      trackDeg: round(trackDeg, 1),
      startBearingDeg: round((geo.bearing + 90) % 360, 1),
      vPerpFromSog: round(vPerpFromSog, 3),
      vPerpMeasured: round(vPerpMeasured, 3),
      // Should hold constant while COG and SOG do. Positive: short of the line at the
      // gun. Negative: over it.
      gapAtGun: round(gapAtGun, 1)
    };

    (window.kipRacerStartLineTrace ??= []).push(row);
    console.log('[racer-start-line]', row);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }
}
