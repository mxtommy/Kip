// widget-racer-timer.component.ts
import { Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { SignalkRequestsService, skRequest } from '../../core/services/signalk-requests.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'widget-racer-timer',
  templateUrl: './widget-racer-timer.component.html',
  standalone: true,
  styleUrls: ['./widget-racer-timer.component.scss']
})
export class WidgetRacerTimerComponent implements OnDestroy {
  signalkRequestsService = inject(SignalkRequestsService);
  @ViewChild('canvasEl') canvasRef!: ElementRef;

  mode: 'display' | 'time-adjust' | 'line-adjust' = 'display';
  timeToStart = '0:00:00';
  distanceToLine = '-';
  startTime = '';
  timerRunning = false;

  private sub?: Subscription;

  constructor() {
    this.subscribeToPaths();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private subscribeToPaths() {
    this.sub = this.signalkRequestsService.subscribeDelta(
      [
        'navigation.racing.timeToStart',
        'navigation.racing.distanceStartline',
        'navigation.racing.startTime'
      ],
      delta => {
        for (const update of delta.updates || []) {
          for (const val of update.values || []) {
            switch (val.path) {
              case 'navigation.racing.timeToStart':
                this.timeToStart = this.formatTime(val.value);
                this.timerRunning = val.value > 0;
                break;
              case 'navigation.racing.distanceStartline':
                this.distanceToLine = val.value?.toFixed(1) ?? '-';
                break;
              case 'navigation.racing.startTime':
                this.startTime = val.value ?? '';
                break;
            }
          }
        }
      }
    );
  }

  private formatTime(seconds: number): string {
    const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
    const ss = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  }

  toggleMode(next: 'time-adjust' | 'line-adjust') {
    this.mode = this.mode === 'display' ? next : 'display';
  }

  // Timer Adjustment Methods
  adjustStartTime(delta: number) {
    this.signalkRequestsService.put('vessels.self', 'navigation.racing.setStartTime', {
      command: 'adjust',
      delta
    }).subscribe();
  }

  setStartTimeManually(hhmmss: string) {
    const now = new Date();
    const [hh, mm, ss] = hhmmss.split(':').map(Number);
    now.setHours(hh, mm, ss, 0);
    this.signalkRequestsService.put('vessels.self', 'navigation.racing.setStartTime', {
      command: 'set',
      startTime: now.toISOString()
    }).subscribe();
  }

  sendTimerCommand(command: 'start' | 'reset' | 'sync') {
    this.signalkRequestsService.put('vessels.self', 'navigation.racing.setStartTime', {
      command
    }).subscribe();
  }

  // Line Adjustment Methods
  setLineEnd(end: 'port' | 'stb') {
    this.signalkRequestsService.put('vessels.self', 'navigation.racing.setStartLine', {
      end,
      position: 'bow'
    }).subscribe();
  }

  adjustLineEnd(end: 'port' | 'stb', delta: number, rotate: number) {
    this.signalkRequestsService.put('vessels.self', 'navigation.racing.setStartLine', {
      end,
      delta,
      rotate: rotate ? rotate * Math.PI / 180 : null
    }).subscribe();
  }
}
