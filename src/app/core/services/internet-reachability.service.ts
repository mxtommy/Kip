import { computed, DestroyRef, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent, merge } from 'rxjs';
import { ConnectionStateMachine } from './connection-state-machine.service';

@Injectable({
  providedIn: 'root'
})
export class InternetReachabilityService implements OnDestroy {
  private readonly connectionStateMachine = inject(ConnectionStateMachine);
  private readonly destroyRef = inject(DestroyRef);

  private readonly probeUrl = 'https://www.gstatic.com/generate_204';
  private readonly probeTimeoutMs = 5000;
  private readonly healthyRecheckMs = 60000;
  private readonly retryIntervalsMs = [5000, 30000, 60000];
  private readonly useConnectionStateTriggers = true;

  private readonly isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
  private started = false;
  private retryAttempt = 0;
  private checkTimer: ReturnType<typeof setTimeout> | null = null;
  private lastConnectionState: string | null = null;

  readonly isChecking = signal(false);
  readonly isReachable = signal<boolean | null>(null);
  readonly lastSuccessAt = signal<Date | null>(null);
  readonly lastCheckedAt = signal<Date | null>(null);
  readonly lastError = signal<string | null>(null);

  readonly internetAvailable = computed(() => this.isReachable() === true);

  public start(): void {
    if (this.started || !this.isBrowser) {
      return;
    }

    this.started = true;

    merge(
      fromEvent(window, 'online'),
      fromEvent(window, 'offline')
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.recheckNow());

    fromEvent(document, 'visibilitychange')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (document.visibilityState === 'visible') {
          this.recheckNow();
        }
      });

    if (this.useConnectionStateTriggers) {
      this.connectionStateMachine.status$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((status) => {
          if (status?.state && status.state !== this.lastConnectionState) {
            this.lastConnectionState = status.state;
            this.recheckNow();
          }
        });
    }

    this.recheckNow();
  }

  public recheckNow(): void {
    if (!this.started) {
      return;
    }

    this.clearTimer();

    if (!this.isChecking()) {
      void this.runProbe();
    }
  }

  private async runProbe(): Promise<void> {
    this.isChecking.set(true);
    this.lastCheckedAt.set(new Date());

    try {
      const reachable = await this.performProbe();
      this.isReachable.set(reachable);

      if (reachable) {
        this.lastSuccessAt.set(new Date());
        this.lastError.set(null);
        this.retryAttempt = 0;
        this.scheduleNext(this.healthyRecheckMs);
      } else {
        this.lastError.set('Internet reachability probe failed');
        this.scheduleRetry();
      }
    } catch {
      this.isReachable.set(false);
      this.lastError.set('Internet reachability probe failed');
      this.scheduleRetry();
    } finally {
      this.isChecking.set(false);
    }
  }

  private async performProbe(): Promise<boolean> {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), this.probeTimeoutMs);

    try {
      const response = await fetch(this.probeUrl, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-store',
        signal: abortController.signal
      });

      if (response.type === 'opaque') {
        return true;
      }

      return response.status >= 200 && response.status < 400;
    } catch {
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private scheduleRetry(): void {
    const intervalIndex = Math.min(this.retryAttempt, this.retryIntervalsMs.length - 1);
    const delay = this.retryIntervalsMs[intervalIndex];
    this.retryAttempt++;
    this.scheduleNext(delay);
  }

  private scheduleNext(delayMs: number): void {
    this.clearTimer();
    this.checkTimer = setTimeout(() => {
      this.checkTimer = null;
      void this.runProbe();
    }, delayMs);
  }

  private clearTimer(): void {
    if (this.checkTimer) {
      clearTimeout(this.checkTimer);
      this.checkTimer = null;
    }
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }
}
