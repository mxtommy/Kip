import { Component, computed, effect, inject, signal, untracked, NgZone, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppSettingsService } from '../../services/app-settings.service';
import { DashboardService } from '../../services/dashboard.service';
import { WidgetFreeboardskComponent } from '../../../widgets/widget-freeboardsk/widget-freeboardsk.component';
import { DashboardComponent } from '../dashboard/dashboard.component';
import { MatButtonModule } from '@angular/material/button';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'freeboard-split',
  imports: [CommonModule, WidgetFreeboardskComponent, DashboardComponent, MatButtonModule],
  templateUrl: './freeboard-split.component.html',
  styleUrl: './freeboard-split.component.scss'
})
export class FreeboardSplitComponent {
  private readonly _settings = inject(AppSettingsService);
  private readonly _dashboard = inject(DashboardService);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly ngZone = inject(NgZone);
  public readonly side = signal<'left' | 'right'>(this._settings.getFreeboardShellSide());
  public panelWidth = signal<number>(this._settings.getFreeboardShellWidth());
  public panelCollapsed = signal<boolean>(this._settings.getFreeboardShellCollapsed());

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

  // Resize state
  private resizing = false;
  private startX = 0;
  private startW = 0;
  // Bound listeners (added only while resizing)
  private readonly boundMove = (ev: PointerEvent) => this.onMove(ev);
  private readonly boundUp = () => this.onUp();
  // Minimal pixel change before emitting an update
  private static readonly MIN_DELTA_PX = 1;
  @ViewChild('panel', { static: true }) private panelEl?: ElementRef<HTMLElement>;
  // Ghost resize state
  public ghostActive = signal<boolean>(false); // template *ngIf
  public ghostTransform = signal<string>(''); // inline style
  private ghostWidth = 0; // candidate width while dragging

  constructor() {
    effect(() => {
      const forceCollapsed = this.forceCollapsed();
      untracked(() => {
        if (forceCollapsed) {
          this.panelCollapsed.set(true);
        } else {
          // restore persisted user collapse state
          this.panelCollapsed.set(this._settings.getFreeboardShellCollapsed());
        }
      });
    });
  }

  public showToggleButton = () => this.handset().matches && !this.forceCollapsed();
  public showHandle = () => !this.forceCollapsed() && !this.panelCollapsed() && this.canResize();
  public canResize = () => !this._dashboard.isDashboardStatic() && !this.forceCollapsed();

  public toggleCollapse(): void {
    if (this.forceCollapsed()) return;
    const next = !this.panelCollapsed();
    this.panelCollapsed.set(next);
    // Persist only when not forced
    this._settings.setFreeboardShellCollapsed(next);
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
    const newW = Math.min(1000, Math.max(200, this.startW + delta));
    if (Math.abs(newW - this.ghostWidth) < FreeboardSplitComponent.MIN_DELTA_PX) return;
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
    if (this.panelEl && !this.panelCollapsed()) {
      this.panelEl.nativeElement.style.width = finalW + 'px';
    }
    this.ngZone.run(() => this.panelWidth.set(finalW));
    if (!this.forceCollapsed()) {
      // Persist within Angular (already in zone if called from pointerup listener outside zone)
      if (NgZone.isInAngularZone()) {
        this._settings.setFreeboardShellWidth(this.panelWidth());
      } else {
        this.ngZone.run(() => this._settings.setFreeboardShellWidth(this.panelWidth()));
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
