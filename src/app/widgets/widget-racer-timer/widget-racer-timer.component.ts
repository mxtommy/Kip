// widget-racer-timer.component.ts
import { Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { SignalKRequestsService } from 'signalk-client-angular';
import { Subscription } from 'rxjs';

@Component({
  selector: 'widget-racer-timer',
  templateUrl: './widget-racer-timer.component.html',
  styleUrls: ['./widget-racer-timer.component.scss']
})
export class WidgetRacerTimerComponent implements OnDestroy {
  @ViewChild('canvasEl') canvasRef!: ElementRef;

  mode: 'display' | 'time-adjust' | 'line-adjust' = 'display';
  timeToStart: string = '00:00';
  distanceToLine: string = '-';
  startTime: string = '';
  timerRunning: boolean = false;

  private sub?: Subscription;

  constructor(private skRequest: SignalKRequestsService) {
    this.subscribeToPaths();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private subscribeToPaths() {
    this.sub = this.skRequest.subscribeDelta(
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
    this.skRequest.put('vessels.self', 'navigation.racing.setStartTime', {
      command: 'adjust',
      delta
    }).subscribe();
  }

  setStartTimeManually(hhmmss: string) {
    const now = new Date();
    const [hh, mm, ss] = hhmmss.split(':').map(Number);
    now.setHours(hh, mm, ss, 0);
    this.skRequest.put('vessels.self', 'navigation.racing.setStartTime', {
      command: 'set',
      startTime: now.toISOString()
    }).subscribe();
  }

  sendTimerCommand(command: 'start' | 'reset' | 'sync') {
    this.skRequest.put('vessels.self', 'navigation.racing.setStartTime', {
      command
    }).subscribe();
  }

  // Line Adjustment Methods
  setLineEnd(end: 'port' | 'stb') {
    this.skRequest.put('vessels.self', 'navigation.racing.setStartLine', {
      end,
      position: 'bow'
    }).subscribe();
  }

  adjustLineEnd(end: 'port' | 'stb', delta: number, rotate: number) {
    this.skRequest.put('vessels.self', 'navigation.racing.setStartLine', {
      end,
      delta,
      rotate: rotate ? rotate * Math.PI / 180 : null
    }).subscribe();
  }
}
