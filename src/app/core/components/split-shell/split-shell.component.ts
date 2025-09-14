import { Component, computed, effect, inject, signal, untracked, NgZone, ElementRef, viewChild } from '@angular/core';
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
export class SplitShellComponent {
  private readonly panelEl = viewChild.required<ElementRef<HTMLElement>>('panel');
  private readonly _settings = inject(AppSettingsService);
  private readonly _dashboard = inject(DashboardService);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly ngZone = inject(NgZone);
  public readonly side = signal<'left' | 'right'>(this._settings.getSplitShellSide());
  // Stored as ratio (0-1)
  public panelRatio = signal<number>(this._settings.getSplitShellWidth());
  public panelWidth = signal<number>(0); // derived pixels
  public panelCollapsed = signal<boolean>(this._settings.getSplitShellCollapsed());

  // Derived runtime forced collapse when active dashboard has collapseFreeboardShell flag
  public forceCollapsed = computed(() => !!this._dashboard.dashboards()[this._dashboard.activeDashboard()]?.collapseFreeboardShell);

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
    return this.handset().matches && !this.forceCollapsed();
  });
  public showHandle = computed(() => {
    return !this.forceCollapsed() && !this.panelCollapsed() && this.canResize();
  });
  public canResize = computed(() => {
    return !this._dashboard.isDashboardStatic() && !this.forceCollapsed();
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

  constructor() {
    // Compute pixel width from ratio on init and when window resizes
    const recomputeWidth = () => {
      const host = this.panelEl()?.nativeElement.parentElement as HTMLElement | null;
      if (!host) return;
      const total = host.clientWidth;
      this.panelWidth.set(Math.round(total * this.panelRatio()));
    };
    window.addEventListener('resize', recomputeWidth, { passive: true });
    // initial
    queueMicrotask(recomputeWidth);

    effect(() => {
      const forceCollapsed = this.forceCollapsed();
      untracked(() => {
        if (forceCollapsed) {
          this.panelCollapsed.set(true);
        } else {
          // restore persisted user collapse state
          this.panelCollapsed.set(this._settings.getSplitShellCollapsed());
        }
      });
    });

    effect(() => {
      // Recompute width when ratio changes
      this.panelRatio();
      recomputeWidth();
      if (this.chartplotterModeInPortrait()) {
        // allow gridstack to recompute internal layout
        setTimeout(() => window.dispatchEvent(new Event('resize')), 0);
      }
    });

    effect(() => {
      // Orientation mode change triggers resize for gridstack
      this.chartplotterModeInPortrait();
      setTimeout(() => window.dispatchEvent(new Event('resize')), 0);
    });
  }

  public toggleCollapse(): void {
    if (this.forceCollapsed()) return;
    const next = !this.panelCollapsed();
    this.panelCollapsed.set(next);
    // Persist only when not forced
    this._settings.setSplitShellCollapsed(next);
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
      this.panelRatio.set(ratio);
    });
    if (!this.forceCollapsed()) {
      // Persist within Angular (already in zone if called from pointerup listener outside zone)
      if (NgZone.isInAngularZone()) {
        this._settings.setSplitShellWidth(this.panelRatio());
      } else {
        this.ngZone.run(() => this._settings.setSplitShellWidth(this.panelRatio()));
      }
    }
  }

  private updateGhostTransform(width: number) {
    // Translate ghost line from its anchored side
    if (this.side() === 'left') {
      this.ghostTransform.set(`translateX(${width}px)`);
    } else {
      this.ghostTransform.set(`translateX(-${width}px)`);
    }
  }
}
