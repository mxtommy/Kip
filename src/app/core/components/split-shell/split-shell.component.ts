import { Component, computed, effect, inject, signal, NgZone, ElementRef, viewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppSettingsService } from '../../services/app-settings.service';
import { DashboardService } from '../../services/dashboard.service';
import { WidgetFreeboardskComponent } from '../../../widgets/widget-freeboardsk/widget-freeboardsk.component';
import { DashboardComponent } from '../dashboard/dashboard.component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'split-shell',
  imports: [CommonModule, WidgetFreeboardskComponent, DashboardComponent, MatButtonModule, MatIconModule],
  templateUrl: './split-shell.component.html',
  styleUrl: './split-shell.component.scss'
})
export class SplitShellComponent implements OnDestroy {
  private readonly panelEl = viewChild.required<ElementRef<HTMLElement>>('panel');
  private readonly _settings = inject(AppSettingsService);
  private readonly _dashboard = inject(DashboardService);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly ngZone = inject(NgZone);
  public readonly side = signal<'left' | 'right'>(this._settings.getSplitShellSide());
  // Stored as ratio (0-1)
  public panelRatio = signal<number>(this._settings.getSplitShellWidth());
  private originalPanelRatio: number | null = null; // captured when entering edit (non-static) mode
  public panelWidth = signal<number>(0); // derived pixels
  public panelCollapsed = computed(() => !!this._dashboard.dashboards()[this._dashboard.activeDashboard()]?.collapseSplitShell);
  protected fskShellSwipeDisabled = toSignal(this._settings.getSplitShellSwipeDisabledAsO());

  // Only show toggle on handset (portrait) per requirement
  private handset$ = this.breakpointObserver.observe(Breakpoints.HandsetPortrait);
  private handset = toSignal(this.handset$, { initialValue: { matches: false, breakpoints: {} } });

  // Minimal stub for widget-freeboardsk required input
  public freeboardWidgetStub: { uuid: string; type: string; config: Record<string, unknown> } = {
    uuid: 'persistent-freeboard-shell',
    type: 'widget-freeboardsk',
    config: {}
  };

  public chartplotterModeInPortrait = computed(() => {
    return this.handset().matches && !this.panelCollapsed();
  });
  public canResize = computed(() => {
    return !this._dashboard.isDashboardStatic() && !this.panelCollapsed();
  });

  // Resize state
  private resizing = false;
  private startX = 0;
  private startW = 0;
  // Bound listeners (added only while resizing)
  private readonly boundMove = (ev: PointerEvent) => this.onMove(ev);
  private readonly boundUp = () => this.onUp();
  // Minimal pixel change before emitting an update
  private static readonly MIN_DELTA_PX = 1;
  // Ghost resize state
  public ghostActive = signal<boolean>(false); // template *ngIf
  public ghostTransform = signal<string>(''); // inline style
  private ghostWidth = 0; // candidate width while dragging

  // Recompute panel pixel width from current ratio
  private readonly recomputeWidth = () => {
    const host = this.panelEl()?.nativeElement.parentElement as HTMLElement | null;
    if (!host) return;
    const total = host.clientWidth;
    this.panelWidth.set(Math.round(total * this.panelRatio()));
  };

  constructor() {
    window.addEventListener('resize', this.recomputeWidth, { passive: true });
    queueMicrotask(this.recomputeWidth);


    effect(() => {
      this.chartplotterModeInPortrait();
      this.panelRatio();
      this.recomputeWidth();
      setTimeout(() => window.dispatchEvent(new Event('resize')), 0);
    });

    // Track transitions into edit mode to snapshot original ratio
    effect(() => {
      const isStatic = this._dashboard.isDashboardStatic();
      if (!isStatic) {
        // entering edit mode
        if (this.originalPanelRatio === null) {
          this.originalPanelRatio = this.panelRatio();
        }
      }
      if (isStatic && this.originalPanelRatio !== null) {
        // leaving edit mode (save or cancel) handled by explicit events below
        // do nothing here; explicit events decide persistence or revert
      }
    });

    // Persist only when dashboard signals a save
    effect(() => {
      this._dashboard.layoutEditSaved(); // dependency
      // If saved while in edit mode, commit current ratio to settings
      if (this.originalPanelRatio !== null) {
        const r = this.panelRatio();
        this._settings.setSplitShellWidth(r);
        this.originalPanelRatio = null;
      }
    });

    // Revert on cancel
    effect(() => {
      this._dashboard.layoutEditCanceled(); // dependency
      if (this.originalPanelRatio !== null) {
        const revert = this.originalPanelRatio;
        this.panelRatio.set(revert);
        queueMicrotask(() => this.recomputeWidth());
        this.originalPanelRatio = null;
      }
    });
  }

  public startResize(ev: PointerEvent): void {
    if (!this.canResize()) return;
    this.resizing = true;
    this.startX = ev.clientX;
    this.startW = this.panelWidth();
    this.ghostWidth = this.startW; // initial
    this.ghostActive.set(true);
    this.updateGhostTransform(this.startW);
    (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
    // Attach listeners only for active resize (outside Angular for perf)
    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('pointermove', this.boundMove, { passive: true });
      window.addEventListener('pointerup', this.boundUp, { passive: true });
    });
  }

  protected onMove(ev: PointerEvent): void {
    if (!this.resizing) return;
    const delta = this.side() === 'left' ? (ev.clientX - this.startX) : (this.startX - ev.clientX);
    // Constrain between 10% and 90% of container
    const host = this.panelEl()?.nativeElement.parentElement as HTMLElement | null;
    const total = host?.clientWidth ?? 1;
    const raw = this.startW + delta;
    const minPx = total * 0.1;
    const maxPx = total * 0.9;
    const newW = Math.min(maxPx, Math.max(minPx, raw));
    if (Math.abs(newW - this.ghostWidth) < SplitShellComponent.MIN_DELTA_PX) return;
    this.ghostWidth = newW;
    // Update ghost transform outside Angular; no width mutation to shell to avoid layout churn
    this.ngZone.runOutsideAngular(() => this.updateGhostTransform(newW));
  }

  protected onUp(): void {
    if (!this.resizing) return;
    this.resizing = false;
    // Remove transient listeners
    window.removeEventListener('pointermove', this.boundMove);
    window.removeEventListener('pointerup', this.boundUp);
    // Commit ghost width to actual panel now
    const finalW = this.ghostWidth;
    this.ghostActive.set(false);
    // Apply width instantly (mutate DOM) then update signal in zone
    const panelRef = this.panelEl();
    if (panelRef && !this.panelCollapsed()) {
      panelRef.nativeElement.style.width = finalW + 'px';
    }
    this.ngZone.run(() => {
      this.panelWidth.set(finalW);
      const host = this.panelEl()?.nativeElement.parentElement as HTMLElement | null;
      const total = host?.clientWidth ?? finalW;
      const ratio = total ? finalW / total : 0.3;
      const prev = this.panelRatio();
      if (Math.abs(ratio - prev) > 0.0005) {
        this.panelRatio.set(ratio);
        // DO NOT persist here; defer until layoutEditSaved effect
      }
    });
  }

  private updateGhostTransform(width: number) {
    // Translate ghost line from its anchored side
    if (this.side() === 'left') {
      this.ghostTransform.set(`translateX(${width}px)`);
    } else {
      this.ghostTransform.set(`translateX(-${width}px)`);
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.recomputeWidth);
    if (this.resizing) {
      window.removeEventListener('pointermove', this.boundMove);
      window.removeEventListener('pointerup', this.boundUp);
    }
  }
}
